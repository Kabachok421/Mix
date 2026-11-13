import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { Loader2, RotateCcw, ZoomIn, ZoomOut, Move } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Avatar } from './Avatar';
import { BannerCanvas } from './BannerCanvas';
import { AmbientGlow, FADE_MASK } from './ProfileBanner';
import { getUserDisplayName } from '../lib/utils';
import { BannerTransform, DEFAULT_TRANSFORM, MAX_ZOOM, dragTransform, zoomTransform } from '../services/bannerCore';
import type { UserProfile } from '../types';

// Предпросмотр профиля с баннером, как в магазине Discord: баннер можно двигать и масштабировать,
// а рядом сразу видно, как профиль будет выглядеть у собеседников.
export function BannerEditor({
  src,
  mime,
  initial,
  onCancel,
  onSave,
}: {
  src: string;
  mime: string;
  initial: BannerTransform;
  onCancel: () => void;
  onSave: (t: BannerTransform) => Promise<void>;
}) {
  const { profile } = useAuth();
  const [t, setT] = useState<BannerTransform>(initial);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; start: BannerTransform } | null>(null);
  const tRef = useRef(t);
  tRef.current = t;
  const natRef = useRef(nat);
  natRef.current = nat;

  const frameSize = () => {
    const el = frameRef.current;
    return el ? { w: el.clientWidth, h: el.clientHeight } : { w: 0, h: 0 };
  };

  const applyZoom = (zoom: number) => {
    const n = natRef.current;
    const f = frameSize();
    if (!n || !f.w) return;
    setT(zoomTransform(f.w, f.h, n.w, n.h, tRef.current, zoom));
  };

  // Колесо мыши меняет масштаб. Слушатель нативный, чтобы страница не прокручивалась.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      applyZoom(tRef.current.zoom * Math.exp(-e.deltaY * 0.0015));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [saving, onCancel]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!nat) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, start: tRef.current };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const n = natRef.current;
    if (!d || !n) return;
    const f = frameSize();
    setT(dragTransform(f.w, f.h, n.w, n.h, d.start, e.clientX - d.x, e.clientY - d.y));
  };
  const endDrag = () => {
    drag.current = null;
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(t);
    } catch (err: any) {
      setError(err?.message || 'Не удалось сохранить баннер');
      setSaving(false);
    }
  };

  const name = profile ? getUserDisplayName(profile as UserProfile) : '';

  return createPortal(
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => !saving && onCancel()}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[400]"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[94%] max-w-md max-h-[94vh] overflow-y-auto z-[401] rounded-[28px] bg-white dark:bg-[#161616] border border-[#e5e5e0] dark:border-[#2a2a2a] shadow-2xl p-5 space-y-4"
      >
        <div>
          <h3 className="text-lg font-serif text-[#1a1a1a] dark:text-white">Предпросмотр профиля</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Перетащите баннер, чтобы подвинуть. Колесо мыши или ползунок меняют масштаб.
          </p>
        </div>

        {/* Так профиль увидят другие */}
        <div className="relative rounded-[28px] overflow-hidden bg-white dark:bg-[#1a1a1a] border border-[#e5e5e0] dark:border-[#333] shadow-lg">
          <div className="relative" style={{ aspectRatio: '2 / 1' }}>
            <AmbientGlow src={src} mime={mime} transform={t} />
            <div
              ref={frameRef}
              className="absolute inset-0 touch-none select-none cursor-grab active:cursor-grabbing"
              style={{ WebkitMaskImage: FADE_MASK, maskImage: FADE_MASK }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              <BannerCanvas src={src} mime={mime} transform={t} onNatural={(w, h) => setNat({ w, h })} />
            </div>
            {!nat && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            )}
            <div className="absolute -bottom-10 left-5 z-10 pointer-events-none">
              <div className="w-20 h-20 rounded-full border-4 border-white dark:border-[#1a1a1a] bg-gray-200 dark:bg-[#333] overflow-hidden shadow-lg">
                <Avatar src={profile?.photoURL} className="w-full h-full" />
              </div>
            </div>
          </div>
          <div className="relative z-10 px-5 pt-12 pb-5">
            <p className="text-xl font-serif text-[#1a1a1a] dark:text-white leading-tight truncate">{name || 'Ваше имя'}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{profile?.username ? `@${profile.username}` : 'в сети'}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ZoomOut className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={t.zoom}
            onChange={(e) => applyZoom(Number(e.target.value))}
            aria-label="Масштаб"
            className="flex-1 accent-blue-500"
          />
          <ZoomIn className="w-4 h-4 text-gray-400 shrink-0" />
          <span className="w-12 text-right text-[11px] tabular-nums text-gray-500 dark:text-gray-400">{Math.round(t.zoom * 100)}%</span>
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setT(DEFAULT_TRANSFORM)}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Сбросить
          </button>
          <span className="flex items-center gap-1 text-[11px] text-gray-400">
            <Move className="w-3 h-3" />
            Тяните за баннер
          </span>
        </div>

        {error && <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-[#333] text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#252525] disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || !nat}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-br from-indigo-500 to-purple-500 hover:brightness-110 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Сохранить
          </button>
        </div>
      </motion.div>
    </>,
    document.body
  );
}
