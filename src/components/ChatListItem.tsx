import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { chatService } from '../services/chatService';
import { Chat, UserProfile } from '../types';
import { cn } from '../lib/utils';
import { UserName } from './UserName';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Avatar } from './Avatar';
import { UserStatus } from './UserStatus';
import { motion } from 'motion/react';

interface ChatListItemProps {
  chat: Chat;
  otherUser: UserProfile | null;
  isActive: boolean;
  onClick: () => void;
}

export default function ChatListItem({ chat, otherUser, isActive, onClick }: ChatListItemProps) {
  const { user } = useAuth();
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (!chat.id || !otherUser?.uid) return;
    const unsubscribe = chatService.subscribeToTyping(chat.id, otherUser.uid, (typing) => {
      setIsTyping(typing);
    });
    return () => unsubscribe();
  }, [chat.id, otherUser?.uid]);

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-4 p-4 transition-all border-b border-gray-100/50 dark:border-gray-800/30 hover:bg-gray-50 dark:hover:bg-[#1a1a1a]",
        isActive && "bg-white dark:bg-[#1a1a1a] shadow-[0_4px_15px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_25px_rgba(0,0,0,0.3)] z-10 border-transparent"
      )}
    >
      <div className="relative">
        <Avatar src={otherUser?.photoURL} className="w-12 h-12" />
        {otherUser && <UserStatus user={otherUser} showDotOnly />}
      </div>
      
      <div className="flex-1 text-left min-w-0">
        <div className="flex justify-between items-baseline mb-1">
          <h3 className="font-medium text-[#1a1a1a] dark:text-white truncate">
            {otherUser ? <UserName user={otherUser} /> : 'Загрузка...'}
          </h3>
          <span className="text-[10px] text-gray-400 dark:text-gray-600 font-sans uppercase">
            {chat.updatedAt && format(chat.updatedAt.toDate(), 'HH:mm', { locale: ru })}
          </span>
        </div>
        <div className="text-sm truncate">
          {isTyping ? (
            <div className="flex items-center gap-1">
              <span className="text-blue-500 font-medium italic text-[13px]">печатает</span>
              <span className="flex gap-[2px] mt-1.5">
                <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0 }} className="w-1 h-1 bg-blue-500 rounded-full" />
                <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1 h-1 bg-blue-500 rounded-full" />
                <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1 h-1 bg-blue-500 rounded-full" />
              </span>
            </div>
          ) : (
            <span className="text-gray-400 font-light italic">
              {chat.lastMessageSenderId === user?.uid ? 'Вы: ' : ''}
              {chat.lastMessage}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
