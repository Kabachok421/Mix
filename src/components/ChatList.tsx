import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { chatService } from '../services/chatService';
import { Chat, UserProfile } from '../types';
import { motion } from 'motion/react';
import { cn, getUserDisplayName } from '../lib/utils';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface ChatListProps {
  onSelectChat: (chatId: string) => void;
  activeChatId: string | null;
}

import { Avatar } from './Avatar';
import { UserStatus } from './UserStatus';

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
              <button
                key={chat.id}
                onClick={() => onSelectChat(chat.id)}
                className={cn(
                  "flex items-center gap-4 p-4 transition-all border-b border-gray-100/50 dark:border-gray-800/30 hover:bg-gray-50 dark:hover:bg-[#1a1a1a]",
                  activeChatId === chat.id && "bg-white dark:bg-[#1a1a1a] shadow-[0_4px_15px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_25px_rgba(0,0,0,0.3)] z-10 border-transparent"
                )}
              >
                <div className="relative">
                  <Avatar 
                    src={otherUser?.photoURL} 
                    className="w-12 h-12" 
                  />
                  {otherUser && <UserStatus user={otherUser} showDotOnly />}
                </div>
                
                <div className="flex-1 text-left min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <h3 className="font-medium text-[#1a1a1a] dark:text-white truncate">
                      {otherUser ? getUserDisplayName(otherUser) : 'Загрузка...'}
                    </h3>
                    <span className="text-[10px] text-gray-400 dark:text-gray-600 font-sans uppercase">
                      {chat.updatedAt && format(chat.updatedAt.toDate(), 'HH:mm', { locale: ru })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 truncate font-light italic">
                    {chat.lastMessageSenderId === user?.uid ? 'Вы: ' : ''}
                    {chat.lastMessage}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
