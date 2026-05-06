import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { chatService } from '../services/chatService';
import { Chat, Message, UserProfile } from '../types';
import { Send, Smile, Paperclip, MoreVertical, MessageSquare, Trash2, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, getUserDisplayName } from '../lib/utils';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import UserProfileModal from './UserProfileModal';
import { Avatar } from './Avatar';

interface ChatWindowProps {
  chatId: string;
  onClose?: () => void;
}

export default function ChatWindow({ chatId, onClose }: ChatWindowProps) {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [input, setInput] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleDeleteChat = async () => {
    if (window.confirm('Вы уверены, что хотите удалить этого пользователя из друзей (удалить чат)? Это действие нельзя отменить.')) {
      await chatService.deleteChat(chatId);
      if (onClose) onClose();
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (window.confirm('Удалить это сообщение?')) {
      await chatService.deleteMessage(chatId, messageId);
    }
  };

  useEffect(() => {
    if (!chatId || !user) return;

    // Load messages
    const unsubscribeMessages = chatService.subscribeToMessages(chatId, (newMessages) => {
      setMessages(newMessages);
    });

    // Load chat metadata to get participant info
    const participantIds = chatId.split('_');
    const otherUserId = participantIds.find(id => id !== user.uid);

    const fetchChatMeta = async () => {
      if (otherUserId) {
        const profile = await chatService.getUserProfile(otherUserId);
        setOtherUser(profile);
      }
    };

    fetchChatMeta();

    // Subscribe to typing status of the other user
    let unsubscribeTyping: (() => void) | undefined;
    if (otherUserId) {
      unsubscribeTyping = chatService.subscribeToTyping(chatId, otherUserId, (typing) => {
        setIsOtherTyping(typing);
      });
    }

    return () => {
      unsubscribeMessages();
      if (unsubscribeTyping) unsubscribeTyping();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [chatId, user]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    
    if (user && chatId) {
      // Set typing to true
      chatService.setTypingStatus(chatId, user.uid, true);

      // Clear existing timeout
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      // Set timeout to reset typing status after 3 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        chatService.setTypingStatus(chatId, user.uid, false);
      }, 3000);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user) return;

    const text = input.trim();
    setInput('');
    
    // Clear typing indicator immediately
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    chatService.setTypingStatus(chatId, user.uid, false);

    await chatService.sendMessage(chatId, user.uid, getUserDisplayName(profile as UserProfile) || user.displayName || 'Anonymous', text);
  };

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-[#0d0d0d] overflow-hidden transition-colors duration-500">
      {/* Header */}
      <div 
        className="p-4 flex items-center justify-between border-b border-gray-100 dark:border-[#222] bg-white/80 dark:bg-[#0d0d0d]/80 backdrop-blur-md z-10 cursor-pointer group flex-shrink-0"
        onClick={() => { if (otherUser) setShowProfile(true); }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onClose) onClose();
            }}
            className="sm:hidden p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-[#222] rounded-full transition-colors text-gray-500"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <Avatar 
            src={otherUser?.photoURL} 
            className="w-10 h-10 border border-gray-100 dark:border-[#333] shadow-sm group-hover:opacity-80 transition-opacity" 
          />
          <div>
            <h2 className="font-medium text-[#1a1a1a] dark:text-white transition-colors">{otherUser ? getUserDisplayName(otherUser) : 'Переписка'}</h2>
            <AnimatePresence mode="wait">
              {isOtherTyping ? (
                <motion.p 
                  key="typing"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="text-[10px] text-[#5A5A40] dark:text-orange-400/80 uppercase tracking-widest font-sans font-bold italic"
                >
                  печaтaет...
                </motion.p>
              ) : (
                <motion.p 
                  key="status"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={cn(
                    "text-[10px] uppercase tracking-widest font-sans font-semibold",
                    otherUser?.status === 'online' ? "text-green-500 dark:text-green-400" : "text-gray-400 dark:text-gray-600"
                  )}
                >
                  {otherUser?.status === 'online' ? 'В сети' : 'Оффлайн'}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>
        <div className="relative">
          <button 
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="p-2 hover:bg-gray-100 dark:hover:bg-[#222] rounded-full transition-colors text-gray-400"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
          
          <AnimatePresence>
            {showMenu && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={(e) => { e.stopPropagation(); setShowMenu(false); }}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-[#1a1a1a] rounded-xl shadow-lg border border-gray-100 dark:border-[#333] overflow-hidden z-50 origin-top-right"
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      handleDeleteChat();
                    }}
                    className="w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Удалить друга
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {showProfile && otherUser && (
          <UserProfileModal user={otherUser} onClose={() => setShowProfile(false)} />
        )}
      </AnimatePresence>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#fafafa] dark:bg-[#080808] custom-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-300 dark:text-gray-700 gap-4">
            <div className="w-20 h-20 rounded-full bg-gray-50 dark:bg-[#111] flex items-center justify-center border border-gray-100 dark:border-[#222] shadow-inner">
              <MessageSquare className="w-8 h-8" />
            </div>
            <p className="italic font-light">Напишите первое сообщение...</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === user?.uid;
            return (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                key={msg.id}
                className={cn(
                  "flex flex-col max-w-[80%] gap-1",
                  isMe ? "self-end items-end" : "self-start items-start"
                )}
              >
                {!isMe && <span className="text-[10px] text-gray-400 dark:text-gray-600 ml-2 uppercase font-sans">{otherUser ? getUserDisplayName(otherUser) : msg.senderName}</span>}
                <div
                  className={cn(
                    "px-4 py-2.5 rounded-2xl shadow-sm text-sm relative transition-all duration-300",
                    isMe 
                      ? "bg-[#1a1a1a] dark:bg-[#e5e5e0] text-white dark:text-black rounded-tr-none shadow-md" 
                      : "bg-white dark:bg-[#1e1e1e] border border-gray-100 dark:border-[#333] text-gray-800 dark:text-gray-200 rounded-tl-none shadow-sm"
                  )}
                >
                  {msg.text}
                  <div className={cn(
                    "flex flex-row items-center justify-end text-[9px] mt-1 opacity-50 font-sans text-right",
                    isMe ? "text-white dark:text-black" : "text-gray-500"
                  )}>
                    {isMe && (
                      <button 
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="mr-2 hover:text-red-300 dark:hover:text-red-600 transition-colors cursor-pointer"
                        title="Удалить сообщение"
                        type="button"
                      >
                        <Trash2 className="w-[10px] h-[10px]" />
                      </button>
                    )}
                    <span>{msg.timestamp && format(msg.timestamp.toDate(), 'HH:mm', { locale: ru })}</span>
                  </div>
                </div>
              </motion.div>
            )
          })
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white dark:bg-[#0d0d0d] border-t border-gray-100 dark:border-[#222] transition-colors">
        <form onSubmit={handleSend} className="flex items-center gap-3 bg-gray-50 dark:bg-[#1a1a1a] p-2 rounded-[24px] border border-gray-100 dark:border-[#222] focus-within:ring-2 focus-within:ring-[#5A5A40]/10 dark:focus-within:ring-[#A0A080]/10 transition-all">
          <button type="button" className="p-2 hover:bg-gray-200 dark:hover:bg-[#222] rounded-full text-gray-400 transition-colors">
            <Smile className="w-5 h-5" />
          </button>
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder="Напишите сообщение..."
            className="flex-1 bg-transparent border-none outline-none text-sm py-2 dark:text-white"
          />
          <button type="button" className="p-2 hover:bg-gray-200 dark:hover:bg-[#222] rounded-full text-gray-400 transition-colors">
            <Paperclip className="w-5 h-5" />
          </button>
          <button 
            type="submit" 
            disabled={!input.trim()}
            className="p-3 bg-[#1a1a1a] dark:bg-[#e5e5e0] text-white dark:text-black rounded-full hover:bg-black dark:hover:bg-white disabled:opacity-50 transition-all shadow-md active:scale-95"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
