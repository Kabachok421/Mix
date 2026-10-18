import React, { useState, useEffect } from 'react';
import { notificationService } from '../services/notificationService';
import { Bell, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function NotificationPromptBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Only show if desktop notification is supported, permission is 'default', and user hasn't dismissed it
    if (notificationService.isDesktopNotificationSupported()) {
      const isDismissed = localStorage.getItem('mix_notif_banner_dismissed') === 'true';
      if (Notification.permission === 'default' && !isDismissed) {
        setShow(true);
      }
    }
  }, []);

  const handleEnable = async () => {
    const res = await notificationService.requestPermission();
    if (res === 'granted') {
      notificationService.playNotificationSound('incoming');
      notificationService.notifyNewMessage({
        chatId: 'system',
        senderName: 'Mix Messenger',
        text: 'Уведомления успешно включены! Вы не пропустите ни одного сообщения.',
        isCurrentChatActive: false,
        onOpenChat: () => {}
      });
    }
    setShow(false);
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem('mix_notif_banner_dismissed', 'true');
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className="px-4 py-2.5 bg-gradient-to-r from-[#5A5A40]/10 via-[#5A5A40]/5 to-transparent dark:from-[#A0A080]/15 dark:via-[#A0A080]/5 border-b border-[#5A5A40]/10 dark:border-[#A0A080]/10"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[#5A5A40] dark:bg-[#A0A080] text-white dark:text-[#111] flex items-center justify-center shrink-0 shadow-sm">
              <Bell className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
                Включите уведомления
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                Чтобы не пропускать новые сообщения в фоне
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleEnable}
              className="text-xs px-2.5 py-1 bg-[#5A5A40] hover:bg-[#484833] dark:bg-[#A0A080] dark:hover:bg-[#8e8e70] text-white dark:text-[#111] rounded-lg font-medium transition-colors shadow-sm"
            >
              Включить
            </button>
            <button
              onClick={handleDismiss}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors"
              title="Скрыть"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
