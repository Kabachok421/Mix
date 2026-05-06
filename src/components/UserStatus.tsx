import React, { useEffect, useState } from 'react';
import { UserProfile } from '../types';
import { formatLastSeen, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface UserStatusProps {
  user: UserProfile | null;
  className?: string;
  showDotOnly?: boolean;
}

export function UserStatus({ user, className, showDotOnly }: UserStatusProps) {
  const [ticker, setTicker] = useState(0);

  useEffect(() => {
    // Re-render every minute to update the "last seen" text
    const interval = setInterval(() => {
      setTicker(t => t + 1);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!user) return null;

  const isOnline = (() => {
    if (user.status !== 'online') return false;
    
    // Check if the "online" status is stale (older than 5 minutes)
    if (user.lastSeen) {
      let date: Date;
      if (typeof user.lastSeen.toDate === 'function') {
        date = user.lastSeen.toDate();
      } else if (user.lastSeen.seconds) {
        date = new Date(user.lastSeen.seconds * 1000);
      } else if (typeof user.lastSeen === 'string' || typeof user.lastSeen === 'number') {
        date = new Date(user.lastSeen);
      } else {
        return true; // Unknown format, trust status
      }
      
      const now = new Date();
      if (!isNaN(date.getTime())) {
        const diffInMinutes = (now.getTime() - date.getTime()) / (1000 * 60);
        if (diffInMinutes > 5) {
          return false;
        }
      }
    }
    
    return true;
  })();

  if (showDotOnly) {
    if (!isOnline) return null;
    return (
      <div className={cn("absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-[#1a1a1a] rounded-full", className)} />
    );
  }

  return (
    <span className={cn(
      isOnline ? "text-green-500 dark:text-green-400" : "text-gray-400 dark:text-gray-600",
      className
    )}>
      {isOnline ? 'В сети' : formatLastSeen(user.lastSeen)}
    </span>
  );
}
