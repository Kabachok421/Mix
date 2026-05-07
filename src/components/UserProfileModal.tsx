import React from 'react';
import { motion } from 'motion/react';
import { UserProfile } from '../types';
import { X, User, Mail, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Avatar } from './Avatar';
import { UserStatus } from './UserStatus';
import { UserName } from './UserName';

interface UserProfileModalProps {
  user: UserProfile;
  onClose: () => void;
}

export default function UserProfileModal({ user, onClose }: UserProfileModalProps) {
  return (
    <>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/40 dark:bg-black/80 backdrop-blur-sm z-[200]"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white dark:bg-[#1a1a1a] rounded-[32px] shadow-2xl z-[201] overflow-hidden border border-[#e5e5e0] dark:border-[#333]"
      >
        <div className="relative h-48 bg-gradient-to-br from-[#e5e5e0] to-gray-100 dark:from-[#222] dark:to-[#111]">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-black/10 dark:bg-black/30 hover:bg-black/20 dark:hover:bg-black/50 rounded-full text-white backdrop-blur-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="absolute -bottom-12 left-6">
            <div className="w-24 h-24 rounded-full border-4 border-white dark:border-[#1a1a1a] bg-gray-200 dark:bg-[#333] flex items-center justify-center overflow-hidden shadow-lg">
              <Avatar src={user.photoURL} className="w-full h-full" />
            </div>
          </div>
        </div>

        <div className="px-6 pt-16 pb-8">
          <h2 className="text-2xl font-serif text-[#1a1a1a] dark:text-white leading-tight">
            <UserName user={user} />
          </h2>
          <div className="text-sm mt-1 capitalize-first">
            {user ? <UserStatus user={user} className="" /> : null}
          </div>

          <div className="mt-8 space-y-6">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-2">Никнейм</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-[#222] flex items-center justify-center text-gray-400">
                  <span className="font-serif">@</span>
                </div>
                <div className="text-[#1a1a1a] dark:text-gray-200 font-medium">
                  {user.username || 'Не установлен'}
                </div>
              </div>
            </div>

            {!user.hideName && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-2">Настоящее имя</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-[#222] flex items-center justify-center text-gray-400">
                    <User className="w-5 h-5" />
                  </div>
                  <div className="text-[#1a1a1a] dark:text-gray-200 font-medium">
                    {user.displayName}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </motion.div>
    </>
  );
}
