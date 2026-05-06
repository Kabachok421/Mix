import { Timestamp } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  lastSeen: Timestamp;
  status: 'online' | 'offline';
  username?: string;
  usernameUpdatedAt?: Timestamp;
  hideName?: boolean;
  customName?: string;
}

export interface Chat {
  id: string;
  participantIds: string[];
  lastMessage?: string;
  lastMessageSenderId?: string;
  updatedAt: Timestamp;
  participants?: UserProfile[]; // Populated locally
}

export interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  timestamp: Timestamp;
}
