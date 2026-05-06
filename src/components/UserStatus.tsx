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

  // Let's treat "online" as definitely online, 
  // but if it's been "online" for a very long time without updates, 
  // it might be a ghost session. For now, trust user.status.
  const isOnline = user.status === 'online';

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
