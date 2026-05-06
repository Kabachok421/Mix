import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import Login from './components/Login';
import ChatList from './components/ChatList';
import ChatWindow from './components/ChatWindow';
import UserSearch from './components/UserSearch';
import SetupProfile from './components/SetupProfile';
import { LogOut, MessageSquare, Settings, User as UserIcon, Moon, Sun, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

import { Avatar } from './components/Avatar';

export default function App() {
  const { user, profile, loading, isOffline, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f5f5f0] dark:bg-[#0a0a0a] transition-colors duration-500">
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
      <div className="h-screen flex bg-[#f5f5f0] dark:bg-[#050505] p-0 sm:p-4 transition-colors duration-500 font-sans">
        <SetupProfile />
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-[#f5f5f0] dark:bg-[#050505] overflow-hidden p-0 sm:p-4 transition-colors duration-500 font-sans">
      <div className="flex-1 flex max-w-6xl mx-auto w-full bg-white dark:bg-[#111111] sm:rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden border border-[#e5e5e0] dark:border-[#222] transition-colors">
        
        {/* Sidebar */}
        <aside className="w-full sm:w-[380px] flex flex-col border-r border-gray-100 dark:border-[#222] h-full relative z-20">
          <div className="p-6 flex items-center justify-between">
            <h1 className="text-2xl font-serif text-[#1a1a1a] dark:text-white">Mix</h1>
            <div className="flex items-center gap-2">
               <button 
                  onClick={() => setShowSettings(true)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-[#222] rounded-full transition-colors text-gray-500 dark:text-gray-400 active:scale-95"
               >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>

          <UserSearch onStartChat={(chatId) => setActiveChatId(chatId)} />
          
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
                <p className="text-sm font-medium text-[#1a1a1a] dark:text-white truncate">{profile?.displayName || user.displayName}</p>
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
        <main className="hidden sm:flex flex-1 flex-col h-full bg-[#fafafa] dark:bg-[#0d0d0d]">
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
              className="fixed inset-0 bg-black/40 dark:bg-black/80 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white dark:bg-[#1a1a1a] rounded-[32px] shadow-2xl z-[101] overflow-hidden border border-[#e5e5e0] dark:border-[#333]"
            >
              <div className="p-6 border-b border-gray-100 dark:border-[#222] flex items-center justify-between">
                <h3 className="text-xl font-serif dark:text-white">Настройки</h3>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-[#222] rounded-full text-gray-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <h4 className="text-sm font-medium mb-2 dark:text-white">Тема оформления</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <button 
                      onClick={() => setTheme('light')}
                      className={cn(
                        "flex flex-col items-center justify-center p-3 rounded-xl border transition-all",
                        theme === 'light' ? "border-[#5A5A40] bg-gray-50" : "border-gray-200 hover:bg-gray-50 dark:border-[#333] dark:hover:bg-[#1a1a1a]"
                      )}
                    >
                      <Sun className="w-5 h-5 mb-2 text-orange-500" />
                      <span className="text-xs font-medium dark:text-gray-300">Светлая</span>
                    </button>
                    
                    <button 
                      onClick={() => setTheme('dark')}
                      className={cn(
                        "flex flex-col items-center justify-center p-3 rounded-xl border transition-all",
                        theme === 'dark' ? "border-gray-400 bg-gray-800 text-white" : "border-gray-200 dark:border-[#333] hover:bg-gray-100 dark:hover:bg-[#1a1a1a]"
                      )}
                    >
                      <Moon className="w-5 h-5 mb-2 text-blue-400" />
                      <span className="text-xs font-medium dark:text-gray-300">Тёмная</span>
                    </button>
                    
                    <button 
                      onClick={() => setTheme('ocean')}
                      className={cn(
                        "flex flex-col items-center justify-center p-3 rounded-xl border transition-all",
                        theme === 'ocean' ? "border-cyan-400 bg-[#041f2e] text-white shadow-[0_0_10px_rgba(0,255,255,0.2)]" : "border-gray-200 dark:border-[#333] hover:bg-gray-100 dark:hover:bg-[#1a1a1a]"
                      )}
                    >
                      <div className="w-5 h-5 mb-2 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 shadow-[0_0_8px_rgba(0,255,255,0.5)]" />
                      <span className="text-xs font-medium dark:text-gray-300">Ocean</span>
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 dark:border-[#222]">
                  <h4 className="text-sm font-medium mb-4 dark:text-white">Редактировать профиль</h4>
                  <SetupProfile onComplete={() => setShowSettings(false)} fullPage={false} />
                </div>

                <div className="pt-4 border-t border-gray-100 dark:border-[#222]">
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest text-center">Mix Messenger v1.1</p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
