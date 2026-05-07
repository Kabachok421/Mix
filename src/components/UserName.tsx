import React from 'react';
import { UserProfile } from '../types';
import { cn } from '../lib/utils';

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
    
    // Blur the original name
    return (
      <span 
        className={cn("blur-sm select-none opacity-80", className)} 
        aria-hidden="true" 
        title="Имя скрыто"
      >
        {user.displayName || fallback}
      </span>
    );
  }

  return <span className={className}>{user.displayName || fallback}</span>;
}
