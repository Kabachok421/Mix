import React from 'react';
import { useBanner } from '../hooks/useBanner';
import { BannerCanvas } from './BannerCanvas';
import { cn } from '../lib/utils';
import type { BannerTransform } from '../services/bannerCore';

export const FADE_MASK = 'linear-gradient(to bottom, #000 55%, transparent 100%)';
const AMBIENT_MASK = 'linear-gradient(to bottom, #000 0%, transparent 92%)';

// Мягкое свечение: размытая копия баннера уходит вниз за край и подсвечивает карточку под ним
export function AmbientGlow({ src, mime, transform }: { src: string; mime: string; transform: BannerTransform }) {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-x-0 top-0 h-full pointer-events-none"
      style={{
        transform: 'translateY(58%) scale(1.3)',
        filter: 'blur(34px) saturate(1.7)',
        opacity: 0.8,
        WebkitMaskImage: AMBIENT_MASK,
        maskImage: AMBIENT_MASK,
      }}
    >
      <BannerCanvas src={src} mime={mime} transform={transform} />
    </div>
  );
}

// Баннер пользователя. Заполняет родителя; если баннера нет, не рисует ничего (фон задаёт родитель).
//  fade: нижний край плавно растворяется в фон карточки
//  ambient: под баннером разливается его свет (Ambient light)
export function ProfileBanner({ uid, className, fade, ambient }: { uid?: string; className?: string; fade?: boolean; ambient?: boolean }) {
  const banner = useBanner(uid);
  if (!banner) return null;

  return (
    <>
      {ambient && <AmbientGlow src={banner.url} mime={banner.mime} transform={banner.transform} />}
      <div
        className={cn('absolute inset-0', className)}
        style={fade ? { WebkitMaskImage: FADE_MASK, maskImage: FADE_MASK } : undefined}
      >
        <BannerCanvas src={banner.url} mime={banner.mime} transform={banner.transform} />
      </div>
    </>
  );
}
