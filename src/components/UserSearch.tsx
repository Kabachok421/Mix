import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { chatService } from '../services/chatService';
import { UserProfile } from '../types';
import { Search, UserPlus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface UserSearchProps {
  onStartChat: (chatId: string) => void;
}

export default function UserSearch({ onStartChat }: UserSearchProps) {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim() || !user) return;
    
    setLoading(true);
    try {
      const users = await chatService.searchUsers(searchTerm.trim(), user.uid);
      setResults(users || []);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartChat = async (targetUserId: string) => {
    if (!user) return;
    const chatId = await chatService.getOrCreateChat(user.uid, targetUserId);
    if (chatId) {
      onStartChat(chatId);
      setSearchTerm('');
      setResults([]);
    }
  };

  return (
    <div className="p-4 border-b border-gray-100 dark:border-[#222]">
      <form onSubmit={handleSearch} className="relative group">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Поиск по нику (@username)..."
          className="w-full bg-gray-100 dark:bg-[#1a1a1a] rounded-full py-2.5 pl-10 pr-4 text-sm focus:bg-white dark:focus:bg-[#111] focus:ring-2 focus:ring-[#5A5A40]/30 dark:focus:ring-[#A0A080]/20 outline-none transition-all border border-transparent focus:border-[#5A5A40]/20 dark:text-white"
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-[#5A5A40] dark:group-focus-within:text-[#A0A080]" />
        {searchTerm && (
          <button 
            type="button"
            onClick={() => { setSearchTerm(''); setResults([]); }}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            <X className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" />
          </button>
        )}
      </form>

      <AnimatePresence>
        {results.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="mt-4 bg-white dark:bg-[#1a1a1a] rounded-2xl border border-[#e5e5e0] dark:border-[#333] shadow-2xl overflow-hidden absolute z-50 left-4 right-4"
          >
            {results.map((u) => (
              <button
                key={u.uid}
                onClick={() => handleStartChat(u.uid)}
                className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-[#222] transition-colors border-b last:border-0 border-gray-50 dark:border-[#222]"
              >
                <div className="flex items-center gap-3">
                  {u.photoURL ? (
                    <img src={u.photoURL} className="w-8 h-8 rounded-full" alt="" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-[#333] flex items-center justify-center text-xs dark:text-gray-400">{u.displayName.charAt(0)}</div>
                  )}
                  <div className="text-left">
                    <div className="text-sm font-medium dark:text-white">{u.displayName}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">@{u.username || 'unknown'}</div>
                  </div>
                </div>
                <UserPlus className="w-4 h-4 text-[#5A5A40] dark:text-[#A0A080]" />
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
