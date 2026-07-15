import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { chatService } from '../services/chatService';
import { fileTransferService } from '../services/fileTransferService';
import { Chat, Message, UserProfile } from '../types';
import { Send, Smile, Paperclip, MoreVertical, MessageSquare, Trash2, ChevronLeft, Mic, X, Image as ImageIcon, File as FileIcon, Loader2, Video } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, getUserDisplayName, formatLastSeen, generateThumbnail } from '../lib/utils';
import { UserName } from './UserName';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import UserProfileModal from './UserProfileModal';
import { Avatar } from './Avatar';
import { UserStatus } from './UserStatus';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { VoiceMessage } from './VoiceMessage';
import { FileMessage } from './FileMessage';
import TypingIndicator from './TypingIndicator';
import { callService } from '../services/callService';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMethod, setUploadMethod] = useState('');
  const [p2pFiles, setP2pFiles] = useState<Record<string, string>>({});
  const { isRecording, duration, startRecording, stopRecording, cancelRecording } = useVoiceRecorder();

  const handleDeleteChat = async () => {
    if (window.confirm('Вы уверены, что хотите удалить этого пользователя из друзей (удалить чат)? Это действие нельзя отменить.')) {
      await chatService.deleteChat(chatId);
      if (onClose) onClose();
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await chatService.deleteMessage(chatId, messageId);
    } catch (e) {
      console.error('Failed to delete message:', e);
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

    let unsubscribeProfile: (() => void) | undefined;
    if (otherUserId) {
      unsubscribeProfile = chatService.subscribeToUserProfile(otherUserId, (profile) => {
        setOtherUser(profile);
      });
    }

    // Subscribe to typing status of the other user
    let unsubscribeTyping: (() => void) | undefined;
    if (otherUserId) {
      unsubscribeTyping = chatService.subscribeToTyping(chatId, otherUserId, (typing) => {
        setIsOtherTyping(typing);
      });
    }

    // Subscribe to incoming P2P transfers
    const unsubscribeTransfers = fileTransferService.subscribeToIncomingTransfers(chatId, user.uid, (transferId, meta) => {
      fileTransferService.acceptTransfer(chatId, transferId, meta.offer, (progress) => {
         setUploadProgress(Math.round(progress));
         setIsUploading(true);
      }, (url, name) => {
         setIsUploading(false);
         setUploadProgress(0);
         setP2pFiles(prev => ({ ...prev, [name]: url }));
      }).catch(console.error);
    });

    return () => {
      unsubscribeMessages();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeTyping) unsubscribeTyping();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      unsubscribeTransfers();
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

    await chatService.sendMessage(chatId, user.uid, getUserDisplayName(profile as UserProfile) || user.displayName || 'Anonymous', { text, type: 'text' });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      setIsUploading(true);
      setUploadProgress(0);
      setShowAttachmentMenu(false);

      let finalUrl = '';
      
      const isOtherUserOnline = (() => {
        if (!otherUser) return false;
        if (otherUser.status !== 'online') return false;
        if (otherUser.lastSeen) {
          let date: Date;
          if (typeof (otherUser.lastSeen as any).toDate === 'function') {
            date = (otherUser.lastSeen as any).toDate();
          } else if ((otherUser.lastSeen as any).seconds) {
            date = new Date((otherUser.lastSeen as any).seconds * 1000);
          } else if (typeof otherUser.lastSeen === 'string' || typeof otherUser.lastSeen === 'number') {
            date = new Date(otherUser.lastSeen);
          } else {
            return true;
          }
          const now = new Date();
          if (now.getTime() - date.getTime() > 5 * 60 * 1000) {
            return false; // Stale for more than 5 minutes
          }
        }
        return true;
      })();
      
      if (isOtherUserOnline) {
        setUploadMethod('P2P');
        if (file.size > 2 * 1024 * 1024 * 1024) {
           throw new Error("Максимальный размер файла для прямой передачи - 2 ГБ.");
        }
        await fileTransferService.initiateTransfer(chatId, user.uid, otherUser!.uid, file, (progress) => {
           setUploadProgress(Math.round(progress));
        });
        finalUrl = 'p2p-sent';
      } else {
        setUploadMethod('GoFile');
        const path = `chats/${chatId}/${Date.now()}_${file.name}`;
        finalUrl = await chatService.uploadFile(path, file, (progress) => {
          setUploadProgress(Math.round(progress));
        });
      }

      let thumbnail = undefined;
      if (type === 'image') {
        try {
          thumbnail = await generateThumbnail(file);
        } catch (e) {
          console.error('Failed to generate thumbnail', e);
        }
      }

      await chatService.sendMessage(
        chatId, 
        user.uid, 
        getUserDisplayName(profile as UserProfile) || user.displayName || 'Anonymous', 
        { 
          type, 
          url: finalUrl,
          thumbnail,
          fileName: file.name, 
          fileSize: file.size 
        }
      );
    } catch (error: any) {
      console.error('File upload failed:', error);
      alert(error.message || 'Ошибка при загрузке файла');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (e.target) e.target.value = '';
    }
  };

  const handleVoiceSend = async () => {
    const recording = await stopRecording();
    if (!recording || !user) return;

    try {
      setIsUploading(true);
      setUploadProgress(0);
      
      let finalUrl = '';
      const fileName = `voice_${Date.now()}.webm`;
      
      const isOtherUserOnline = (() => {
        if (!otherUser) return false;
        if (otherUser.status !== 'online') return false;
        if (otherUser.lastSeen) {
          let date: Date;
          if (typeof (otherUser.lastSeen as any).toDate === 'function') {
            date = (otherUser.lastSeen as any).toDate();
          } else if ((otherUser.lastSeen as any).seconds) {
            date = new Date((otherUser.lastSeen as any).seconds * 1000);
          } else if (typeof otherUser.lastSeen === 'string' || typeof otherUser.lastSeen === 'number') {
            date = new Date(otherUser.lastSeen);
          } else {
            return true;
          }
          const now = new Date();
          if (now.getTime() - date.getTime() > 5 * 60 * 1000) {
            return false; // Stale for more than 5 minutes
          }
        }
        return true;
      })();
      
      if (isOtherUserOnline) {
        setUploadMethod('P2P');
        const file = new File([recording.blob], fileName, { type: recording.blob.type });
        await fileTransferService.initiateTransfer(chatId, user.uid, otherUser!.uid, file, (progress) => {
           setUploadProgress(Math.round(progress));
        });
        finalUrl = 'p2p-sent';
      } else {
         setUploadMethod('GoFile');
         const path = `chats/${chatId}/${fileName}`;
         finalUrl = await chatService.uploadFile(path, recording.blob, (progress) => {
           setUploadProgress(Math.round(progress));
         });
      }

      await chatService.sendMessage(
        chatId, 
        user.uid, 
        getUserDisplayName(profile as UserProfile) || user.displayName || 'Anonymous', 
        { 
          type: 'voice', 
          url: finalUrl, 
          fileName,
          duration: recording.duration 
        }
      );
    } catch (error: any) {
      alert(error.message || 'Ошибка при отправке голосового сообщения');
    } finally {
      setIsUploading(false);
    }
  };

  const handleStartCall = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || !otherUser) return;
    const participantIds = [user.uid, otherUser.uid];
    const newCallId = await callService.createCall(participantIds, user.uid);
    window.dispatchEvent(new CustomEvent('START_CALL', { detail: { callId: newCallId, isCaller: true } }));
  };

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-[#0d0d0d] overflow-hidden transition-colors duration-500">
      {/* Header */}
      <div 
        className="p-4 flex items-center justify-between border-b border-gray-100 dark:border-[#222] bg-white/80 dark:bg-[#0d0d0d]/80 backdrop-blur-md z-10 cursor-pointer group flex-shrink-0"
        onClick={() => { if (otherUser) setShowProfile(true); }}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onClose) onClose();
            }}
            className="sm:hidden p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-[#222] rounded-full transition-colors text-gray-500 flex-shrink-0"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <Avatar 
            src={otherUser?.photoURL} 
            className="w-10 h-10 border border-gray-100 dark:border-[#333] shadow-sm group-hover:opacity-80 transition-opacity flex-shrink-0" 
          />
          <div className="flex-1 min-w-0">
            <h2 className="font-medium text-[#1a1a1a] dark:text-white transition-colors truncate">
              {otherUser ? <UserName user={otherUser} /> : 'Переписка'}
            </h2>
            <AnimatePresence mode="wait">
              {isOtherTyping ? (
                <motion.div 
                  key="typing"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="text-[13px] text-blue-500 font-sans font-medium italic flex items-center gap-1"
                >
                  <span className="text-[10px] text-blue-500 dark:text-blue-400 uppercase tracking-widest font-sans font-bold italic">печатает</span>
                  <span className="flex gap-[2px] mt-1">
                    <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0 }} className="w-1 h-1 bg-blue-500 dark:bg-blue-400 rounded-full" />
                    <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1 h-1 bg-blue-500 dark:bg-blue-400 rounded-full" />
                    <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1 h-1 bg-blue-500 dark:bg-blue-400 rounded-full" />
                  </span>
                </motion.div>
              ) : (
                <motion.div 
                  key="status"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <UserStatus 
                    user={otherUser} 
                    className="text-[10px] uppercase tracking-widest font-sans font-semibold inline-block" 
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        <div className="relative flex items-center">
          {otherUser?.status === 'online' && (
            <button
              onClick={handleStartCall}
              className="p-2 mr-1 hover:bg-gray-100 dark:hover:bg-[#222] rounded-full transition-colors text-gray-400 hover:text-green-500"
            >
              <Video className="w-5 h-5" />
            </button>
          )}
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
                {!isMe && (
                  <span className="text-[10px] text-gray-400 dark:text-gray-600 ml-2 uppercase font-sans">
                    {otherUser ? <UserName user={otherUser} fallback={msg.senderName} /> : msg.senderName}
                  </span>
                )}
                <div
                  className={cn(
                    "px-4 py-2.5 rounded-2xl shadow-sm text-sm relative transition-all duration-300",
                    isMe 
                      ? "bg-[#1a1a1a] dark:bg-[#e5e5e0] text-white dark:text-black rounded-tr-none shadow-md" 
                      : "bg-white dark:bg-[#1e1e1e] border border-gray-100 dark:border-[#333] text-gray-800 dark:text-gray-200 rounded-tl-none shadow-sm",
                    (msg.type === 'image' || msg.type === 'voice' || msg.type === 'file') && "p-1.5"
                  )}
                >
                  {msg.type === 'voice' ? (
                    <VoiceMessage url={msg.url === 'p2p-sent' ? p2pFiles[msg.fileName || ''] || 'p2p-sent' : msg.url!} duration={msg.duration} isMe={isMe} />
                  ) : msg.type === 'image' || msg.type === 'file' ? (
                    msg.url === 'p2p-sent' && !p2pFiles[msg.fileName || ''] ? (
                      <div className="flex items-center gap-2 p-2 text-sm italic opacity-80">
                         <FileIcon className="w-4 h-4" />
                         <span>{isMe ? 'Файл отправлен напрямую (P2P)' : 'Файл недоступен (прямая передача)'}</span>
                      </div>
                    ) : (
                      <FileMessage type={msg.type} url={msg.url === 'p2p-sent' ? p2pFiles[msg.fileName || ''] : msg.url!} thumbnail={msg.thumbnail} fileName={msg.fileName} fileSize={msg.fileSize} isMe={isMe} />
                    )
                  ) : (
                    msg.text
                  )}
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
        {isOtherTyping && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex justify-start mt-2 mb-4"
          >
            <TypingIndicator />
          </motion.div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white dark:bg-[#0d0d0d] border-t border-gray-100 dark:border-[#222] transition-colors relative">
        {isUploading && (
          <div className="absolute bottom-full left-0 right-0 bg-white/90 dark:bg-[#0d0d0d]/90 backdrop-blur-sm px-4 py-2 border-t border-gray-100 dark:border-[#222] flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-gray-600 dark:text-gray-300 font-medium flex items-center gap-2">
                Отправка... 
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-mono font-bold">
                  {uploadMethod}
                </span>
              </span>
            </div>
            <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{uploadProgress}%</span>
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gray-100 dark:bg-gray-800">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(uploadProgress, 5)}%` }}
                transition={{ duration: 0.3 }}
                className="h-full bg-blue-500"
              />
            </div>
          </div>
        )}

        {isRecording ? (
          <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/10 p-2 rounded-[24px] border border-blue-100 dark:border-blue-900/30 transition-all">
            <div className="flex-1 flex items-center gap-3 px-3">
              <motion.div
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="w-2.5 h-2.5 rounded-full bg-red-500"
              />
              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
              </span>
              <div className="flex-1 overflow-hidden">
                <motion.div 
                  className="flex gap-1"
                  animate={{ x: [0, -20, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  {[...Array(20)].map((_, i) => (
                    <div key={i} className="w-1 h-4 bg-blue-300 dark:bg-blue-700/50 rounded-full" />
                  ))}
                </motion.div>
              </div>
            </div>
            <button 
              onClick={cancelRecording}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button 
              onClick={handleVoiceSend}
              className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-all shadow-md active:scale-95 flex items-center justify-center"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSend} className="flex items-center gap-3 bg-gray-50 dark:bg-[#1a1a1a] p-2 rounded-[24px] border border-gray-100 dark:border-[#222] focus-within:ring-2 focus-within:ring-[#5A5A40]/10 dark:focus-within:ring-[#A0A080]/10 transition-all">
            <button type="button" className="p-2 hover:bg-gray-200 dark:hover:bg-[#222] rounded-full text-gray-400 transition-colors">
              <Smile className="w-5 h-5" />
            </button>
            <input
              type="text"
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e as any);
                }
              }}
              placeholder="Напишите сообщение..."
              className="flex-1 bg-transparent border-none outline-none text-sm py-2 dark:text-white"
            />
            <div className="relative flex items-center">
              <button 
                type="button" 
                onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                className={cn(
                  "p-2 rounded-full transition-colors",
                  showAttachmentMenu ? "bg-gray-200 dark:bg-[#333] text-blue-500" : "hover:bg-gray-200 dark:hover:bg-[#222] text-gray-400"
                )}
              >
                <Paperclip className="w-5 h-5" />
              </button>
              
              <AnimatePresence>
                {showAttachmentMenu && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowAttachmentMenu(false)} />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, y: -10, x: -20 }}
                      animate={{ opacity: 1, scale: 1, y: -10, x: -20 }}
                      exit={{ opacity: 0, scale: 0.9, y: -10, x: -20 }}
                      className="absolute bottom-full mb-2 left-0 w-48 bg-white dark:bg-[#1a1a1a] rounded-xl shadow-xl border border-gray-100 dark:border-[#333] overflow-hidden z-40"
                    >
                      <button 
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        className="w-full text-left px-4 py-3 text-sm flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-[#222] transition-colors"
                      >
                        <ImageIcon className="w-4 h-4 text-blue-500" />
                        Фото или Видео
                      </button>
                      <button 
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full text-left px-4 py-3 text-sm flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-[#222] transition-colors"
                      >
                        <FileIcon className="w-4 h-4 text-purple-500" />
                        Файл
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {input.trim() || isUploading ? (
              <button 
                type="submit" 
                disabled={!input.trim() && !isUploading}
                className={cn(
                  "p-3 rounded-full transition-all shadow-md active:scale-95 flex items-center justify-center gap-1 min-w-[44px]",
                  isUploading 
                    ? "bg-gray-100 text-gray-500 cursor-not-allowed" 
                    : "bg-[#1a1a1a] dark:bg-[#e5e5e0] text-white dark:text-black hover:bg-black dark:hover:bg-white disabled:opacity-50"
                )}
              >
                {isUploading ? (
                  <span className="text-xs font-bold font-mono">{uploadProgress}%</span>
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            ) : (
              <button 
                type="button"
                onClick={startRecording}
                className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-all shadow-md active:scale-95"
              >
                <Mic className="w-4 h-4" />
              </button>
            )}

            <input 
              type="file" 
              ref={imageInputRef} 
              onChange={(e) => handleFileUpload(e, 'image')} 
              accept="image/*" 
              className="hidden" 
            />
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={(e) => handleFileUpload(e, 'file')} 
              className="hidden" 
            />
          </form>
        )}
      </div>
    </div>
  );
}
