import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { UserProfile } from '../types';
import { Timestamp } from 'firebase/firestore';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateThumbnail(file: File, maxWidth: number = 200, maxHeight: number = 200): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = width * ratio;
          height = height * ratio;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Canvas context not available'));
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.5)); // 0.5 quality to keep size very small
      };
      img.onerror = (err) => reject(err);
      img.src = e.target?.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
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

export function formatLastSeen(lastSeen: any): string {
  if (!lastSeen) return 'Оффлайн';
  
  const now = new Date();
  let date: Date;

  if (typeof lastSeen.toDate === 'function') {
    date = lastSeen.toDate();
  } else if (lastSeen.seconds) {
    date = new Date(lastSeen.seconds * 1000);
  } else if (typeof lastSeen === 'string' || typeof lastSeen === 'number') {
    date = new Date(lastSeen);
  } else {
    return 'Оффлайн';
  }

  // Handle Invalid Date
  if (isNaN(date.getTime())) return 'Оффлайн';

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
