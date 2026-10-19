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
  isHidden?: boolean;
  friendCode?: string;
  bannedUntil?: Timestamp | null;
}

export interface Chat {
  id: string;
  participantIds: string[];
  lastMessage?: string;
  lastMessageSenderId?: string;
  lastMessageSenderName?: string;
  updatedAt: Timestamp;
  participants?: UserProfile[]; // Populated locally
  // Group chats support
  isGroup?: boolean;
  groupName?: string;
  groupAvatar?: string;
  createdBy?: string;
  adminIds?: string[];
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
  type: 'text' | 'image' | 'file' | 'voice' | 'system';
  url?: string;
  thumbnail?: string;
  fileName?: string;
  fileSize?: number;
  duration?: number; // for voice
  // Message delivery and read status indicators
  readBy?: string[];
  deliveredTo?: string[];
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
}

export interface AppConfig {
  versionName: string;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

export interface ChangelogItem {
  id: string;
  version: string;
  title: string;
  content: string;
  createdAt: Timestamp;
  createdBy?: string;
  authorName?: string;
}
