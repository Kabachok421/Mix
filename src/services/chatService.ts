import { 
  collection, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  serverTimestamp, 
  doc, 
  updateDoc, 
  onSnapshot, 
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  limit
} from 'firebase/firestore';
import { db, auth, handleFirestoreError } from '../lib/firebase';
import { Chat, Message, UserProfile } from '../types';

export const chatService = {
  // Get active chats for current user
  subscribeToChats: (userId: string, callback: (chats: Chat[]) => void) => {
    const q = query(
      collection(db, 'chats'),
      where('participantIds', 'array-contains', userId),
      orderBy('updatedAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const chats = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Chat));
      callback(chats);
    }, (error) => handleFirestoreError(error, 'list', 'chats'));
  },

  // Subscribe to the last message of a chat dynamically
  subscribeToLastMessage: (chatId: string, callback: (message: Message | null) => void) => {
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('timestamp', 'desc'),
      limit(1)
    );
    return onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        callback({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Message);
      } else {
        callback(null);
      }
    }, (error) => {
      console.warn("Last message listener error:", error);
    });
  },

  // Get messages for a chat
  subscribeToMessages: (chatId: string, callback: (messages: Message[]) => void) => {
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('timestamp', 'asc'),
      limit(100)
    );

    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Message));
      callback(messages);
    }, (error) => handleFirestoreError(error, 'list', `chats/${chatId}/messages`));
  },
  
  // Upload file (via server endpoint /api/upload-raw or /api/upload)
  uploadFile: async (_path: string, file: Blob | File, onProgress?: (progress: number) => void) => {
    const filename = (file as File).name || (file.type.startsWith('audio/') ? `voice_${Date.now()}.webm` : 'file.bin');
    const mimeType = file.type || 'application/octet-stream';

    // Primary: direct binary stream upload via /api/upload-raw
    try {
      if (onProgress) onProgress(5);

      return await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `/api/upload-raw?filename=${encodeURIComponent(filename)}&mimeType=${encodeURIComponent(mimeType)}`);
        xhr.setRequestHeader('Content-Type', mimeType);

        if (xhr.upload && onProgress) {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const percent = Math.min(99, Math.round((e.loaded / e.total) * 100));
              onProgress(percent);
            }
          };
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const resJson = JSON.parse(xhr.responseText);
              if (resJson?.url) {
                if (onProgress) onProgress(100);
                resolve(resJson.url);
              } else {
                reject(new Error('Некорректный ответ сервера'));
              }
            } catch {
              reject(new Error('Ошибка парсинга ответа сервера'));
            }
          } else {
            try {
              const resJson = JSON.parse(xhr.responseText);
              reject(new Error(resJson.error || `HTTP ${xhr.status}`));
            } catch {
              reject(new Error(`Ошибка сервера: HTTP ${xhr.status}`));
            }
          }
        };

        xhr.onerror = () => {
          reject(new Error('Сетевая ошибка при загрузке файла'));
        };

        xhr.send(file);
      });
    } catch (primaryErr) {
      console.warn('Stream upload failed, attempting fallback to base64 JSON upload:', primaryErr);
      
      // Secondary fallback: base64 upload
      try {
        const base64Data = await new Promise<string>((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result as string);
          reader.onerror = rej;
          reader.readAsDataURL(file);
        });

        const resp = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename, mimeType, fileData: base64Data })
        });

        if (resp.ok) {
          const data = await resp.json();
          if (data?.url) {
            if (onProgress) onProgress(100);
            return data.url;
          }
        }
      } catch (fallbackErr) {
        console.warn('Base64 upload also failed:', fallbackErr);
      }

      // Final fallback for small files (< 600 KB): return data URL directly so message is delivered
      if (file.size < 600 * 1024) {
        return new Promise<string>((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (onProgress) onProgress(100);
            res(reader.result as string);
          };
          reader.onerror = () => rej(primaryErr);
          reader.readAsDataURL(file);
        });
      }

      throw primaryErr;
    }
  },

  // Send a message
  sendMessage: async (chatId: string, senderId: string, senderName: string, data: Partial<Message>) => {
    try {
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      const chatRef = doc(db, 'chats', chatId);

      const timestamp = serverTimestamp();
      
      const messageData: any = {
        senderId,
        senderName,
        timestamp,
        type: data.type || 'text',
        readBy: [senderId],
        deliveredTo: [senderId]
      };
      
      if (data.text) messageData.text = data.text;
      if (data.url) messageData.url = data.url;
      if (data.thumbnail) messageData.thumbnail = data.thumbnail;
      if (data.fileName) messageData.fileName = data.fileName;
      if (data.fileSize) messageData.fileSize = data.fileSize;
      if (data.duration) messageData.duration = data.duration;

      await addDoc(messagesRef, messageData);

      let lastMessageText = '';
      switch (messageData.type) {
        case 'image': lastMessageText = '📷 Фото'; break;
        case 'voice': lastMessageText = '🎤 Голосовое сообщение'; break;
        case 'file': lastMessageText = `📁 ${messageData.fileName || 'Файл'}`; break;
        default: lastMessageText = messageData.text || '';
      }

      await updateDoc(chatRef, {
        lastMessage: lastMessageText,
        lastMessageSenderId: senderId,
        lastMessageSenderName: senderName,
        updatedAt: timestamp
      });
    } catch (error) {
      handleFirestoreError(error, 'create', `chats/${chatId}/messages`);
    }
  },

  // Mark messages as read by current user
  markMessagesAsRead: async (chatId: string, currentUserId: string, messages: Message[]) => {
    try {
      const unreadMessages = messages.filter(
        msg => msg.id && msg.senderId !== currentUserId && (!msg.readBy || !msg.readBy.includes(currentUserId))
      );

      if (unreadMessages.length === 0) return;

      const updatePromises = unreadMessages.map(async (msg) => {
        try {
          const msgRef = doc(db, 'chats', chatId, 'messages', msg.id);
          const currentReadBy = Array.isArray(msg.readBy) ? msg.readBy : [];
          const currentDeliveredTo = Array.isArray(msg.deliveredTo) ? msg.deliveredTo : [];
          
          const newReadBy = currentReadBy.includes(currentUserId) ? currentReadBy : [...currentReadBy, currentUserId];
          const newDeliveredTo = currentDeliveredTo.includes(currentUserId) ? currentDeliveredTo : [...currentDeliveredTo, currentUserId];
          
          await updateDoc(msgRef, {
            readBy: newReadBy,
            deliveredTo: newDeliveredTo
          });
        } catch (err) {
          console.warn('Failed to mark message as read:', msg.id, err);
        }
      });

      await Promise.all(updatePromises);
    } catch (e) {
      console.warn('Error marking messages as read:', e);
    }
  },

  // Mark messages as delivered to current user
  markMessagesAsDelivered: async (chatId: string, currentUserId: string, messages: Message[]) => {
    try {
      const undeliveredMessages = messages.filter(
        msg => msg.id && msg.senderId !== currentUserId && (!msg.deliveredTo || !msg.deliveredTo.includes(currentUserId))
      );

      if (undeliveredMessages.length === 0) return;

      const updatePromises = undeliveredMessages.map(async (msg) => {
        try {
          const msgRef = doc(db, 'chats', chatId, 'messages', msg.id);
          const currentDeliveredTo = Array.isArray(msg.deliveredTo) ? msg.deliveredTo : [];
          if (!currentDeliveredTo.includes(currentUserId)) {
            await updateDoc(msgRef, {
              deliveredTo: [...currentDeliveredTo, currentUserId]
            });
          }
        } catch (err) {
          console.warn('Failed to mark message as delivered:', msg.id, err);
        }
      });

      await Promise.all(updatePromises);
    } catch (e) {
      console.warn('Error marking messages as delivered:', e);
    }
  },

  // Create a new group chat
  createGroupChat: async (
    currentUserId: string,
    creatorName: string,
    groupName: string,
    groupAvatar: string,
    memberUserIds: string[]
  ): Promise<string> => {
    try {
      const allParticipantIds = Array.from(new Set([currentUserId, ...memberUserIds]));
      const chatId = `group_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const chatRef = doc(db, 'chats', chatId);

      const timestamp = serverTimestamp();
      await setDoc(chatRef, {
        isGroup: true,
        groupName: groupName.trim(),
        groupAvatar: groupAvatar || '',
        createdBy: currentUserId,
        adminIds: [currentUserId],
        participantIds: allParticipantIds,
        lastMessage: `Группа «${groupName.trim()}» создана`,
        lastMessageSenderId: currentUserId,
        lastMessageSenderName: creatorName,
        updatedAt: timestamp
      });

      // Add system message into the chat
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      await addDoc(messagesRef, {
        senderId: currentUserId,
        senderName: creatorName,
        timestamp,
        type: 'system',
        text: `${creatorName} создал(а) группу «${groupName.trim()}»`,
        readBy: [currentUserId],
        deliveredTo: [currentUserId]
      });

      return chatId;
    } catch (error) {
      handleFirestoreError(error, 'create', 'chats');
      throw error;
    }
  },

  // Update group chat info (e.g. name, avatar, or participants)
  updateGroupChat: async (
    chatId: string,
    data: {
      groupName?: string;
      groupAvatar?: string;
      participantIds?: string[];
      adminIds?: string[];
      systemMessage?: string;
      senderId?: string;
      senderName?: string;
    }
  ) => {
    try {
      const chatRef = doc(db, 'chats', chatId);
      const updateData: any = {
        updatedAt: serverTimestamp()
      };
      if (data.groupName !== undefined) updateData.groupName = data.groupName.trim();
      if (data.groupAvatar !== undefined) updateData.groupAvatar = data.groupAvatar;
      if (data.participantIds !== undefined) updateData.participantIds = data.participantIds;
      if (data.adminIds !== undefined) updateData.adminIds = data.adminIds;
      if (data.systemMessage) {
        updateData.lastMessage = data.systemMessage;
        updateData.lastMessageSenderId = data.senderId;
        updateData.lastMessageSenderName = data.senderName;
      }

      await updateDoc(chatRef, updateData);

      if (data.systemMessage && data.senderId) {
        const messagesRef = collection(db, 'chats', chatId, 'messages');
        await addDoc(messagesRef, {
          senderId: data.senderId,
          senderName: data.senderName || 'Система',
          timestamp: serverTimestamp(),
          type: 'system',
          text: data.systemMessage,
          readBy: [data.senderId],
          deliveredTo: [data.senderId]
        });
      }
    } catch (error) {
      handleFirestoreError(error, 'update', `chats/${chatId}`);
      throw error;
    }
  },

  // Subscribe to single chat document
  subscribeToChat: (chatId: string, callback: (chat: Chat | null) => void) => {
    const chatRef = doc(db, 'chats', chatId);
    return onSnapshot(chatRef, (docSnap) => {
      if (docSnap.exists()) {
        callback({ id: docSnap.id, ...docSnap.data() } as Chat);
      } else {
        callback(null);
      }
    }, (error) => {
      console.warn('Error subscribing to chat:', error);
    });
  },

  // Find or create a chat with another user
  getOrCreateChat: async (currentUserId: string, targetUserId: string) => {
    try {
      // Sort IDs to ensure unique chat between two users
      const participantIds = [currentUserId, targetUserId].sort();
      const chatId = participantIds.join('_');
      
      const chatRef = doc(db, 'chats', chatId);
      const chatDoc = await getDoc(chatRef);

      if (!chatDoc.exists()) {
        await setDoc(chatRef, {
          participantIds,
          updatedAt: serverTimestamp(),
          lastMessage: 'Chat started'
        });
      }
      
      return chatId;
    } catch (error) {
      handleFirestoreError(error, 'write', 'chats');
    }
  },

  // Search users by username
    searchUsers: async (searchTerm: string, currentUserId: string) => {
    try {
      const q = query(
        collection(db, 'users'),
        where('username', '>=', searchTerm),
        where('username', '<=', searchTerm + '\uf8ff'),
        limit(10)
      );
      
      const snapshot = await getDocs(q);
      let users = snapshot.docs
        .map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile))
        .filter(u => u.uid !== currentUserId && !u.isHidden);

      // Also search by exact friend code
      const friendCodeQuery = query(
        collection(db, 'users'),
        where('friendCode', '==', searchTerm.trim().toUpperCase()),
        limit(1)
      );
      const friendCodeSnapshot = await getDocs(friendCodeQuery);
      friendCodeSnapshot.docs.forEach(doc => {
        const u = { uid: doc.id, ...doc.data() } as UserProfile;
        if (u.uid !== currentUserId) {
          if (!users.find(existing => existing.uid === u.uid)) {
            users.push(u);
          }
        }
      });

      return users;
    } catch (error) {
      handleFirestoreError(error, 'list', 'users');
    }
  },

  getAllUsers: async () => {
    try {
      const q = query(collection(db, 'users'), limit(500));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
    } catch (error) {
      handleFirestoreError(error, 'list', 'users');
    }
  },

  updateUserAdmin: async (userId: string, data: Partial<UserProfile>) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, data);
    } catch (error) {
      handleFirestoreError(error, 'update', 'users');
    }
  },
  // Subscribe to user profile (status, lastSeen, etc)
  subscribeToUserProfile: (userId: string, callback: (profile: UserProfile | null) => void) => {
    const docRef = doc(db, 'users', userId);
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        callback({ uid: docSnap.id, ...docSnap.data() } as UserProfile);
      } else {
        callback(null);
      }
    }, (error) => {
      const errInfo = {
        error: error instanceof Error ? error.message : String(error),
        authInfo: { userId: auth.currentUser?.uid },
        operationType: 'get',
        path: `users/${userId}`
      };
      console.error('Firestore Error: ', JSON.stringify(errInfo));
    });
  },

  // Get user profile
  getUserProfile: async (userId: string) => {
    try {
      const docRef = doc(db, 'users', userId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { uid: docSnap.id, ...docSnap.data() } as UserProfile;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, 'get', `users/${userId}`);
    }
  },

  // Typing indicator
  setTypingStatus: async (chatId: string, userId: string, isTyping: boolean) => {
    try {
      const typingRef = doc(db, 'chats', chatId, 'typing', userId);
      await setDoc(typingRef, {
        isTyping,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      // Typing errors are non-critical, usually silented in production
      console.error('Typing indicator error:', error);
    }
  },

  subscribeToTyping: (chatId: string, otherUserId: string, callback: (isTyping: boolean) => void) => {
    const typingRef = doc(db, 'chats', chatId, 'typing', otherUserId);
    return onSnapshot(typingRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        // Check if the typing indicator is recent (within 10 seconds)
        const isRecent = data.updatedAt && (Date.now() - data.updatedAt.toMillis() < 10000);
        callback(data.isTyping && isRecent);
      } else {
        callback(false);
      }
    }, (error) => {
      console.warn("Typing listener error:", error);
    });
  },

  deleteMessage: async (chatId: string, messageId: string) => {
    try {
      const msgRef = doc(db, 'chats', chatId, 'messages', messageId);
      await deleteDoc(msgRef);

      // Query the latest message to update the chat's lastMessage
      const q = query(
        collection(db, 'chats', chatId, 'messages'),
        orderBy('timestamp', 'desc'),
        limit(2)
      );
      const snapshot = await getDocs(q);
      const validDocs = snapshot.docs.filter(d => d.id !== messageId);
      
      const chatRef = doc(db, 'chats', chatId);
      if (validDocs.length > 0) {
        const lastMsgData = validDocs[0].data();
        let lastMessageText = '';
        switch (lastMsgData.type) {
          case 'image': lastMessageText = '📷 Фото'; break;
          case 'voice': lastMessageText = '🎤 Голосовое сообщение'; break;
          case 'file': lastMessageText = `📁 ${lastMsgData.fileName || 'Файл'}`; break;
          default: lastMessageText = lastMsgData.text || '';
        }
        await updateDoc(chatRef, {
          lastMessage: lastMessageText,
          lastMessageSenderId: lastMsgData.senderId,
          updatedAt: serverTimestamp()
        });
      } else {
        await updateDoc(chatRef, {
          lastMessage: '',
          lastMessageSenderId: null,
          updatedAt: serverTimestamp()
        });
      }
    } catch (error) {
      handleFirestoreError(error, 'delete', `chats/${chatId}/messages/${messageId}`);
    }
  },

  deleteChat: async (chatId: string) => {
    try {
      const chatRef = doc(db, 'chats', chatId);
      await deleteDoc(chatRef);
    } catch (error) {
      handleFirestoreError(error, 'delete', `chats/${chatId}`);
    }
  }
};
