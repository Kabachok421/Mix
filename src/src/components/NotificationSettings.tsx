import React, { useState, useEffect, useRef } from 'react';
import { notificationService, NotificationSettings as SettingsType } from '../services/notificationService';
import { Bell, BellOff, Volume2, VolumeX, MessageSquare, Check, Sparkles, Music, Upload, Play, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';

export function NotificationSettings() {
  const [settings, setSettings] = useState<SettingsType>(notificationService.getSettings());
  const [permission, setPermission] = useState<NotificationPermission>(notificationService.getPermissionStatus());
  const [testSent, setTestSent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [soundBusy, setSoundBusy] = useState(false);
  const [soundError, setSoundError] = useState<string | null>(null);

  useEffect(() => {
    setPermission(notificationService.getPermissionStatus());
  }, []);

  const handleToggleSound = () => {
    const next = !settings.soundEnabled;
    const updated = { ...settings, soundEnabled: next };
    setSettings(updated);
    notificationService.saveSettings({ soundEnabled: next });
    if (next) {
      notificationService.playNotificationSound('incoming');
    }
  };

  const handlePickSound = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // чтобы тот же файл можно было выбрать повторно
    if (!file) return;
    setSoundBusy(true);
    setSoundError(null);
    try {
      await notificationService.setCustomSound(file);
      setSettings(notificationService.getSettings());
      notificationService.previewSound();
    } catch (err: any) {
      setSoundError(err?.message || 'Не удалось загрузить звук');
    } finally {
      setSoundBusy(false);
    }
  };

  const handleResetSound = async () => {
    await notificationService.clearCustomSound();
    setSettings(notificationService.getSettings());
    setSoundError(null);
  };

  const handleToggleDesktop = async () => {
    if (!notificationService.isDesktopNotificationSupported()) return;

    if (permission !== 'granted') {
      const res = await notificationService.requestPermission();
      setPermission(res);
      if (res === 'granted') {
        notificationService.saveSettings({ desktopEnabled: true });
        setSettings(prev => ({ ...prev, desktopEnabled: true }));
        notificationService.playNotificationSound('incoming');
      }
    } else {
      const next = !settings.desktopEnabled;
      const updated = { ...settings, desktopEnabled: next };
      setSettings(updated);
      notificationService.saveSettings({ desktopEnabled: next });
    }
  };

  const handleToggleInApp = () => {
    const next = !settings.inAppBannerEnabled;
    const updated = { ...settings, inAppBannerEnabled: next };
    setSettings(updated);
    notificationService.saveSettings({ inAppBannerEnabled: next });
  };

  const handleTestNotification = async () => {
    notificationService.playNotificationSound('incoming');
    notificationService.notifyNewMessage({
      chatId: 'test_notification',
      senderName: 'Mix Messenger',
      text: 'Тестовое уведомление: звук и оповещение работают отлично! 🎉',
      isCurrentChatActive: false,
      onOpenChat: () => {}
    });

    setTestSent(true);
    setTimeout(() => setTestSent(false), 3000);
  };

  const isDesktopSupported = notificationService.isDesktopNotificationSupported();

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium dark:text-white flex items-center gap-2">
        <Bell className="w-4 h-4 text-[#5A5A40] dark:text-[#A0A080]" />
        Уведомления о сообщениях
      </h4>

      <div className="space-y-2.5">
        {/* Звуковые оповещения */}
        <div 
          onClick={handleToggleSound}
          className="flex items-center justify-between p-3 rounded-2xl border border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#1a1a1a] cursor-pointer transition-all gap-3"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={cn(
              "w-8 h-8 rounded-xl flex items-center justify-center transition-colors shrink-0",
              settings.soundEnabled 
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                : "bg-gray-100 dark:bg-gray-800 text-gray-400"
            )}>
              {settings.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs md:text-sm font-medium text-gray-900 dark:text-gray-100 truncate">Звук сообщений</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2">Приятный сигнал при получении нового сообщения</p>
            </div>
          </div>
          <div
            role="switch"
            aria-checked={settings.soundEnabled}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out",
              settings.soundEnabled ? "bg-[#5A5A40] dark:bg-[#A0A080]" : "bg-gray-300 dark:bg-gray-700"
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out shrink-0",
                settings.soundEnabled ? "translate-x-5" : "translate-x-0"
              )}
            />
          </div>
        </div>

        {/* Свой звук уведомления */}
        <div className="p-3 rounded-2xl border border-gray-200 dark:border-[#333] space-y-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Music className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs md:text-sm font-medium text-gray-900 dark:text-gray-100 truncate">Свой звук уведомления</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                {settings.customSoundName ? settings.customSoundName : 'Сейчас: стандартный звук'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={soundBusy} className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-gray-200 dark:border-[#333] text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#252525] disabled:opacity-50 transition-all">
              <Upload className="w-3.5 h-3.5" />
              Загрузить
            </button>
            <button type="button" onClick={() => notificationService.previewSound()} className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-gray-200 dark:border-[#333] text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#252525] disabled:opacity-50 transition-all">
              <Play className="w-3.5 h-3.5" />
              Прослушать
            </button>
            {settings.customSoundName && (
              <button type="button" onClick={handleResetSound} className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-gray-200 dark:border-[#333] text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#252525] disabled:opacity-50 transition-all">
                <Trash2 className="w-3.5 h-3.5" />
                Сбросить
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.opus"
            className="hidden"
            onChange={handlePickSound}
          />
          {soundError && <p className="text-[11px] text-red-600 dark:text-red-400">{soundError}</p>}
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            MP3, WAV, OGG или M4A, до 10 секунд и 2 МБ. Звук хранится на этом устройстве и слышен только вам.
          </p>
        </div>

        {/* Системные уведомления браузера */}
        <div 
          onClick={handleToggleDesktop}
          className={cn(
            "flex items-center justify-between p-3 rounded-2xl border border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#1a1a1a] cursor-pointer transition-all gap-3",
            !isDesktopSupported && "opacity-50 cursor-not-allowed"
          )}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={cn(
              "w-8 h-8 rounded-xl flex items-center justify-center transition-colors shrink-0",
              settings.desktopEnabled && permission === 'granted'
                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" 
                : "bg-gray-100 dark:bg-gray-800 text-gray-400"
            )}>
              {settings.desktopEnabled && permission === 'granted' ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs md:text-sm font-medium text-gray-900 dark:text-gray-100">Уведомления браузера</p>
                {permission === 'granted' && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded font-medium">Включено</span>
                )}
                {permission === 'denied' && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded font-medium">Заблокировано</span>
                )}
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2">
                {permission === 'granted' 
                  ? 'Показываются на рабочем столе даже когда вкладка свернута'
                  : permission === 'denied' 
                    ? 'Заблокировано в настройках браузера для этой страницы'
                    : 'Нажмите, чтобы предоставить разрешение браузера'}
              </p>
            </div>
          </div>
          <div
            role="switch"
            aria-checked={settings.desktopEnabled && permission === 'granted'}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out",
              settings.desktopEnabled && permission === 'granted' ? "bg-[#5A5A40] dark:bg-[#A0A080]" : "bg-gray-300 dark:bg-gray-700"
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out shrink-0",
                settings.desktopEnabled && permission === 'granted' ? "translate-x-5" : "translate-x-0"
              )}
            />
          </div>
        </div>

        {/* Всплывающие баннеры внутри приложения */}
        <div 
          onClick={handleToggleInApp}
          className="flex items-center justify-between p-3 rounded-2xl border border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#1a1a1a] cursor-pointer transition-all gap-3"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={cn(
              "w-8 h-8 rounded-xl flex items-center justify-center transition-colors shrink-0",
              settings.inAppBannerEnabled 
                ? "bg-purple-500/10 text-purple-600 dark:text-purple-400" 
                : "bg-gray-100 dark:bg-gray-800 text-gray-400"
            )}>
              <MessageSquare className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs md:text-sm font-medium text-gray-900 dark:text-gray-100 truncate">Баннеры в приложении</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2">Всплывающие подсказки сверху при новых сообщениях</p>
            </div>
          </div>
          <div
            role="switch"
            aria-checked={settings.inAppBannerEnabled}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out",
              settings.inAppBannerEnabled ? "bg-[#5A5A40] dark:bg-[#A0A080]" : "bg-gray-300 dark:bg-gray-700"
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out shrink-0",
                settings.inAppBannerEnabled ? "translate-x-5" : "translate-x-0"
              )}
            />
          </div>
        </div>
      </div>

      {/* Кнопка проверки звука и уведомления */}
      <button
        onClick={handleTestNotification}
        className={cn(
          "w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border text-xs font-medium transition-all shadow-sm",
          testSent 
            ? "bg-emerald-500 text-white border-emerald-500" 
            : "border-gray-200 dark:border-[#333] text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#252525]"
        )}
      >
        {testSent ? (
          <>
            <Check className="w-3.5 h-3.5" />
            Уведомление отправлено!
          </>
        ) : (
          <>
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Проверить звук и уведомление
          </>
        )}
      </button>
    </div>
  );
}
