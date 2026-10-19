import React, { useEffect, useState } from 'react';
import { UserProfile } from '../types';
import { formatLastSeen, isUserOnline, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface UserStatusProps {
  user: UserProfile | null;
  className?: string;
  showDotOnly?: boolean;
}

export function UserStatus({ user, className, showDotOnly }: UserStatusProps) {
  const [ticker, setTicker] = useState(0);

  useEffect(() => {
    // Re-render every 30 seconds to accurately update online status & last seen
    const interval = setInterval(() => {
      setTicker(t => t + 1);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!user) return null;

  const online = isUserOnline(user);

  if (showDotOnly) {
    if (!online) return null;
    return (
      <div className={cn("absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-[#1a1a1a] rounded-full", className)} />
    );
  }

  return (
    <span className={cn(
      online ? "text-green-500 dark:text-green-400" : "text-gray-400 dark:text-gray-600",
      className
    )}>
      {online ? 'В сети' : formatLastSeen(user.lastSeen)}
    </span>
  );
}
