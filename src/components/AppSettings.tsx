import React from 'react';
import { Monitor, Power } from 'lucide-react';
import { useAutostart } from '../hooks/useAutostart';
import { cn } from '../lib/utils';

// Настройки приложения Windows (в браузере раздела нет)
export function AppSettings() {
  const { enabled, set, error } = useAutostart();

  return (
    <div className="space-y-4 max-w-md">
      <h4 className="text-sm font-medium dark:text-white flex items-center gap-2">
        <Monitor className="w-4 h-4 text-[#5A5A40] dark:text-[#A0A080]" />
        Приложение
      </h4>

      <div className="flex items-center justify-between gap-4 p-3 rounded-2xl border border-gray-200 dark:border-[#333]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Power className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs md:text-sm font-medium text-gray-900 dark:text-gray-100">Запускать при входе в Windows</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Mix запустится свёрнутым в трей и сразу начнёт принимать сообщения.</p>
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled === true}
          aria-label="Запускать при входе в Windows"
          disabled={enabled === null}
          onClick={() => set(!enabled)}
          className={cn(
            'relative shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50',
            enabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-[#3a3a3a]'
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
              enabled ? 'translate-x-5' : 'translate-x-0'
            )}
          />
        </button>
      </div>

      {error && <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
