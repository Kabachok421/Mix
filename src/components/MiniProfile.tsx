import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { Pencil, Palette, Bell, Settings as SettingsIcon, LogOut, Copy, Check, ChevronRight } from 'lucide-react';
import { Avatar } from './Avatar';
import { UserName } from './UserName';
import { ProfileBanner } from './ProfileBanner';
import { useBanner } from '../hooks/useBanner';
import type { UserProfile } from '../types';
import { cn } from '../lib/utils';

export type MiniProfileTab = 'profile' | 'appearance' | 'notifications';

const POPUP_W = 340;

function Row({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-3.5 py-3 text-sm text-left transition-colors',
        danger ? 'text-red-500 hover:bg-red-500/10' : 'hover:bg-black/5 dark:hover:bg-white/10'
      )}
    >
      <span className="w-4 h-4 flex items-center justify-center shrink-0 opacity-80">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {!danger && <ChevronRight className="w-4 h-4 opacity-40 shrink-0" />}
    </button>
  );
}

// Мини-профиль над блоком профиля внизу списка чатов (как в Discord): баннер, имя, код друга и быстрые действия
export function MiniProfile({
  anchor,
  profile,
  fallbackName,
  onClose,
  onOpenSettings,
  onLogout,
}: {
  anchor: HTMLElement;
  profile: UserProfile | null;
  fallbackName?: string | null;
  onClose: () => void;
  onOpenSettings: (tab: MiniProfileTab) => void;
  onLogout: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const banner = useBanner(profile?.uid);
  const [pos, setPos] = useState<{ left: number; bottom: number; width: number } | null>(null);
  const [copied, setCopied] = useState(false);

  // Окно встаёт над блоком профиля и не вылезает за экран
  useLayoutEffect(() => {
    const place = () => {
      const r = anchor.getBoundingClientRect();
      const width = Math.min(POPUP_W, window.innerWidth - 16);
      const left = Math.max(8, Math.min(r.left + 8, window.innerWidth - width - 8));
      setPos({ left, bottom: Math.max(8, window.innerHeight - r.top + 8), width });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [anchor]);

  useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      // Клик по самому блоку профиля переключает окно сам, поэтому здесь его не считаем «мимо»
      if (ref.current && !ref.current.contains(t) && !anchor.contains(t)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('blur', onClose);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', onClose);
    };
  }, [anchor, onClose]);

  const copyCode = async () => {
    if (!profile?.friendCode) return;
    try {
      await navigator.clipboard.writeText(profile.friendCode);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = profile.friendCode;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {
        // буфер обмена недоступен
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const go = (tab: MiniProfileTab) => {
    onClose();
    onOpenSettings(tab);
  };

  return createPortal(
    <motion.div
      ref={ref}
      role="dialog"
      aria-label="Мини-профиль"
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={pos ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.9, y: 10 }}
      exit={{ opacity: 0, scale: 0.95, y: 6, transition: { duration: 0.12 } }}
      transition={{ type: 'spring', stiffness: 460, damping: 30 }}
      className="glass-panel isolate fixed z-[250] rounded-[28px] overflow-hidden"
      style={{
        left: pos?.left ?? 8,
        bottom: pos?.bottom ?? 8,
        width: pos?.width ?? POPUP_W,
        transformOrigin: 'left bottom',
        visibility: pos ? 'visible' : 'hidden',
      }}
    >
      {/* Баннер: при его наличии растворяется в окно и подсвечивает его (Ambient light) */}
      <div className={cn('relative h-24', !banner && 'bg-gradient-to-br from-[#5A5A40]/35 to-gray-500/15')}>
        <ProfileBanner uid={profile?.uid} ambient fade />
      </div>

      <div className="relative z-10 px-4 pb-3">
        <div className="-mt-10 mb-2 relative w-[76px] h-[76px]">
          <Avatar src={profile?.photoURL} className="w-full h-full rounded-full border-4 border-white dark:border-[#1c1c24] bg-gray-200 dark:bg-[#333] shadow-lg" />
          <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-500 border-[3px] border-white dark:border-[#1c1c24]" title="В сети" />
        </div>

        <p className="text-xl font-serif font-semibold leading-tight text-[#1a1a1a] dark:text-white truncate">
          <UserName user={profile} fallback={fallbackName || undefined} />
        </p>
        <div className="flex items-center gap-2 mt-0.5 min-w-0">
          <span className="text-xs text-gray-500 dark:text-gray-400 truncate">@{profile?.username || '...'}</span>
          {profile?.friendCode && (
            <button
              type="button"
              onClick={copyCode}
              title="Скопировать код друга"
              className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-black/5 dark:bg-white/10 text-gray-600 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/15 transition-colors"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Скопировано' : `Код друга ${profile.friendCode}`}
            </button>
          )}
        </div>
      </div>

      <div className="relative z-10 px-3 pb-3 space-y-2">
        <div className="rounded-2xl bg-black/[0.04] dark:bg-white/[0.06] overflow-hidden divide-y divide-black/5 dark:divide-white/10">
          <Row icon={<Pencil className="w-4 h-4" />} label="Редактировать профиль" onClick={() => go('profile')} />
          <Row icon={<Palette className="w-4 h-4" />} label="Внешний вид" onClick={() => go('appearance')} />
          <Row icon={<Bell className="w-4 h-4" />} label="Уведомления" onClick={() => go('notifications')} />
          <Row icon={<SettingsIcon className="w-4 h-4" />} label="Все настройки" onClick={() => go('profile')} />
        </div>
        <div className="rounded-2xl bg-black/[0.04] dark:bg-white/[0.06] overflow-hidden">
          <Row
            icon={<LogOut className="w-4 h-4" />}
            label="Выйти из аккаунта"
            danger
            onClick={() => {
              onClose();
              onLogout();
            }}
          />
        </div>
      </div>
    </motion.div>,
    document.body
  );
}
