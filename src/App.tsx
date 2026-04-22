import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import Login from './components/Login';
import ChatList from './components/ChatList';
import ChatWindow from './components/ChatWindow';
import UserSearch from './components/UserSearch';
import { LogOut, MessageSquare, Settings, User as UserIcon, Moon, Sun, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

export default function App() {
  const { user, loading, logout } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f0] dark:bg-[#0a0a0a] transition-colors duration-500">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-[#5A5A40] dark:border-[#A0A080] border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return <Login />;
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
            <div className="flex items-center gap-3">
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="w-9 h-9 rounded-full border border-white dark:border-[#333] shadow-sm" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-[#333] flex items-center justify-center text-gray-500 dark:text-gray-400"><UserIcon className="w-4 h-4" /></div>
              )}
              <div className="text-left overflow-hidden">
                <p className="text-sm font-medium text-[#1a1a1a] dark:text-white truncate">{user.displayName}</p>
                <p className="text-[10px] text-green-500 dark:text-green-400 uppercase tracking-tighter font-semibold">В сети</p>
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
            <ChatWindow chatId={activeChatId} />
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
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-[#222] flex items-center justify-center">
                      {darkMode ? <Moon className="w-5 h-5 dark:text-blue-400" /> : <Sun className="w-5 h-5 text-orange-400" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium dark:text-white">Тёмная тема</p>
                      <p className="text-xs text-gray-400">Переключить интерфейс</p>
                    </div>
                  </div>
                  <button 
                    onClick={toggleDarkMode}
                    className={cn(
                      "w-12 h-6 rounded-full transition-all relative",
                      darkMode ? "bg-blue-600" : "bg-gray-200"
                    )}
                  >
                    <motion.div 
                      animate={{ x: darkMode ? 24 : 4 }}
                      className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                    />
                  </button>
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
