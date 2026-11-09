import React from 'react';
import { motion } from 'motion/react';
import { RefreshCw, Download, RotateCw, CheckCircle2, AlertTriangle, Loader2, Sparkles } from 'lucide-react';
import { UpdaterApi } from '../hooks/useUpdater';
import { cn } from '../lib/utils';

const primaryBtn =
  'w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium text-white bg-gradient-to-br from-indigo-500 to-purple-500 hover:brightness-110 disabled:opacity-60 disabled:cursor-default transition-all';
const neutralBtn =
  'w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium border border-gray-200 dark:border-[#333] text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-[#252525] disabled:opacity-60 disabled:cursor-default transition-all';

export function UpdateSettings({
  updater,
  appVersionName,
  onOpenChangelog,
}: {
  updater: UpdaterApi;
  appVersionName: string;
  onOpenChangelog: () => void;
}) {
  const { state } = updater;
  const phase = state?.phase ?? 'idle';
  const lastChecked = state?.lastChecked
    ? new Date(state.lastChecked).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : null;

  let statusIcon = <CheckCircle2 className="w-5 h-5 text-gray-400" />;
  let statusText = 'Нажмите «Проверить обновления», чтобы узнать о новой версии.';
  if (phase === 'checking') {
    statusIcon = <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
    statusText = 'Проверяем наличие обновлений...';
  } else if (phase === 'uptodate') {
    statusIcon = <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
    statusText = 'У вас установлена последняя версия.';
  } else if (phase === 'available') {
    statusIcon = <Download className="w-5 h-5 text-blue-500" />;
    statusText = `Доступна новая версия ${state?.version ?? ''}.`;
  } else if (phase === 'downloading') {
    statusIcon = <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
    statusText = `Загрузка версии ${state?.version ?? ''}...`;
  } else if (phase === 'downloaded') {
    statusIcon = <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
    statusText = `Версия ${state?.version ?? ''} загружена и готова к установке.`;
  } else if (phase === 'error') {
    statusIcon = <AlertTriangle className="w-5 h-5 text-red-500" />;
    statusText = 'Не удалось выполнить обновление.';
  }

  const percent = state?.percent ?? 0;
  const mbps = (state?.speed ?? 0) / 1048576;

  return (
    <div className="space-y-4 max-w-md">
      <h4 className="text-sm font-medium dark:text-white flex items-center gap-2">
        <RefreshCw className="w-4 h-4 text-[#5A5A40] dark:text-[#A0A080]" />
        Обновления
      </h4>

      <div className="p-4 rounded-2xl border border-gray-200 dark:border-[#333] space-y-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0">{statusIcon}</div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Mix {state?.currentVersion ?? ''}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{statusText}</p>
            {phase === 'error' && state?.message && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1 break-words">{state.message}</p>
            )}
            {lastChecked && phase !== 'checking' && (
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">Последняя проверка: {lastChecked}</p>
            )}
          </div>
        </div>

        {phase === 'downloading' && (
          <div className="space-y-1.5">
            <div className="h-2 rounded-full bg-gray-200 dark:bg-[#2a2a2a] overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
                initial={false}
                animate={{ width: `${percent}%` }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-gray-500 dark:text-gray-400 tabular-nums">
              <span>{percent}%</span>
              <span>{mbps > 0.05 ? `${mbps.toFixed(1)} МБ/с` : ''}</span>
            </div>
          </div>
        )}

        {phase === 'available' && (
          <button type="button" onClick={updater.download} className={primaryBtn}>
            <Download className="w-4 h-4" />
            Download
          </button>
        )}
        {phase === 'downloaded' && (
          <button type="button" onClick={updater.restart} className={primaryBtn}>
            <RotateCw className="w-4 h-4" />
            Restart
          </button>
        )}
        {(phase === 'idle' || phase === 'uptodate' || phase === 'error' || phase === 'checking') && (
          <button type="button" onClick={updater.check} disabled={phase === 'checking'} className={cn(neutralBtn)}>
            <RefreshCw className={cn('w-4 h-4', phase === 'checking' && 'animate-spin')} />
            {phase === 'checking' ? 'Проверка...' : 'Проверить обновления'}
          </button>
        )}
        {phase === 'error' && state?.version && (
          <button type="button" onClick={updater.download} className={primaryBtn}>
            <Download className="w-4 h-4" />
            Повторить загрузку
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onOpenChangelog}
        className="w-full flex items-center justify-between p-3 rounded-2xl border border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#202020] transition-all text-xs font-medium text-gray-700 dark:text-gray-200"
      >
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>Что нового в мессенджере</span>
        </div>
        <span className="text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full font-bold truncate max-w-[45%]">
          {appVersionName}
        </span>
      </button>

      <p className="text-[11px] text-gray-400 dark:text-gray-500">
        Приложение само проверяет обновления в фоне. Скачиваются только изменившиеся части.
      </p>
    </div>
  );
}
