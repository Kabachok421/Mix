import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { chatService } from '../services/chatService';
import { p2p } from '../services/p2pFirestore';
import { MAX_FILE_BYTES } from '../services/p2pCore';
import { PendingAttachments, type PendingFile } from './PendingAttachments';
import { isMediaFile } from '../lib/fileUtils';
import { Chat, Message, UserProfile, ReplyRef } from '../types';
import { MessageContextMenu, ContextMenuItem } from './ContextMenu';
import { LinkifiedText } from './LinkifiedText';
import { LinkEmbedCard } from './LinkEmbedCard';
import { useLinkPreview } from '../hooks/useLinkPreview';
import { sanitizeEmbed } from '../lib/linkUtils';
import { Send, Smile, Paperclip, MoreVertical, MessageSquare, Trash2, ChevronLeft, Mic, X, Image as ImageIcon, File as FileIcon, Loader2, Video, Cloud, Share2, Users, Info, UserPlus, UploadCloud, Reply, MoreHorizontal, Copy, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, getUserDisplayName, formatLastSeen, generateThumbnail, isUserOnline } from '../lib/utils';
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
import { MessageStatusIndicator } from './MessageStatusIndicator';
import { GroupInfoModal } from './GroupInfoModal';

interface ChatWindowProps {
  chatId: string;
  onClose?: () => void;
}

// Сообщение можно изменить в течение 10 минут после отправки (то же ограничение стоит в правилах Firestore)
const EDIT_WINDOW_MS = 10 * 60 * 1000;

