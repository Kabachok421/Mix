import React, { useEffect, useState } from 'react';
import { useBanner } from '../hooks/useBanner';
import { cn } from '../lib/utils';

// Анимированный баннер пользователя (GIF, WebP, короткое видео). Если баннера нет, не рисует ничего:
// фон-заглушку задаёт родитель. По умолчанию заполняет родителя целиком.
export function ProfileBanner({ uid, className }: { uid?: string; className?: string }) {
  const banner = useBanner(uid);
  const [shown, setShown] = useState(false);

  // При смене баннера плавно появляется заново
  useEffect(() => {
    setShown(false);
  }, [banner?.url]);

  if (!banner) return null;

  const common = cn(
    'absolute inset-0 w-full h-full object-cover transition-opacity duration-500',
    shown ? 'opacity-100' : 'opacity-0',
    className
  );

  return banner.mime.startsWith('video/') ? (
    <video
      key={banner.url}
      src={banner.url}
      className={common}
      autoPlay
      loop
      muted
      playsInline
      onLoadedData={() => setShown(true)}
    />
  ) : (
    <img key={banner.url} src={banner.url} alt="" draggable={false} className={common} onLoad={() => setShown(true)} />
  );
}
