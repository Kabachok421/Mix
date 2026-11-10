import React, { useRef, useState } from 'react';
import { Film, Upload, Trash2, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useBanner } from '../hooks/useBanner';
import { bannerService } from '../services/bannerService';
import { validateBannerFile, MAX_VIDEO_SECONDS } from '../services/bannerCore';
import { ProfileBanner } from './ProfileBanner';

// Длительность видео узнаём заранее, чтобы не загружать слишком длинные ролики
function checkVideoDuration(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    const done = (err?: string) => {
      URL.revokeObjectURL(url);
      err ? reject(new Error(err)) : resolve();
    };
    v.preload = 'metadata';
    v.onloadedmetadata = () =>
      v.duration > MAX_VIDEO_SECONDS ? done(`Видео длиннее ${MAX_VIDEO_SECONDS} секунд`) : done();
    v.onerror = () => done('Не удалось прочитать видео');
    v.src = url;
  });
}

const btn =
  'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-gray-200 dark:border-[#333] text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#252525] disabled:opacity-50 transition-all';

export function BannerSettings() {
  const { user } = useAuth();
  const banner = useBanner(user?.uid);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;
    setBusy(true);
    setError(null);
    try {
      const problem = validateBannerFile(file);
      if (problem) throw new Error(problem);
      if (file.type.startsWith('video/')) await checkVideoDuration(file);
      await bannerService.set(user.uid, file);
    } catch (err: any) {
      setError(err?.message || 'Не удалось загрузить баннер');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await bannerService.remove(user.uid);
    } catch (err: any) {
      setError(err?.message || 'Не удалось удалить баннер');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
        <Film className="w-4 h-4 text-gray-400" />
        Баннер профиля
      </p>

      <div className="relative h-32 rounded-2xl overflow-hidden bg-gradient-to-br from-[#e5e5e0] to-gray-100 dark:from-[#222] dark:to-[#111] border border-gray-200 dark:border-[#333]">
        <ProfileBanner uid={user?.uid} />
        {!banner && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400">Баннера пока нет</div>
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className={btn}>
          <Upload className="w-3.5 h-3.5" />
          {banner ? 'Заменить' : 'Загрузить'}
        </button>
        {banner && (
          <button type="button" onClick={remove} disabled={busy} className={btn}>
            <Trash2 className="w-3.5 h-3.5" />
            Удалить
          </button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/gif,image/webp,image/png,image/jpeg,video/mp4,video/webm"
        className="hidden"
        onChange={pick}
      />
      {error && <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>}
      <p className="text-[11px] text-gray-400 dark:text-gray-500">
        GIF, WebP, PNG, JPG или короткое видео MP4/WebM (до {MAX_VIDEO_SECONDS} секунд), до 3 МБ. Баннер показывается в вашем профиле всем
        собеседникам. Видео играет без звука по кругу.
      </p>
    </div>
  );
}