export default function ChatWindow({ chatId, onClose }: ChatWindowProps) {
  const { user, profile } = useAuth();
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [groupMembersMap, setGroupMembersMap] = useState<Record<string, UserProfile>>({});
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [input, setInput] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingActiveRef = useRef(false); // «печатает» уже отправлено
  const typingSentAtRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [replyingTo, setReplyingTo] = useState<ReplyRef | null>(null);
  const [editing, setEditing] = useState<{ id: string; original: string } | null>(null);
  // Выбранные файлы: сначала лежат над полем ввода, отправляются кнопкой, к каждому можно добавить подпись
  const [pending, setPending] = useState<PendingFile[]>([]);
  // Сколько последних сообщений показано. По кнопке «Показать более ранние сообщения» растёт на 100; при смене чата сбрасывается.
  const PAGE_SIZE = 100;
  const [limitState, setLimitState] = useState({ chatId, n: PAGE_SIZE });
  const messageLimit = limitState.chatId === chatId ? limitState.n : PAGE_SIZE;
  const skipScrollRef = useRef(false); // при подгрузке старых сообщений не прокручиваем чат вниз
  // Вложение для первой ссылки в вводимом тексте (до отправки его можно открепить)
  const linkPreview = useLinkPreview(input, !editing);

  // В другом чате ответ не переносим
  useEffect(() => {
    setReplyingTo(null);
  }, [chatId]);
  
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounter = useRef(0);
  const { isRecording, duration, startRecording, stopRecording, cancelRecording } = useVoiceRecorder();

  const handleDeleteChat = async () => {
    if (!user) return;
    if (currentChat?.isGroup) {
      const isCreator = user.uid === currentChat.createdBy;
      if (isCreator) {
        if (window.confirm(`Вы уверены, что хотите удалить группу «${currentChat.groupName || 'Группа'}» для всех? Это действие нельзя отменить.`)) {
          await chatService.deleteChat(chatId);
          if (onClose) onClose();
        }
      } else {
        if (window.confirm('Вы уверены, что хотите покинуть эту группу?')) {
          const updated = currentChat.participantIds.filter(id => id !== user.uid);
          const userName = getUserDisplayName(profile as UserProfile) || user.displayName || 'Участник';
          await chatService.updateGroupChat(chatId, {
            participantIds: updated,
            systemMessage: `${userName} покинул(а) группу`,
            senderId: user.uid,
            senderName: userName
          });
          if (onClose) onClose();
        }
      }
    } else {
      if (window.confirm('Вы уверены, что хотите удалить чат? Это действие нельзя отменить.')) {
        await chatService.deleteChat(chatId);
        if (onClose) onClose();
      }
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

    // Load messages and automatically mark as read
    const unsubscribeMessages = chatService.subscribeToMessages(chatId, (newMessages) => {
      setMessages(newMessages);
      chatService.markMessagesAsRead(chatId, user.uid, newMessages);
    }, messageLimit);

    const memberUnsubs: Record<string, () => void> = {};

    // Load chat metadata
    const unsubscribeChat = chatService.subscribeToChat(chatId, (chatData) => {
      if (chatData) {
        setCurrentChat(chatData);
        // Subscribe to all participants' profiles
        chatData.participantIds?.forEach(uid => {
          if (!memberUnsubs[uid]) {
            memberUnsubs[uid] = chatService.subscribeToUserProfile(uid, (p) => {
              if (p) setGroupMembersMap(prev => ({ ...prev, [uid]: p }));
            });
          }
        });
      }
    });

    // 1-on-1 other user info
    const participantIds = chatId.split('_');
    const otherUserId = participantIds.find(id => id !== user.uid);

    let unsubscribeProfile: (() => void) | undefined;
    let unsubscribeTyping: (() => void) | undefined;
    if (otherUserId && !chatId.startsWith('group_')) {
      unsubscribeProfile = chatService.subscribeToUserProfile(otherUserId, (profile) => {
        setOtherUser(profile);
      });
      unsubscribeTyping = chatService.subscribeToTyping(chatId, otherUserId, (typing) => {
        setIsOtherTyping(typing);
      });
    }

    // Subscribe to incoming P2P transfers

    return () => {
      unsubscribeMessages();
      unsubscribeChat();
      Object.values(memberUnsubs).forEach(unsub => unsub());
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeTyping) unsubscribeTyping();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (typingActiveRef.current) {
        typingActiveRef.current = false;
        chatService.setTypingStatus(chatId, user.uid, false);
      }
    };
  }, [chatId, user, messageLimit]);

  useEffect(() => {
    if (skipScrollRef.current) {
      skipScrollRef.current = false;
      return;
    }
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    
    if (user && chatId && !editing) {
      // «Печатает» пишем в Firestore один раз, а не на каждую клавишу (экономит дневной лимит записей).
      // Повтор раз в 5 секунд, пока человек печатает: собеседник считает признак свежим 10 секунд.
      const now = Date.now();
      if (!typingActiveRef.current || now - typingSentAtRef.current > 5000) {
        typingActiveRef.current = true;
        typingSentAtRef.current = now;
        chatService.setTypingStatus(chatId, user.uid, true);
      }

      // Сбрасываем признак после 3 секунд без ввода (одна запись)
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        if (typingActiveRef.current) {
          typingActiveRef.current = false;
          chatService.setTypingStatus(chatId, user.uid, false);
        }
      }, 3000);
    }
  };

  // --- Контекстное меню сообщения (правый клик, кнопка «⋯», долгое нажатие) ---
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);
  const longPressRef = useRef<number | null>(null);

  useEffect(() => {
    setCtxMenu(null);
    setEditing(null);
    setPending((prev) => {
      prev.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl));
      return [];
    });
  }, [chatId]);

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {
        // буфер обмена недоступен
      }
      document.body.removeChild(ta);
    }
  };

  // Изменить можно только свой текст и только в течение 10 минут после отправки
  const canEdit = (msg: Message): boolean => {
    if (msg.senderId !== user?.uid || msg.type !== 'text' || !msg.text) return false;
    const sentAt = msg.timestamp?.toMillis ? msg.timestamp.toMillis() : null;
    return sentAt !== null && Date.now() - sentAt < EDIT_WINDOW_MS;
  };

  const startEdit = (msg: Message) => {
    setReplyingTo(null);
    setEditing({ id: msg.id, original: msg.text || '' });
    setInput(msg.text || '');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const cancelEdit = () => {
    setEditing(null);
    setInput('');
  };

  const menuItemsFor = (msg: Message): ContextMenuItem[] => {
    const items: ContextMenuItem[] = [
      { id: 'reply', label: 'Ответить', icon: <Reply className="w-4 h-4" />, onClick: () => startReply(msg) },
    ];
    const selected = window.getSelection()?.toString().trim();
    const copyable = selected || (msg.type === 'text' ? msg.text || '' : '');
    if (copyable) {
      items.push({
        id: 'copy',
        label: selected ? 'Копировать выделенное' : 'Копировать текст',
        icon: <Copy className="w-4 h-4" />,
        onClick: () => void copyText(copyable),
      });
    }
    if (canEdit(msg)) {
      items.push({ id: 'edit', label: 'Изменить', icon: <Pencil className="w-4 h-4" />, onClick: () => startEdit(msg) });
    }
    if (msg.senderId === user?.uid) {
      items.push({
        id: 'delete',
        label: 'Удалить',
        icon: <Trash2 className="w-4 h-4" />,
        danger: true,
        onClick: () => void handleDeleteMessage(msg.id),
      });
    }
    return items;
  };

  const openMessageMenu = (msg: Message, x: number, y: number) => setCtxMenu({ x, y, items: menuItemsFor(msg) });

  const cancelLongPress = () => {
    if (longPressRef.current !== null) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  };

  const startLongPress = (msg: Message, e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    const { clientX, clientY } = t;
    cancelLongPress();
    longPressRef.current = window.setTimeout(() => {
      longPressRef.current = null;
      openMessageMenu(msg, clientX, clientY);
    }, 500);
  };

  // --- Ответ на сообщение ---
  const replyNameOf = (m: Message): string => {
    if (m.senderId === user?.uid) {
      return getUserDisplayName(profile as UserProfile) || user?.displayName || m.senderName || 'Вы';
    }
    const p = groupMembersMap[m.senderId] || (otherUser && otherUser.uid === m.senderId ? otherUser : null);
    return (p ? getUserDisplayName(p as UserProfile) : '') || m.senderName || 'Пользователь';
  };

  const replyPreview = (m: Message): string => {
    if (m.type === 'image') return '📷 Фото';
    if (m.type === 'voice') return '🎤 Голосовое сообщение';
    if (m.type === 'file') return `📁 ${m.fileName || 'Файл'}`;
    return (m.text || '').slice(0, 120);
  };

  const startReply = (m: Message) => {
    setReplyingTo({ id: m.id, senderId: m.senderId, senderName: replyNameOf(m), text: replyPreview(m), type: m.type });
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const jumpToMessage = (id: string) => {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return; // оригинал удалён или ещё не загружен
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.remove('msg-flash');
    void el.offsetWidth; // перезапуск анимации
    el.classList.add('msg-flash');
    setTimeout(() => el.classList.remove('msg-flash'), 1400);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && pending.length === 0) || !user) return;

    const text = input.trim();

    // Режим правки: отправляем изменение, а не новое сообщение
    if (editing) {
      const target = editing;
      if (text === target.original.trim()) {
        cancelEdit();
        return;
      }
      const original = messages.find((m) => m.id === target.id);
      if (original && !canEdit(original)) {
        setUploadError('Время редактирования истекло: сообщение можно изменить в течение 10 минут');
        cancelEdit();
        return;
      }
      setEditing(null);
      setInput('');
      try {
        await chatService.editMessage(chatId, target.id, text, messages[messages.length - 1]?.id === target.id);
      } catch (err: any) {
        setUploadError(err?.message || 'Не удалось изменить сообщение');
      }
      return;
    }

    // Есть выбранные файлы: отправляем их (текст из поля ввода станет подписью к первому)
    if (pending.length > 0) {
      await sendPendingFiles(text);
      return;
    }

    const reply = replyingTo;
    setInput('');
    setReplyingTo(null);
    
    // Убираем «печатает» сразу, но только если оно было отправлено
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (typingActiveRef.current) {
      typingActiveRef.current = false;
      chatService.setTypingStatus(chatId, user.uid, false);
    }

    await chatService.sendMessage(chatId, user.uid, getUserDisplayName(profile as UserProfile) || user.displayName || 'Anonymous', { text, type: 'text', replyTo: reply || undefined, embed: linkPreview.embed || undefined });
  };

  // --- Вложения ---
  const MAX_FILES = 10;
  const revokePreview = (p: PendingFile) => p.previewUrl && URL.revokeObjectURL(p.previewUrl);

  const addFiles = (files: File[]) => {
    if (!files.length) return;
    const problems: string[] = [];
    const room = MAX_FILES - pending.length;
    const accepted: PendingFile[] = [];
    for (const file of files) {
      if (file.size === 0) problems.push(`${file.name}: файл пустой`);
      else if (file.size > MAX_FILE_BYTES) problems.push(`${file.name}: больше 10 ГБ`);
      else if (accepted.length >= room) {
        if (!problems.some((x) => x.startsWith('Не больше'))) problems.push(`Не больше ${MAX_FILES} файлов за раз`);
      } else {
        accepted.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          caption: '',
          previewUrl: file.type.startsWith('image/') && file.size < 30 * 1024 * 1024 ? URL.createObjectURL(file) : null,
        });
      }
    }
    if (accepted.length) setPending((prev) => [...prev, ...accepted]);
    if (problems.length) {
      setUploadError(problems.join('. '));
      setTimeout(() => setUploadError(null), 6000);
    } else {
      setUploadError(null);
    }
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const removePending = (id: string) =>
    setPending((prev) => {
      const gone = prev.find((p) => p.id === id);
      if (gone) revokePreview(gone);
      return prev.filter((p) => p.id !== id);
    });
  const clearPending = () => {
    pending.forEach(revokePreview);
    setPending([]);
  };
  const setCaption = (id: string, caption: string) => setPending((prev) => prev.map((p) => (p.id === id ? { ...p, caption } : p)));

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || []);
    e.target.value = ''; // чтобы тот же файл можно было выбрать повторно
    addFiles(list);
  };

  // Отправка вложений: в чат уходит описание файла (имя, размер, превью, подпись), а сам файл остаётся у вас и
  // передаётся получателю напрямую, когда он нажмёт «Скачать»
  const sendPendingFiles = async (mainText: string) => {
    if (!user) return;
    const items = pending;
    const reply = replyingTo;
    setPending([]);
    setInput('');
    setReplyingTo(null);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (typingActiveRef.current) {
      typingActiveRef.current = false;
      chatService.setTypingStatus(chatId, user.uid, false);
    }
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      revokePreview(it);
      const caption = (it.caption.trim() || (i === 0 ? mainText : '')).slice(0, 1000);
      try {
        let thumbnail: string | undefined;
        if (it.file.type.startsWith('image/')) {
          try {
            thumbnail = await generateThumbnail(it.file, 360, 360);
          } catch {
            thumbnail = undefined; // без превью
          }
        }
        const id = await chatService.sendMessage(chatId, user.uid, getUserDisplayName(profile as UserProfile) || user.displayName || 'Anonymous', {
          type: isMediaFile(it.file) ? 'image' : 'file',
          url: 'p2p',
          p2p: true,
          fileName: it.file.name,
          fileSize: it.file.size,
          mimeType: it.file.type || 'application/octet-stream',
          thumbnail,
          text: caption || undefined,
          replyTo: i === 0 ? reply || undefined : undefined,
        });
        if (id) p2p.host.register(chatId, id, it.file);
      } catch (err: any) {
        setUploadError(`Не удалось отправить «${it.file.name}»: ${err?.message || 'ошибка'}`);
        setTimeout(() => setUploadError(null), 6000);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const pastedFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const file = items[i].getAsFile();
        if (file) pastedFiles.push(file);
      }
    }
    if (pastedFiles.length > 0) {
      e.preventDefault();
      addFiles(pastedFiles);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    const hasFiles = e.dataTransfer.types ? Array.from(e.dataTransfer.types).includes('Files') : false;
    if (hasFiles || (e.dataTransfer.items && e.dataTransfer.items.length > 0)) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDraggingOver(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDraggingOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files) as File[];
      addFiles(droppedFiles);
    }
  };

  const handleVoiceSend = async () => {
    const recording = await stopRecording();
    if (!recording || !user) return;

    try {
      setUploadError(null);
      // Голосовое хранится прямо в сообщении, поэтому оно приходит сразу, даже если вы потом выйдете из сети
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Не удалось прочитать запись'));
        reader.readAsDataURL(recording.blob);
      });
      if (dataUrl.length > 900_000) throw new Error('Голосовое сообщение слишком длинное. Максимум около 3 минут.');

      await chatService.sendMessage(
        chatId,
        user.uid,
        getUserDisplayName(profile as UserProfile) || user.displayName || 'Anonymous',
        {
          type: 'voice',
          url: dataUrl,
          fileName: `voice_${Date.now()}.webm`,
          duration: recording.duration,
          replyTo: replyingTo || undefined,
        }
      );
      setReplyingTo(null);
    } catch (error: any) {
      console.error('Voice send failed:', error);
      setUploadError(error?.message || 'Ошибка при отправке голосового сообщения');
      setTimeout(() => setUploadError(null), 4000);
    }
  };

  const handleStartCall = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || !otherUser) return;
    const participantIds = [user.uid, otherUser.uid];
    const newCallId = await callService.createCall(participantIds, user.uid);
    window.dispatchEvent(new CustomEvent('START_CALL', { detail: { callId: newCallId, isCaller: true } }));
  };

  const renderGroupHeaderAvatar = () => {
    const avatar = currentChat?.groupAvatar;
    if (avatar?.startsWith('preset:')) {
      const [, emoji, bg] = avatar.split(':');
      return (
        <div className={`w-10 h-10 rounded-2xl ${bg} flex items-center justify-center text-lg shadow-sm border border-white/40 dark:border-white/10 shrink-0`}>
          {emoji}
        </div>
      );
    }
    if (avatar) {
      return (
        <img src={avatar} alt={currentChat?.groupName} className="w-10 h-10 rounded-2xl object-cover shadow-sm shrink-0" />
      );
    }
    return (
      <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-sm shrink-0">
        <Users className="w-5 h-5" />
      </div>
    );
  };

  const isGroup = !!currentChat?.isGroup;
  const onlineCount = (Object.values(groupMembersMap) as UserProfile[]).filter(m => isUserOnline(m)).length;

  return (
    <div 
      className="flex-1 min-w-0 flex flex-col bg-white dark:bg-[#0d0d0d] overflow-hidden transition-colors duration-500 relative"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag & Drop Visual Overlay with Rich Animations */}
      <AnimatePresence>
        {isDraggingOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className="absolute inset-0 z-50 p-4 sm:p-8 flex items-center justify-center bg-blue-600/15 dark:bg-blue-500/20 backdrop-blur-md cursor-pointer"
          >
            <motion.div
              initial={{ scale: 0.88, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 10 }}
              transition={{ type: "spring", damping: 22, stiffness: 320 }}
              className="w-full max-w-md bg-white/95 dark:bg-[#161616]/95 border-2 border-dashed border-blue-500 dark:border-blue-400 rounded-3xl p-7 shadow-2xl flex flex-col items-center text-center relative overflow-hidden backdrop-saturate-150"
            >
              {/* Radial gradient ambient lights */}
              <div className="absolute -top-12 -right-12 w-40 h-40 bg-blue-500/20 rounded-full blur-2xl" />
              <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-indigo-500/20 rounded-full blur-2xl" />

              {/* Animated Floating Upload Icon with Pulsing Rings */}
              <div className="relative mb-5 flex items-center justify-center">
                <motion.div
                  animate={{ scale: [1, 1.45, 1], opacity: [0.35, 0, 0.35] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                  className="absolute w-24 h-24 rounded-full bg-blue-500/25"
                />
                <motion.div
                  animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0.1, 0.5] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut", delay: 0.3 }}
                  className="absolute w-20 h-20 rounded-full bg-blue-500/30"
                />
                <motion.div
                  animate={{ y: [0, -7, 0] }}
                  transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                  className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 via-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/40"
                >
                  <UploadCloud className="w-8 h-8 stroke-[2.2]" />
                </motion.div>
              </div>

              <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                Отпустите файлы для отправки
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 max-w-xs leading-relaxed">
                Файлы будут автоматически загружены и добавлены в диалог
              </p>

              {/* Supported format badges */}
              <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
                <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/40 flex items-center gap-1.5">
                  <ImageIcon className="w-3 h-3" />
                  Фото и видео
                </span>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-900/40 flex items-center gap-1.5">
                  <FileIcon className="w-3 h-3" />
                  Документы
                </span>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 border border-purple-200/60 dark:border-purple-900/40 flex items-center gap-1.5">
                  <Cloud className="w-3 h-3" />
                  До 100 МБ
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div 
        className="absolute top-3 left-3 right-3 z-20 isolate px-4 py-3 rounded-[28px] flex items-center justify-between cursor-pointer group"
        onClick={() => { 
          if (isGroup) {
            setShowGroupInfo(true);
          } else if (otherUser) {
            setShowProfile(true); 
          }
        }}
      >
        <div aria-hidden="true" className="glass-bar absolute inset-0 -z-10 rounded-[28px] pointer-events-none" />
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
          
          {isGroup ? (
            renderGroupHeaderAvatar()
          ) : (
            <Avatar 
              src={otherUser?.photoURL} 
              className="w-10 h-10 border border-gray-100 dark:border-[#333] shadow-sm group-hover:opacity-80 transition-opacity flex-shrink-0" 
            />
          )}

          <div className="flex-1 min-w-0">
            <h2 className="font-medium text-[#1a1a1a] dark:text-white transition-colors truncate">
              {isGroup ? (currentChat.groupName || 'Групповой чат') : (otherUser ? <UserName user={otherUser} /> : 'Переписка')}
            </h2>
            <AnimatePresence mode="wait">
              {isGroup ? (
                <div className="text-[10px] text-gray-400 font-sans font-medium uppercase tracking-wider flex items-center gap-1.5">
                  <span>{currentChat.participantIds?.length || 0} участников</span>
                  {onlineCount > 0 && (
                    <span className="text-emerald-500 font-semibold">• {onlineCount} в сети</span>
                  )}
                </div>
              ) : isOtherTyping ? (
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
          {isGroup ? (
            <button
              onClick={(e) => { e.stopPropagation(); setShowGroupInfo(true); }}
              className="p-2 mr-1 hover:bg-gray-100 dark:hover:bg-[#222] rounded-full transition-colors text-gray-400 hover:text-blue-500"
              title="Информация о группе"
            >
              <Users className="w-5 h-5" />
            </button>
          ) : (otherUser && isUserOnline(otherUser)) ? (
            <button
              onClick={handleStartCall}
              className="p-2 mr-1 hover:bg-gray-100 dark:hover:bg-[#222] rounded-full transition-colors text-gray-400 hover:text-green-500"
            >
              <Video className="w-5 h-5" />
            </button>
          ) : null}

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
                  {isGroup && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                        setShowGroupInfo(true);
                      }}
                      className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#222] transition-colors flex items-center gap-2 border-b border-gray-100 dark:border-[#2a2a2a]"
                    >
                      <Info className="w-4 h-4 text-blue-500" />
                      О группе
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      handleDeleteChat();
                    }}
                    className="w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    {isGroup 
                      ? (user?.uid === currentChat?.createdBy ? 'Удалить группу' : 'Покинуть группу') 
                      : 'Удалить друга'}
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

      <AnimatePresence>
        {showGroupInfo && currentChat && (
          <GroupInfoModal
            chat={currentChat}
            onClose={() => setShowGroupInfo(false)}
            onLeaveGroup={() => { if (onClose) onClose(); }}
          />
        )}
      </AnimatePresence>

      {/* Messages */}
      <div className={cn("chat-surface flex-1 min-w-0 overflow-y-auto overflow-x-hidden flex flex-col px-3 sm:px-4 pt-24 space-y-4 bg-[#fafafa] dark:bg-[#080808] custom-scrollbar", "pb-28")}
            style={{ paddingBottom: 112 + ((replyingTo || editing) ? 64 : 0) + ((linkPreview.embed || linkPreview.loading) && pending.length === 0 ? (linkPreview.embed?.image ? 168 : 112) : 0) + (pending.length > 0 ? 96 + Math.min(pending.length, 3) * 70 : 0) }}>
        {messages.length >= messageLimit && (
          <button
            type="button"
            onClick={() => {
              skipScrollRef.current = true;
              setLimitState({ chatId, n: messageLimit + PAGE_SIZE });
            }}
            className="self-center shrink-0 px-4 py-1.5 rounded-full text-xs font-medium bg-black/5 dark:bg-white/10 text-gray-600 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/15 transition-colors"
          >
            Показать более ранние сообщения
          </button>
        )}

        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-300 dark:text-gray-700 gap-4">
            <div className="w-20 h-20 rounded-full bg-gray-50 dark:bg-[#111] flex items-center justify-center border border-gray-100 dark:border-[#222] shadow-inner">
              <MessageSquare className="w-8 h-8" />
            </div>
            <p className="italic font-light">Напишите первое сообщение...</p>
          </div>
        ) : (
          messages.map((msg) => {
            // System message render
            if (msg.type === 'system') {
              return (
                <div key={msg.id} className="flex justify-center my-2">
                  <span className="px-3.5 py-1 rounded-full text-xs bg-gray-100 dark:bg-[#1c1c1c] text-gray-600 dark:text-gray-300 border border-gray-200/60 dark:border-[#2e2e2e] shadow-xs text-center font-medium max-w-[90%]">
                    {msg.text}
                  </span>
                </div>
              );
            }

            const isMe = msg.senderId === user?.uid;
            const senderProfile = groupMembersMap[msg.senderId];
            const senderDisplayName = senderProfile?.customName || senderProfile?.displayName || msg.senderName;
            // У текста время стоит в углу рядом с последней строкой, у файлов, фото и голосовых под содержимым
            const embed = sanitizeEmbed(msg.embed);
            const inlineMeta = msg.type !== 'voice' && msg.type !== 'image' && msg.type !== 'file' && !embed;

            return (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                key={msg.id}
                id={`msg-${msg.id}`}
                className={cn(
                  "group/msg flex flex-col min-w-0 max-w-[85%] sm:max-w-[80%] gap-1",
                  isMe ? "self-end items-end" : "self-start items-start"
                )}
              >
                {!isMe && (
                  <div className="flex items-center gap-1.5 ml-2 select-none">
                    {isGroup && (
                      <Avatar 
                        src={senderProfile?.photoURL} 
                        className="w-4 h-4 rounded-full border border-gray-200 dark:border-[#333]" 
                      />
                    )}
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-sans font-medium">
                      {isGroup 
                        ? senderDisplayName 
                        : (otherUser ? <UserName user={otherUser} fallback={msg.senderName} /> : msg.senderName)}
                    </span>
                  </div>
                )}
                <div
                  onContextMenu={(e) => {
                    e.preventDefault();
                    openMessageMenu(msg, e.clientX, e.clientY);
                  }}
                  onTouchStart={(e) => startLongPress(msg, e)}
                  onTouchMove={cancelLongPress}
                  onTouchEnd={cancelLongPress}
                  onTouchCancel={cancelLongPress}
                  className={cn(
                    "px-3.5 py-2 rounded-2xl shadow-sm text-sm leading-snug relative min-w-0 max-w-full transition-all duration-300",
                    isMe 
                      ? "msg-mine bg-[#1a1a1a] dark:bg-[#e5e5e0] text-white dark:text-black rounded-tr-none shadow-md" 
                      : "msg-theirs bg-white dark:bg-[#1e1e1e] border border-gray-100 dark:border-[#333] text-gray-800 dark:text-gray-200 rounded-tl-none shadow-sm",
                    (msg.type === 'image' || msg.type === 'voice' || msg.type === 'file') && "p-1.5"
                  )}
                >
                  {msg.replyTo && (
                    <button
                      type="button"
                      onClick={() => jumpToMessage(msg.replyTo!.id)}
                      className="block w-full text-left mb-1.5 pl-2.5 pr-2 py-1 rounded-lg overflow-hidden"
                      style={{ background: 'color-mix(in srgb, currentColor 14%, transparent)', borderLeft: '3px solid currentColor' }}
                    >
                      <span className="block text-[11px] font-semibold opacity-90 truncate">
                        {msg.replyTo.senderId === user?.uid ? 'Вы' : msg.replyTo.senderName}
                      </span>
                      <span className="block text-xs opacity-75 truncate">{msg.replyTo.text}</span>
                    </button>
                  )}
                  {msg.type === 'voice' ? (
                    <VoiceMessage url={msg.url!} duration={msg.duration} isMe={isMe} />
                  ) : msg.type === 'image' || msg.type === 'file' ? (
                    <FileMessage message={msg} chatId={chatId} isMe={isMe} />
                  ) : (
                    <span className="whitespace-pre-wrap [overflow-wrap:anywhere]"><LinkifiedText text={msg.text || ''} /></span>
                  )}
                  {embed && <LinkEmbedCard embed={embed} className="mt-2" />}
                  {/* Пустое место под время: если в последней строке текста нет места, время уходит на новую строку */}
                  {inlineMeta && <span aria-hidden="true" className={cn("inline-block h-0 select-none", isMe ? (msg.editedAt ? "w-[88px]" : "w-14") : (msg.editedAt ? "w-[72px]" : "w-10"))} />}
                  <div className={cn(
                    "msg-meta select-none flex flex-row items-center text-[10px] font-sans leading-none gap-1",
                    inlineMeta ? "absolute bottom-[7px] right-3.5" : "justify-end mt-1 text-right",
                    isMe ? "text-white/80 dark:text-black/80" : "text-gray-400 dark:text-gray-500"
                  )}>
                    {msg.editedAt && <span title="Сообщение изменено">изм.</span>}
                    <span>{msg.timestamp && format(msg.timestamp.toDate(), 'HH:mm', { locale: ru })}</span>
                    {isMe && (
                      <MessageStatusIndicator
                        message={msg}
                        currentUserId={user.uid}
                        totalParticipants={currentChat?.participantIds?.length || 2}
                        isDarkBubble={isMe}
                      />
                    )}
                  </div>
                </div>
              </motion.div>
            );
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
      <div className="absolute bottom-0 left-0 right-0 z-20 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {uploadError && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-2 p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-center justify-between"
          >
            <span>{uploadError}</span>
            <button type="button" onClick={() => setUploadError(null)} className="p-0.5 hover:text-red-700 dark:hover:text-red-300">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}

        {!isRecording && !editing && (
          <PendingAttachments
            items={pending}
            onCaption={setCaption}
            onRemove={removePending}
            onAddMore={() => fileInputRef.current?.click()}
            onClear={clearPending}
            onSend={() => handleSend({ preventDefault() {} } as React.FormEvent)}
          />
        )}

        {(linkPreview.embed || linkPreview.loading) && !isRecording && !editing && pending.length === 0 && (
          <div className="mb-2 flex justify-start">
            <LinkEmbedCard embed={linkPreview.embed} loading={linkPreview.loading} onDismiss={linkPreview.dismiss} className="embed-compose" />
          </div>
        )}

        {editing && !isRecording && (
          <div className="relative isolate flex items-center gap-3 mb-2 pl-4 pr-2 py-2 rounded-[22px]">
            <div aria-hidden="true" className="glass-bar absolute inset-0 -z-10 rounded-[22px] pointer-events-none" />
            <Pencil className="w-4 h-4 text-blue-500 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-blue-500 truncate">Редактирование сообщения</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{editing.original}</p>
            </div>
            <button
              type="button"
              onClick={cancelEdit}
              aria-label="Отменить редактирование"
              className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-gray-400 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {replyingTo && !isRecording && (
          <div className="relative isolate flex items-center gap-3 mb-2 pl-4 pr-2 py-2 rounded-[22px]">
            <div aria-hidden="true" className="glass-bar absolute inset-0 -z-10 rounded-[22px] pointer-events-none" />
            <Reply className="w-4 h-4 text-blue-500 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-blue-500 truncate">Ответ: {replyingTo.senderId === user?.uid ? 'себе' : replyingTo.senderName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{replyingTo.text}</p>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              aria-label="Отменить ответ"
              className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-gray-400 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
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
          <form onSubmit={handleSend} className="relative isolate flex items-center gap-3 p-2 rounded-[28px] transition-all">
            <div aria-hidden="true" className="glass-bar absolute inset-0 -z-10 rounded-[28px] pointer-events-none" />
            <button type="button" className="p-2 hover:bg-gray-200 dark:hover:bg-[#222] rounded-full text-gray-400 transition-colors">
              <Smile className="w-5 h-5" />
            </button>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={handleInputChange}
              onPaste={handlePaste}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && (replyingTo || editing)) {
                  if (editing) cancelEdit();
                  else setReplyingTo(null);
                  return;
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e as any);
                }
              }}
              placeholder="Напишите сообщение..."
              className="flex-1 min-w-0 w-full bg-transparent border-none outline-none text-base sm:text-sm py-2 dark:text-white"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Прикрепить файл"
              aria-label="Прикрепить файл"
              className={cn(
                "p-2 rounded-full transition-colors shrink-0",
                pending.length > 0 ? "text-blue-500 bg-blue-500/10" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10"
              )}
            >
              <Paperclip className="w-5 h-5" />
            </button>

            {input.trim() || pending.length > 0 ? (
              <button 
                type="submit" 
                disabled={!input.trim() && pending.length === 0}
                className="p-3 rounded-full transition-all shadow-md active:scale-95 flex items-center justify-center gap-1 min-w-[44px] bg-[#1a1a1a] dark:bg-[#e5e5e0] text-white dark:text-black hover:bg-black dark:hover:bg-white disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
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
          </form>
        )}
      </div>

      <AnimatePresence>
        {ctxMenu && (
          <MessageContextMenu
            key={`${ctxMenu.x}-${ctxMenu.y}`}
            x={ctxMenu.x}
            y={ctxMenu.y}
            items={ctxMenu.items}
            onClose={() => setCtxMenu(null)}
          />
        )}
      </AnimatePresence>

      {/* Выбор файлов: любые типы, несколько сразу */}
      <input type="file" ref={fileInputRef} onChange={handleFilePick} multiple className="hidden" />
    </div>
  );
}
