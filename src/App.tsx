import { useState, useEffect, useRef } from 'react';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import Login from './components/Login';
import ChatList from './components/ChatList';
import ChatWindow from './components/ChatWindow';
import UserSearch from './components/UserSearch';
import SetupProfile from './components/SetupProfile';
import AdminPanel from './components/AdminPanel';
import { CreateGroupModal } from './components/CreateGroupModal';
import { ChangelogModal } from './components/ChangelogModal';
import { LogOut, MessageSquare, Settings, User as UserIcon, Moon, Sun, X, Shield, Bell, Users, Plus, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

import { Avatar } from './components/Avatar';
import { CallManager } from './components/CallManager';
import { UserName } from './components/UserName';
import { InAppNotificationToast } from './components/InAppNotificationToast';
import { NotificationSettings } from './components/NotificationSettings';
import SettingsPanel from './components/SettingsPanel';
import { useUpdater } from './hooks/useUpdater';
import { notificationService } from './services/notificationService';
import { chatService } from './services/chatService';
import { UserProfile } from './types';

export default function App() {
  const { user, profile, loading, isOffline, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const updater = useUpdater();
  // Есть новая версия или она уже скачана: показываем точку на шестерёнке
  const updateReady = updater.state?.phase === 'available' || updater.state?.phase === 'downloaded';
  // Версия установленного приложения (в браузере её нет, и номер нигде не показывается)
  const installedVersionLabel = updater.state?.currentVersion ? `Mix ${updater.state.currentVersion}` : undefined;
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<'profile' | 'admin'>('profile');
  const [showChangelog, setShowChangelog] = useState(false);
  
  const isAdmin = user?.email === 'kko593764@gmail.com';

  const lastKnownTimestampsRef = useRef<Record<string, number>>({});
  const isInitialLoadRef = useRef(true);
  const userProfilesCacheRef = useRef<Record<string, UserProfile>>({});

  // When activeChatId changes or window gets focus, clear title flashing
  useEffect(() => {
    notificationService.clearTitleFlash();
  }, [activeChatId]);

  // Global listener for incoming messages to trigger notifications
  useEffect(() => {
    if (!user) return;

    const unsubscribeChats = chatService.subscribeToChats(user.uid, (chats) => {
      if (isInitialLoadRef.current) {
        // Record existing timestamps so we don't notify for past messages
        chats.forEach(c => {
          if (c.updatedAt) {
            lastKnownTimestampsRef.current[c.id] = c.updatedAt.toMillis();
          }
        });
        isInitialLoadRef.current = false;
        return;
      }

      for (const chat of chats) {
        const chatTime = chat.updatedAt ? chat.updatedAt.toMillis() : 0;
        const prevTime = lastKnownTimestampsRef.current[chat.id] || 0;

        if (chatTime > prevTime) {
          lastKnownTimestampsRef.current[chat.id] = chatTime;

          // Check if this was sent by someone else
          if (chat.lastMessageSenderId && chat.lastMessageSenderId !== user.uid) {
            const isGroupChat = chat.isGroup;
            let senderName = chat.lastMessageSenderName || 'Собеседник';
            let senderAvatar: string | undefined = undefined;

            if (isGroupChat) {
              senderName = chat.groupName 
                ? `${chat.lastMessageSenderName ? `${chat.lastMessageSenderName} в «${chat.groupName}»` : chat.groupName}`
                : (chat.lastMessageSenderName || 'Группа');
            } else {
              const otherUserId = chat.participantIds.find(id => id !== user.uid);
              const cachedProfile = otherUserId ? userProfilesCacheRef.current[otherUserId] : null;
              senderName = chat.lastMessageSenderName || cachedProfile?.displayName || cachedProfile?.username || 'Собеседник';
              senderAvatar = cachedProfile?.photoURL;

              if (otherUserId && !cachedProfile) {
                chatService.getUserProfile(otherUserId).then(p => {
                  if (p) userProfilesCacheRef.current[otherUserId] = p;
                }).catch(() => {});
              }
            }

            const text = chat.lastMessage || 'Новое сообщение';

            notificationService.notifyNewMessage({
              chatId: chat.id,
              senderName,
              senderAvatar,
              text,
              isCurrentChatActive: activeChatId === chat.id,
              onOpenChat: (id) => setActiveChatId(id)
            });
          }
        }
      }
    });

    return () => {
      unsubscribeChats();
    };
  }, [user, activeChatId]);

  if (loading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#f5f5f0] dark:bg-[#0a0a0a] transition-colors duration-500">
        <div className="relative flex items-center justify-center">
          <motion.div 
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="w-16 h-16 rounded-full bg-[#5A5A40]/20 dark:bg-[#A0A080]/20 blur-xl absolute"
          />
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-10 h-10 border-4 border-[#5A5A40]/20 dark:border-[#A0A080]/20 border-t-[#5A5A40] dark:border-t-[#A0A080] rounded-full relative z-10"
          />
          <MessageSquare className="w-4 h-4 text-[#5A5A40] dark:text-[#A0A080] absolute z-20" />
        </div>
        {isOffline && (
          <motion.p 
            initial={{ opacity: 0, y: 5 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="mt-6 text-sm text-[#5A5A40] dark:text-[#A0A080] max-w-[200px] text-center font-medium"
          >
            Подключение к серверу...
          </motion.p>
        )}
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (!profile || !profile.username) {
    return (
      <div className="fixed inset-0 flex bg-[#f5f5f0] dark:bg-[#050505] p-0 sm:p-4 transition-colors duration-500 font-sans">
        <SetupProfile />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex bg-[#f5f5f0] dark:bg-[#050505] overflow-hidden p-0 sm:p-4 transition-colors duration-500 font-sans">
      <CallManager />
      <InAppNotificationToast onOpenChat={(chatId) => setActiveChatId(chatId)} />
      <div className="flex-1 flex max-w-6xl mx-auto w-full bg-white dark:bg-[#111111] sm:rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden border border-[#e5e5e0] dark:border-[#222] transition-colors relative">
        
        {/* Sidebar */}
        <aside className={cn(
          "w-full sm:w-[300px] flex-col border-r border-gray-100 dark:border-[#222] h-full relative z-20",
          activeChatId ? "hidden sm:flex" : "flex"
        )}>
          <div className="p-6 flex items-center justify-between">
            <h1 className="text-2xl font-serif text-[#1a1a1a] dark:text-white">Mix</h1>
            <div className="flex items-center gap-1.5">
               <button 
                  onClick={() => setShowCreateGroup(true)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-[#222] rounded-full transition-colors text-gray-500 dark:text-gray-400 active:scale-95 flex items-center justify-center hover:text-blue-500 dark:hover:text-blue-400"
                  title="Создать группу"
               >
                <Users className="w-5 h-5" />
              </button>
               <button 
                  onClick={() => setShowSettings(true)}
                  className="relative p-2 hover:bg-gray-100 dark:hover:bg-[#222] rounded-full transition-colors text-gray-500 dark:text-gray-400 active:scale-95"
                  title={updateReady ? 'Настройки: есть обновление' : 'Настройки'}
               >
                <Settings className="w-5 h-5" />
                {updateReady && (
                  <span className="absolute top-1.5 right-1.5 flex w-2.5 h-2.5" aria-label="Есть обновление">
                    <span className="absolute inline-flex w-full h-full rounded-full bg-blue-500 opacity-60 animate-ping" />
                    <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-blue-500" />
                  </span>
                )}
              </button>
            </div>
          </div>

          <UserSearch 
            onStartChat={(chatId) => setActiveChatId(chatId)} 
            onCreateGroup={() => setShowCreateGroup(true)}
          />
          
          <ChatList 
            onSelectChat={(chatId) => setActiveChatId(chatId)} 
            activeChatId={activeChatId} 
          />

          {/* Profile Bar */}
          <div className="p-4 bg-gray-50/50 dark:bg-[#181818]/50 border-t border-gray-100 dark:border-[#222] mt-auto flex items-center justify-between">
            <div 
              className="flex items-center gap-3 cursor-pointer group"
              onClick={() => setShowSettings(true)}
            >
              <Avatar 
                src={profile?.photoURL} 
                className="w-9 h-9 border border-white dark:border-[#333] shadow-sm group-hover:opacity-80 group-hover:bg-gray-300 dark:group-hover:bg-[#444] transition-all" 
              />
              <div className="text-left overflow-hidden">
                <p className="text-sm font-medium text-[#1a1a1a] dark:text-white truncate">
                  <UserName user={profile || user} fallback={user.displayName} />
                </p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">@{profile?.username}</p>
              </div>
            </div>
            <button 
              onClick={logout}
              className="p-2 hover:bg-white dark:hover:bg-[#222] hover:text-red-500 rounded-xl transition-all shadow-sm group border border-transparent hover:border-red-100 dark:hover:border-red-900/30"
            >
              <LogOut className="w-4 h-4 text-gray-400 group-hover:text-red-500" />
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className={cn(
          "flex-1 flex-col h-full bg-[#fafafa] dark:bg-[#0d0d0d]",
          activeChatId ? "flex" : "hidden sm:flex"
        )}>
          {activeChatId ? (
            <ChatWindow chatId={activeChatId} onClose={() => setActiveChatId(null)} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-gray-400 dark:text-gray-500 bg-white dark:bg-[#0d0d0d]">
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="w-24 h-24 bg-[#f5f5f0] dark:bg-[#1a1a1a] rounded-full flex items-center justify-center mb-6 shadow-inner"
              >
                <MessageSquare className="w-12 h-12 text-[#5A5A40]/30 dark:text-[#A0A080]/20" />
              </motion.div>
              <h2 className="text-2xl font-serif text-[#1a1a1a] dark:text-white mb-2">Выберите чат</h2>
              <p className="max-w-xs text-sm font-light italic leading-loose opacity-70">
                Начните общение прямо сейчас. Найдите друзей в поиске или выберите существующий диалог слева.
              </p>
              <div className="mt-8 flex gap-2">
                <div className="w-1 h-1 rounded-full bg-[#5A5A40]/20 dark:bg-[#A0A080]/30 animate-pulse" />
                <div className="w-1 h-1 rounded-full bg-[#5A5A40]/20 dark:bg-[#A0A080]/30 animate-pulse delay-75" />
                <div className="w-1 h-1 rounded-full bg-[#5A5A40]/20 dark:bg-[#A0A080]/30 animate-pulse delay-150" />
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="fixed inset-0 bg-black/25 dark:bg-black/45 z-[100]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95%] max-w-sm md:max-w-4xl max-h-[90vh] flex flex-col glass-panel rounded-[32px] z-[101] overflow-hidden"
            >
              <SettingsPanel
                theme={theme}
                setTheme={setTheme}
                isAdmin={isAdmin}
                onClose={() => setShowSettings(false)}
                onOpenChangelog={() => setShowChangelog(true)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCreateGroup && (
          <CreateGroupModal
            onClose={() => setShowCreateGroup(false)}
            onGroupCreated={(newChatId) => {
              setActiveChatId(newChatId);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showChangelog && (
          <ChangelogModal
            isOpen={showChangelog}
            onClose={() => setShowChangelog(false)}
            appVersionName={installedVersionLabel}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
