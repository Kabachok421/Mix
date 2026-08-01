import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { chatService } from '../services/chatService';
import { UserProfile, Chat } from '../types';
import { Search, UserPlus, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Avatar } from './Avatar';
import { UserName } from './UserName';

interface UserSearchProps {
  onStartChat: (chatId: string) => void;
}

export default function UserSearch({ onStartChat }: UserSearchProps) {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [myChats, setMyChats] = useState<Chat[]>([]);
  const [showResults, setShowResults] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = chatService.subscribeToChats(user.uid, (chats) => {
      setMyChats(chats);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim() || !user) return;
    
    setLoading(true);
    try {
      const users = await chatService.searchUsers(searchTerm.trim(), user.uid);
      setResults(users || []);
      setShowResults(true);
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
    <div ref={searchContainerRef} className="p-4 border-b border-gray-100 dark:border-[#222]">
      <form onSubmit={handleSearch} className="relative group">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); if (e.target.value.trim().length > 0) setShowResults(true); else setShowResults(false); }}
          placeholder="Поиск по нику или коду друга..."
          onFocus={() => { if (results.length > 0) setShowResults(true); }}
          className="w-full bg-gray-100 dark:bg-[#1a1a1a] rounded-full py-2.5 pl-10 pr-4 text-sm focus:bg-white dark:focus:bg-[#111] focus:ring-2 focus:ring-[#5A5A40]/30 dark:focus:ring-[#A0A080]/20 outline-none transition-all border border-transparent focus:border-[#5A5A40]/20 dark:text-white"
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-[#5A5A40] dark:group-focus-within:text-[#A0A080]" />
        {searchTerm && (
          <button 
            type="button"
            onClick={() => { setSearchTerm(''); setShowResults(false); setTimeout(() => setResults([]), 500); }}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            <X className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" />
          </button>
        )}
      </form>

      <AnimatePresence>
        {showResults && results.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, transition: { delay: results.length * 0.05 + 0.1 } }}
            className="mt-4 bg-white dark:bg-[#1a1a1a] rounded-2xl border border-[#e5e5e0] dark:border-[#333] shadow-2xl overflow-hidden absolute z-50 left-4 right-4"
          >
            {results.map((u, index) => {
              const isFriend = myChats.some(chat => chat.participantIds.includes(u.uid));
              return (
              <motion.button
                key={u.uid}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0, transition: { delay: index * 0.05 } }}
                exit={{ opacity: 0, x: 50, transition: { duration: 0.3, delay: index * 0.05 } }}
                onClick={() => handleStartChat(u.uid)}
                className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-[#222] transition-colors border-b last:border-0 border-gray-50 dark:border-[#222]"
              >
                <div className="flex items-center gap-3">
                  <Avatar src={u.photoURL} className="w-8 h-8" />
                  <div className="text-left">
                    <div className="text-sm font-medium dark:text-white"><UserName user={u} /></div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">@{u.username || 'unknown'}</div>
                  </div>
                </div>
                {isFriend ? (
                  <div className="p-1 rounded-full bg-green-500/10 text-green-500">
                    <Check className="w-4 h-4" />
                  </div>
                ) : (
                  <UserPlus className="w-4 h-4 text-[#5A5A40] dark:text-[#A0A080]" />
                )}
              </motion.button>
            )})}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
