import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User as UserIcon, Palette, Bell, RefreshCw, Shield, Sun, Moon } from 'lucide-react';
import SetupProfile from './SetupProfile';
import AdminPanel from './AdminPanel';
import { NotificationSettings } from './NotificationSettings';
import { AppearanceSettings } from './AppearanceSettings';
import { UpdateSettings } from './UpdateSettings';
import { useUpdater } from '../hooks/useUpdater';
import { cn } from '../lib/utils';

type TabId = 'profile' | 'appearance' | 'notifications' | 'updates' | 'admin';
type ThemeId = 'light' | 'dark' | 'ocean';

interface SettingsPanelProps {
  theme: string;
  setTheme: (t: ThemeId) => void;
  isAdmin: boolean;
  appVersionName: string;
  onClose: () => void;
  onOpenChangelog: () => void;
}

// Направление смены раздела задаёт, с какой стороны выезжает новое содержимое
const contentVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 28, scale: 0.985 }),
  center: { opacity: 1, x: 0, scale: 1 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -28, scale: 0.985 }),
};

const THEMES: { id: ThemeId; label: string }[] = [
  { id: 'light', label: 'Светлая' },
  { id: 'dark', label: 'Тёмная' },
  { id: 'ocean', label: 'Ocean' },
];

export default function SettingsPanel({ theme, setTheme, isAdmin, appVersionName, onClose, onOpenChangelog }: SettingsPanelProps) {
  const updater = useUpdater();
  const [tab, setTab] = useState<TabId>('profile');
  const [dir, setDir] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'profile', label: 'Профиль', icon: UserIcon },
    { id: 'appearance', label: 'Внешний вид', icon: Palette },
    { id: 'notifications', label: 'Уведомления', icon: Bell },
    ...(updater.supported ? [{ id: 'updates' as TabId, label: 'Обновления', icon: RefreshCw }] : []),
    ...(isAdmin ? [{ id: 'admin' as TabId, label: 'Админ-панель', icon: Shield }] : []),
  ];

  const selectTab = (id: TabId) => {
    if (id === tab) return;
    const from = tabs.findIndex((t) => t.id === tab);
    const to = tabs.findIndex((t) => t.id === id);
    setDir(to > from ? 1 : -1);
    setTab(id);
  };

  // Новый раздел всегда открывается с начала
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [tab]);

  const phase = updater.state?.phase;
  const updateBadge = phase === 'available' || phase === 'downloaded';

  return (
    <div className="flex flex-col h-[min(680px,88vh)]">
      <div className="px-6 py-5 border-b border-black/5 dark:border-white/10 flex items-center justify-between shrink-0">
        <h3 className="text-xl font-serif dark:text-white">Настройки</h3>
        <button
          onClick={onClose}
          aria-label="Закрыть"
          className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full text-gray-400"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex flex-col md:flex-row flex-1 min-h-0">
        {/* Навигация: сверху лентой на узком окне, слева колонкой на широком */}
        <nav className="shrink-0 flex md:flex-col gap-1 overflow-x-auto md:overflow-visible px-4 py-3 md:p-4 md:w-56 border-b md:border-b-0 md:border-r border-black/5 dark:border-white/10">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => selectTab(t.id)}
                className={cn(
                  'relative shrink-0 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors',
                  active ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                )}
              >
                {active && (
                  <motion.span
                    layoutId="settings-tab-pill"
                    className="absolute inset-0 rounded-xl bg-black/[0.06] dark:bg-white/10 ring-1 ring-black/5 dark:ring-white/10"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
                <motion.span
                  className="relative z-10 flex"
                  animate={{ scale: active ? 1.12 : 1, rotate: active ? -6 : 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                >
                  <Icon className="w-4 h-4" />
                </motion.span>
                <span className="relative z-10">{t.label}</span>
                {t.id === 'updates' && updateBadge && (
                  <span className="relative z-10 w-2 h-2 rounded-full bg-blue-500 ml-auto" aria-label="Есть обновление" />
                )}
              </button>
            );
          })}

          <button
            type="button"
            onClick={onOpenChangelog}
            title="Нажмите, чтобы посмотреть историю обновлений"
            className="hidden md:block mt-auto pt-6 text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 uppercase tracking-widest text-left transition-colors px-3.5"
          >
            {appVersionName}
          </button>
        </nav>

        {/* Содержимое раздела */}
        <div ref={scrollRef} className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden p-6">
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.div
              key={tab}
              custom={dir}
              variants={contentVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {tab === 'profile' && (
                <>
                  <h4 className="text-sm font-medium mb-6 dark:text-white">Редактировать профиль</h4>
                  <div className="max-w-md">
                    <SetupProfile onComplete={onClose} fullPage={false} />
                  </div>
                </>
              )}

              {tab === 'appearance' && (
                <div className="space-y-8 max-w-md">
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium dark:text-white">Тема оформления</h4>
                    <div className="grid grid-cols-3 gap-3">
                      {THEMES.map((th) => (
                        <button
                          key={th.id}
                          type="button"
                          onClick={() => setTheme(th.id)}
                          className={cn(
                            'flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border transition-all text-center',
                            theme === th.id
                              ? th.id === 'light'
                                ? 'border-[#5A5A40] bg-gray-50'
                                : th.id === 'dark'
                                  ? 'border-gray-400 bg-gray-800 text-white'
                                  : 'border-cyan-400 bg-[#041f2e] text-white shadow-[0_0_10px_rgba(0,255,255,0.2)]'
                              : 'border-gray-200 dark:border-[#333] hover:bg-gray-100 dark:hover:bg-[#1a1a1a]'
                          )}
                        >
                          {th.id === 'light' && <Sun className="w-5 h-5 text-orange-500" />}
                          {th.id === 'dark' && <Moon className="w-5 h-5 text-blue-400" />}
                          {th.id === 'ocean' && (
                            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 shadow-[0_0_8px_rgba(0,255,255,0.5)]" />
                          )}
                          <span className="text-xs md:text-sm font-medium dark:text-gray-300">{th.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <AppearanceSettings />
                </div>
              )}

              {tab === 'notifications' && (
                <div className="max-w-md">
                  <NotificationSettings />
                </div>
              )}

              {tab === 'updates' && updater.supported && (
                <UpdateSettings updater={updater} appVersionName={appVersionName} onOpenChangelog={onOpenChangelog} />
              )}

              {tab === 'admin' && isAdmin && <AdminPanel />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* На узком окне версия внизу под содержимым */}
      <div className="md:hidden px-6 pb-4 pt-2 border-t border-black/5 dark:border-white/10 shrink-0">
        <button
          type="button"
          onClick={onOpenChangelog}
          className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 uppercase tracking-widest w-full text-center"
        >
          {appVersionName}
        </button>
      </div>
    </div>
  );
}
