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
  
  // Upload file (using GoFile for free large file storage when user is offline)
  uploadFile: async (path: string, file: Blob | File, onProgress?: (progress: number) => void) => {
    try {
      const serverRes = await fetch('https://api.gofile.io/servers');
      const serverData = await serverRes.json();
      if (serverData.status !== 'ok') throw new Error('Не удалось получить сервер GoFile');
      const server = serverData.data.servers[0].name;

      const formData = new FormData();
      formData.append('file', file, (file as File).name || 'voice.webm');

      return new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `https://${server}.gofile.io/contents/uploadfile`, true);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && onProgress) {
            const progress = (event.loaded / event.total) * 100;
            onProgress(progress);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const res = JSON.parse(xhr.responseText);
              if (res.status === 'ok') {
                resolve(res.data.downloadPage);
              } else {
                reject(new Error('GoFile error: ' + res.status));
              }
            } catch (e) {
              reject(e);
            }
          } else {
            reject(new Error('Upload failed with status ' + xhr.status));
          }
        };

        xhr.onerror = () => reject(new Error('Network error during upload'));
        
        xhr.send(formData);
      });
    } catch (error) {
      console.error("GoFile upload error:", error);
      throw error;
    }
  },

  // Send a message
  sendMessage: async (chatId: string, senderId: string, senderName: string, data: Partial<Message>) => {
    try {
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      const chatRef = doc(db, 'chats', chatId);

      const timestamp = serverTimestamp();
      
      const messageData = {
        ...data,
        senderId,
        senderName,
        timestamp,
        type: data.type || 'text'
      };

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
        updatedAt: timestamp
      });
    } catch (error) {
      handleFirestoreError(error, 'create', `chats/${chatId}/messages`);
    }
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
