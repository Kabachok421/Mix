import { useEffect, useState } from 'react';

// Состояние автообновления. Приходит из приложения Mix для Windows (мост window.mixUpdater из preload).
// В браузере моста нет: supported = false, раздел «Обновления» скрыт.
export interface UpdaterState {
  phase: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'uptodate' | 'error';
  currentVersion: string;
  lastChecked?: number;
  version?: string;
  percent?: number;
  speed?: number;
  message?: string;
}

interface MixUpdaterBridge {
  getState(): Promise<UpdaterState | null>;
  onState(cb: (state: UpdaterState) => void): () => void;
  check(): void;
  download(): void;
  restart(): void;
}

declare global {
  interface Window {
    mixUpdater?: MixUpdaterBridge;
  }
}

export interface UpdaterApi {
  supported: boolean;
  state: UpdaterState | null;
  check: () => void;
  download: () => void;
  restart: () => void;
}

export function useUpdater(): UpdaterApi {
  const bridge = typeof window !== 'undefined' ? window.mixUpdater : undefined;
  const [state, setState] = useState<UpdaterState | null>(null);

  useEffect(() => {
    if (!bridge) return;
    let alive = true;
    bridge
      .getState()
      .then((s) => {
        if (alive && s) setState(s);
      })
      .catch(() => {});
    const off = bridge.onState((s) => {
      if (alive) setState(s);
    });
    return () => {
      alive = false;
      off();
    };
  }, [bridge]);

  return {
    supported: !!bridge,
    state,
    check: () => bridge?.check(),
    download: () => bridge?.download(),
    restart: () => bridge?.restart(),
  };
}
