import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { chatService } from '../services/chatService';
import { Chat, UserProfile, Message } from '../types';
import { cn } from '../lib/utils';
import { UserName } from './UserName';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Avatar } from './Avatar';
import { UserStatus } from './UserStatus';
import { MessageStatusIndicator } from './MessageStatusIndicator';
import { Users } from 'lucide-react';
import { motion } from 'motion/react';

interface ChatListItemProps {
  key?: React.Key;
  chat: Chat;
  otherUser: UserProfile | null;
  isActive: boolean;
  onClick: () => void;
}

export default function ChatListItem({ chat, otherUser, isActive, onClick }: ChatListItemProps) {
  const { user } = useAuth();
  const [isTyping, setIsTyping] = useState(false);
  const [lastMsg, setLastMsg] = useState<Message | null>(null);

  useEffect(() => {
    if (!chat.id) return;
    
    let isSubscribed = true;
    const unsubscribeMsg = chatService.subscribeToLastMessage(chat.id, (msg) => {
      if (!isSubscribed) return;
      setLastMsg(msg);
    });

    if (chat.isGroup || !otherUser?.uid) {
      return () => { isSubscribed = false; unsubscribeMsg(); };
    }

    const unsubscribeTyping = chatService.subscribeToTyping(chat.id, otherUser.uid, (typing) => {
      setIsTyping(typing);
    });

    return () => {
      isSubscribed = false;
      unsubscribeMsg();
      unsubscribeTyping();
    };
  }, [chat.id, otherUser?.uid, chat.isGroup]);

  const lastRead = user ? Number(localStorage.getItem(`mix_read_${user.uid}_${chat.id}`) || 0) : 0;
  const chatTime = chat.updatedAt ? chat.updatedAt.toMillis() : 0;
  
  // Calculate if unread: either by timestamp or by last message's readBy
  const isSentByMe = lastMsg?.senderId === user?.uid;
  const isMessageUnreadForMe = lastMsg && !isSentByMe && (!lastMsg.readBy || !lastMsg.readBy.includes(user?.uid || ''));
  const isUnread = !isActive && (isMessageUnreadForMe || (chatTime > lastRead && !isSentByMe));

  useEffect(() => {
    if (isActive && user && chat.id) {
      localStorage.setItem(`mix_read_${user.uid}_${chat.id}`, Date.now().toString());
    }
  }, [isActive, user, chat.id, chatTime]);

  const getLastMessageText = () => {
    if (!lastMsg) return chat.lastMessage || '';
    switch (lastMsg.type) {
      case 'image': return '📷 Фото';
      case 'voice': return '🎤 Голосовое сообщение';
      case 'file': return `📁 ${lastMsg.fileName || 'Файл'}`;
      case 'system': return `ℹ️ ${lastMsg.text || ''}`;
      default: return lastMsg.text || '';
    }
  };

  const renderAvatar = () => {
    if (chat.isGroup) {
      const avatar = chat.groupAvatar;
      if (avatar?.startsWith('preset:')) {
        const [, emoji, bg] = avatar.split(':');
        return (
          <div className="relative">
            <div className={`w-12 h-12 rounded-2xl ${bg} flex items-center justify-center text-xl shadow-sm border border-white/40 dark:border-white/10 shrink-0`}>
              {emoji}
            </div>
            <div className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-blue-500 text-white shadow-sm">
              <Users className="w-2.5 h-2.5" />
            </div>
            {isUnread && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-blue-500 border-2 border-white dark:border-[#1a1a1a] rounded-full shadow-sm animate-pulse" />
            )}
          </div>
        );
      }
      if (avatar) {
        return (
          <div className="relative">
            <img src={avatar} alt={chat.groupName} className="w-12 h-12 rounded-2xl object-cover shadow-sm shrink-0" />
            <div className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-blue-500 text-white shadow-sm">
              <Users className="w-2.5 h-2.5" />
            </div>
            {isUnread && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-blue-500 border-2 border-white dark:border-[#1a1a1a] rounded-full shadow-sm animate-pulse" />
            )}
          </div>
        );
      }
      return (
        <div className="relative">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-sm shrink-0">
            <Users className="w-6 h-6" />
          </div>
          {isUnread && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-blue-500 border-2 border-white dark:border-[#1a1a1a] rounded-full shadow-sm animate-pulse" />
          )}
        </div>
      );
    }

    return (
      <div className="relative">
        <Avatar src={otherUser?.photoURL} className="w-12 h-12" />
        {otherUser && <UserStatus user={otherUser} showDotOnly />}
        {isUnread && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-blue-500 border-2 border-white dark:border-[#1a1a1a] rounded-full shadow-sm animate-pulse" />
        )}
      </div>
    );
  };

  const lastText = getLastMessageText();

  return (
    <button
      onClick={() => {
        if (user && chat.id) {
          localStorage.setItem(`mix_read_${user.uid}_${chat.id}`, Date.now().toString());
        }
        onClick();
      }}
      className={cn(
        "flex items-center gap-4 p-4 transition-all border-b border-gray-100/50 dark:border-gray-800/30 hover:bg-gray-50 dark:hover:bg-[#1a1a1a]",
        isActive && "bg-white dark:bg-[#1a1a1a] shadow-[0_4px_15px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_25px_rgba(0,0,0,0.3)] z-10 border-transparent",
        isUnread && "bg-blue-50/40 dark:bg-blue-950/20"
      )}
    >
      {renderAvatar()}
      
      <div className="flex-1 text-left min-w-0">
        <div className="flex justify-between items-baseline mb-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className={cn(
              "text-[#1a1a1a] dark:text-white truncate",
              isUnread ? "font-semibold" : "font-medium"
            )}>
              {chat.isGroup 
                ? (chat.groupName || 'Групповой чат') 
                : (otherUser ? <UserName user={otherUser} /> : 'Загрузка...')}
            </h3>
            {chat.isGroup && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-gray-100 dark:bg-[#252525] text-gray-500 dark:text-gray-400 font-medium shrink-0">
                {chat.participantIds?.length || 0}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            <span className={cn(
              "text-[10px] font-sans uppercase",
              isUnread ? "text-blue-600 dark:text-blue-400 font-semibold" : "text-gray-400 dark:text-gray-600"
            )}>
              {chat.updatedAt && format(chat.updatedAt.toDate(), 'HH:mm', { locale: ru })}
            </span>
            {isUnread && (
              <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
            )}
          </div>
        </div>
        <div className="text-sm truncate flex items-center gap-1.5">
          {isTyping ? (
            <div className="flex items-center gap-1">
              <span className="text-blue-500 font-medium italic text-[13px]">печатает</span>
              <span className="flex gap-[2px] mt-1.5">
                <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0 }} className="w-1 h-1 bg-blue-500 rounded-full" />
                <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1 h-1 bg-blue-500 rounded-full" />
                <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1 h-1 bg-blue-500 rounded-full" />
              </span>
            </div>
          ) : lastText && lastText !== 'Chat started' ? (
            <div className="flex items-center gap-1 min-w-0">
              {isSentByMe && lastMsg && user && (
                <div className="shrink-0 flex items-center">
                  <MessageStatusIndicator
                    message={lastMsg}
                    currentUserId={user.uid}
                    totalParticipants={chat.participantIds?.length || 2}
                    isDarkBubble={false}
                  />
                </div>
              )}
              <span className={cn(
                "truncate",
                isUnread 
                  ? "text-gray-900 dark:text-gray-100 font-medium" 
                  : "text-gray-400 font-light italic"
              )}>
                {isSentByMe 
                  ? 'Вы: ' 
                  : (chat.isGroup && lastMsg?.senderName ? `${lastMsg.senderName.split(' ')[0]}: ` : '')}
                {lastText}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </button>
  );
}

