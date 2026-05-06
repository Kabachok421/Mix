import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { UserProfile } from '../types';
import { Timestamp } from 'firebase/firestore';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getUserDisplayName(user: UserProfile | undefined): string {
  if (!user) return 'Anonymous';
  if (user.hideName) {
    if (user.customName && user.customName.trim().length > 0) return user.customName;
    if (user.username) return `@${user.username}`;
    return 'Скрытый пользователь';
  }
  return user.displayName || 'Anonymous';
}

export function formatLastSeen(lastSeen: Timestamp | undefined | null): string {
  if (!lastSeen) return 'Оффлайн';
  
  const now = new Date();
  const date = typeof lastSeen.toDate === 'function' ? lastSeen.toDate() : new Date(lastSeen as unknown as string);
  const diffInMs = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInMinutes < 1) {
    return 'Был(а) только что';
  } else if (diffInMinutes < 60) {
    return `Был(а) ${diffInMinutes} мин. назад`;
  } else if (diffInHours < 24) {
    return `Был(а) ${diffInHours} ч. назад`;
  } else if (diffInDays < 7) {
    return `Был(а) ${diffInDays} д. назад`;
  } else {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `Был(а) ${day}.${month}.${year}`;
  }
}
