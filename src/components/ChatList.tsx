import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { chatService } from '../services/chatService';
import { Chat, UserProfile } from '../types';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { UserName } from './UserName';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface ChatListProps {
  onSelectChat: (chatId: string) => void;
  activeChatId: string | null;
}

import { Avatar } from './Avatar';
import { UserStatus } from './UserStatus';

import ChatListItem from './ChatListItem';

export default function ChatList({ onSelectChat, activeChatId }: ChatListProps) {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [participantsMap, setParticipantsMap] = useState<Record<string, UserProfile>>({});

  useEffect(() => {
    if (!user) return;

    const unsubscribeMap: Record<string, () => void> = {};

    const unsubscribeChats = chatService.subscribeToChats(user.uid, (newChats) => {
      setChats(newChats);
      
      // Subscribe to participant profiles for chats
      for (const chat of newChats) {
        const otherUserId = chat.participantIds.find(id => id !== user.uid);
        if (otherUserId && !unsubscribeMap[otherUserId]) {
          unsubscribeMap[otherUserId] = chatService.subscribeToUserProfile(otherUserId, (profile) => {
            if (profile) {
              setParticipantsMap(prev => ({ ...prev, [otherUserId]: profile }));
            }
          });
        }
      }
    });

    return () => {
      unsubscribeChats();
      Object.values(unsubscribeMap).forEach(unsub => unsub());
    };
  }, [user]);

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      {chats.length === 0 ? (
        <div className="p-8 text-center text-gray-400 dark:text-gray-600 italic font-light">
          Нет активных чатов. Начните поиск, чтобы написать кому-нибудь.
        </div>
      ) : (
        <div className="flex flex-col">
          {chats.map((chat) => {
            const otherUserId = chat.participantIds.find(id => id !== user?.uid);
            const otherUser = otherUserId ? participantsMap[otherUserId] : null;

            return (
              <ChatListItem
                key={chat.id}
                chat={chat}
                otherUser={otherUser}
                isActive={activeChatId === chat.id}
                onClick={() => onSelectChat(chat.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
