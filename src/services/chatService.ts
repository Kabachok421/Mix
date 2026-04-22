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
  limit
} from 'firebase/firestore';
import { db, handleFirestoreError } from '../lib/firebase';
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

  // Send a message
  sendMessage: async (chatId: string, senderId: string, senderName: string, text: string) => {
    try {
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      const chatRef = doc(db, 'chats', chatId);

      const timestamp = serverTimestamp();

      // We use a transaction-like update by simply performing both, rules will protect atomicity of the chat state if needed
      await addDoc(messagesRef, {
        text,
        senderId,
        senderName,
        timestamp
      });

      await updateDoc(chatRef, {
        lastMessage: text,
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

  // Search users by email or name
  searchUsers: async (searchTerm: string, currentUserId: string) => {
    try {
      const q = query(
        collection(db, 'users'),
        where('email', '>=', searchTerm),
        where('email', '<=', searchTerm + '\uf8ff'),
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
  }
};
