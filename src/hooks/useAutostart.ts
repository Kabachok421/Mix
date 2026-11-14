import { useCallback, useEffect, useState } from 'react';
import type { LinkEmbed } from '../lib/linkUtils';

// Запуск вместе с Windows. Мост window.mixApp есть только в приложении Mix для Windows (его создаёт preload),
// в браузере supported = false и раздел настроек скрыт.
declare global {
  interface Window {
    mixApp?: {
      getAutostart(): Promise<boolean | null>;
      setAutostart(enabled: boolean): Promise<boolean | null>;
      fetchLinkPreview?(url: string): Promise<LinkEmbed | null>;
    };
  }
}

export function useAutostart() {
  const bridge = typeof window !== 'undefined' ? window.mixApp : undefined;
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bridge) return;
    let alive = true;
    bridge
      .getAutostart()
      .then((v) => {
        if (alive) setEnabled(v);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [bridge]);

  const set = useCallback(
    async (next: boolean) => {
      if (!bridge) return;
      setError(null);
      const prev = enabled;
      setEnabled(next); // сразу показываем новое положение переключателя
      try {
        const actual = await bridge.setAutostart(next);
        setEnabled(actual ?? prev);
      } catch {
        setEnabled(prev);
        setError('Не удалось изменить настройку запуска');
      }
    },
    [bridge, enabled]
  );

  return { supported: !!bridge, enabled, set, error };
}
