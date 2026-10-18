import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { InAppNotification, notificationService } from '../services/notificationService';
import { Avatar } from './Avatar';
import { MessageSquare, X } from 'lucide-react';

interface InAppNotificationToastProps {
  onOpenChat: (chatId: string) => void;
}

export function InAppNotificationToast({ onOpenChat }: InAppNotificationToastProps) {
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);

  useEffect(() => {
    const unsubscribe = notificationService.onInAppNotification((newNotif) => {
      setNotifications(prev => {
        // Keep at most 2 active notifications at once
        const filtered = prev.filter(n => n.chatId !== newNotif.chatId);
        return [newNotif, ...filtered].slice(0, 2);
      });

      // Auto dismiss after 5 seconds
      const timer = setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== newNotif.id));
      }, 5000);

      return () => clearTimeout(timer);
    });

    return unsubscribe;
  }, []);

  const handleDismiss = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleClick = (notif: InAppNotification) => {
    notif.onClick();
    onOpenChat(notif.chatId);
    setNotifications(prev => prev.filter(n => n.id !== notif.id));
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none">
      <AnimatePresence>
        {notifications.map((notif) => (
          <motion.div
            key={notif.id}
            initial={{ opacity: 0, y: -25, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.95 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            onClick={() => handleClick(notif)}
            className="pointer-events-auto cursor-pointer bg-white/95 dark:bg-[#1f1f1f]/95 backdrop-blur-md border border-gray-200 dark:border-gray-800 rounded-2xl p-3.5 shadow-[0_10px_30px_rgba(0,0,0,0.15)] dark:shadow-[0_10px_35px_rgba(0,0,0,0.5)] flex items-center gap-3.5 group hover:border-[#5A5A40]/40 dark:hover:border-[#A0A080]/40 transition-all active:scale-[0.99]"
          >
            <div className="relative shrink-0">
              <Avatar src={notif.senderAvatar} className="w-10 h-10 ring-2 ring-blue-500/30" />
              <div className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full p-1 text-white shadow-sm">
                <MessageSquare className="w-2.5 h-2.5" />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <h4 className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                  {notif.senderName}
                </h4>
                <span className="text-[10px] text-gray-400 shrink-0 font-medium">сейчас</span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-300 truncate mt-0.5">
                {notif.text}
              </p>
            </div>

            <button
              onClick={(e) => handleDismiss(e, notif.id)}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full transition-colors shrink-0"
              title="Закрыть"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
