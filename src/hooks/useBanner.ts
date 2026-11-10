import { useEffect, useState } from 'react';
import { bannerService } from '../services/bannerService';
import type { LoadedBanner } from '../services/bannerCore';

// Баннер пользователя (или null). Обновляется, когда его меняют на этом устройстве.
export function useBanner(uid?: string): LoadedBanner | null {
  const [banner, setBanner] = useState<LoadedBanner | null>(null);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    if (!uid) return;
    return bannerService.onChange((changed) => {
      if (changed === uid) setRev((r) => r + 1);
    });
  }, [uid]);

  useEffect(() => {
    let alive = true;
    if (!uid) {
      setBanner(null);
      return;
    }
    bannerService
      .load(uid)
      .then((b) => {
        if (alive) setBanner(b);
      })
      .catch((e) => {
        console.warn('Banner load failed', e);
        if (alive) setBanner(null);
      });
    return () => {
      alive = false;
    };
  }, [uid, rev]);

  return banner;
}
