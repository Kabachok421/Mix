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
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { db, storage, handleFirestoreError } from '../lib/firebase';
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
  
  // Upload file
  uploadFile: async (path: string, file: Blob | File) => {
    try {
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      return await getDownloadURL(storageRef);
    } catch (error) {
      console.error('File upload error:', error);
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
      return snapshot.docs
        .map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile))
        .filter(u => u.uid !== currentUserId);
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
    });
  },

  deleteMessage: async (chatId: string, messageId: string) => {
    try {
      const msgRef = doc(db, 'chats', chatId, 'messages', messageId);
      await deleteDoc(msgRef);
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
