import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { UserProfile } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getUserDisplayName(user: UserProfile | undefined): string {
  if (!user) return 'Anonymous';
  if (user.hideName) {
    if (user.username) return `@${user.username}`;
    return 'Скрытый пользователь';
  }
  return user.displayName || 'Anonymous';
}
