import React from 'react';
import { UserProfile } from '../types';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

interface UserNameProps {
  user?: UserProfile | null;
  fallback?: string;
  className?: string;
}

export function UserName({ user, fallback = 'Anonymous', className }: UserNameProps) {
  if (!user) {
    return <span className={className}>{fallback}</span>;
  }

  if (user.hideName) {
    if (user.customName && user.customName.trim().length > 0) {
      return <span className={className}>{user.customName}</span>;
    }
    
    // Beautiful Telegram-style animated blur
    return (
      <span 
        className={cn("relative inline-flex items-center justify-center select-none overflow-hidden rounded", className)} 
        title="Имя скрыто"
      >
        <motion.span 
          initial={{ filter: 'blur(8px)', opacity: 0 }}
          animate={{ 
            filter: ['blur(4px)', 'blur(5.5px)', 'blur(4px)'],
            opacity: [0.65, 0.85, 0.65]
          }}
          transition={{ 
            duration: 12, 
            repeat: Infinity, 
            ease: "easeInOut" 
          }}
          className="inline-block px-0.5"
        >
          {user.displayName || fallback}
        </motion.span>
        
        {/* Subtle dynamic shimmer layer to give it that sparkling Telegram feel */}
        <motion.span 
          className="absolute inset-0 pointer-events-none mix-blend-overlay block"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`,
            backgroundSize: '150px 150px'
          }}
          animate={{ 
            backgroundPosition: ['0px 0px', '150px 150px'],
          }}
          transition={{ 
            duration: 8, 
            repeat: Infinity, 
            ease: "linear" 
          }}
        />
      </span>
    );
  }

  return <span className={className}>{user.displayName || fallback}</span>;
}
