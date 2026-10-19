import React, { useEffect, useState } from 'react';
import { ChangelogItem, AppConfig } from '../types';
import { chatService } from '../services/chatService';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, Clock, CheckCircle2, ChevronRight, Layers } from 'lucide-react';

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
  appVersionName?: string;
}

export const ChangelogModal: React.FC<ChangelogModalProps> = ({ isOpen, onClose, appVersionName }) => {
  const [changelogs, setChangelogs] = useState<ChangelogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    chatService.getChangelogs()
      .then(items => {
        setChangelogs(items);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
      />

      {/* Modal Dialog */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative w-full max-w-lg max-h-[85vh] flex flex-col bg-white dark:bg-[#161616] rounded-[28px] shadow-2xl border border-gray-100 dark:border-[#2a2a2a] z-10 overflow-hidden"
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-100 dark:border-[#262626] flex items-center justify-between shrink-0 bg-gray-50/50 dark:bg-[#1a1a1a]/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold dark:text-white flex items-center gap-2">
                <span>Что нового</span>
                {appVersionName && (
                  <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-300">
                    {appVersionName}
                  </span>
                )}
              </h3>
              <p className="text-xs text-gray-400">История обновлений и улучшений мессенджера</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#2a2a2a] rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
          {loading ? (
            <div className="py-12 text-center text-xs text-gray-400">
              Загрузка списка обновлений...
            </div>
          ) : changelogs.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Layers className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600" />
              <p className="text-xs text-gray-400">Пока нет записей об обновлениях.</p>
            </div>
          ) : (
            changelogs.map((item, idx) => {
              const formattedDate = item.createdAt
                ? new Date((item.createdAt as any).toDate ? (item.createdAt as any).toDate() : (item.createdAt as any).seconds * 1000).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })
                : null;

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    idx === 0
                      ? 'bg-gradient-to-br from-blue-50/50 to-indigo-50/30 dark:from-blue-950/20 dark:to-indigo-950/10 border-blue-200/80 dark:border-blue-900/40'
                      : 'bg-gray-50/60 dark:bg-[#1a1a1a]/60 border-gray-100 dark:border-[#2a2a2a]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white font-bold text-[10px] tracking-wide">
                        {item.version}
                      </span>
                      <h4 className="text-sm font-semibold dark:text-white">
                        {item.title}
                      </h4>
                    </div>
                    {formattedDate && (
                      <span className="text-[11px] text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formattedDate}
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed mt-2 pt-2 border-t border-gray-200/60 dark:border-[#2a2a2a]">
                    {item.content}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-[#262626] bg-gray-50/50 dark:bg-[#1a1a1a]/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 rounded-xl text-xs font-semibold transition-colors shadow-sm"
          >
            Закрыть
          </button>
        </div>
      </motion.div>
    </div>
  );
};
