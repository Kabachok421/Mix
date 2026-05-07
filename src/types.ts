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

export interface Call {
  id: string;
  callerId: string;
  participantIds: string[];
  status: 'calling' | 'ringing' | 'accepted' | 'rejected' | 'ended';
  offer?: any;
  answer?: any;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
export interface Message {
  id: string;
  text?: string;
  senderId: string;
  senderName: string;
  timestamp: Timestamp;
  type: 'text' | 'image' | 'file' | 'voice';
  url?: string;
  fileName?: string;
  fileSize?: number;
  duration?: number; // for voice
}
