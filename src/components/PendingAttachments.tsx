import React from 'react';
import { X, Plus, File as FileIcon, Film, Trash2 } from 'lucide-react';
import { formatBytes } from '../lib/fileUtils';

export interface PendingFile {
  id: string;
  file: File;
  caption: string;
  previewUrl: string | null; // для картинок: превью до отправки
}

// Выбранные файлы ещё не отправлены: их можно убрать и добавить к каждому подпись (как в Discord)
export function PendingAttachments({
  items,
  onCaption,
  onRemove,
  onAddMore,
  onClear,
  onSend,
}: {
  items: PendingFile[];
  onCaption: (id: string, text: string) => void;
  onRemove: (id: string) => void;
  onAddMore: () => void;
  onClear: () => void;
  onSend: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="relative isolate mb-2 rounded-[22px] p-3 text-gray-900 dark:text-gray-100">
      <div aria-hidden="true" className="glass-bar absolute inset-0 -z-10 rounded-[22px] pointer-events-none" />
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-xs font-semibold text-blue-500">Вложения: {items.length}</p>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onAddMore} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] hover:bg-black/10 dark:hover:bg-white/10">
            <Plus className="w-3.5 h-3.5" />
            Добавить
          </button>
          <button type="button" onClick={onClear} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-red-500 hover:bg-red-500/10">
            <Trash2 className="w-3.5 h-3.5" />
            Убрать все
          </button>
        </div>
      </div>

      <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
        {items.map((it) => (
          <div key={it.id} className="flex items-center gap-3 rounded-2xl p-2 bg-black/[0.05] dark:bg-white/[0.07]">
            <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 flex items-center justify-center bg-black/10 dark:bg-white/10">
              {it.previewUrl ? (
                <img src={it.previewUrl} alt="" draggable={false} className="w-full h-full object-cover" />
              ) : it.file.type.startsWith('video/') ? (
                <Film className="w-5 h-5 opacity-70" />
              ) : (
                <FileIcon className="w-5 h-5 opacity-70" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <p className="text-xs font-medium truncate" title={it.file.name}>
                  {it.file.name}
                </p>
                <span className="text-[10px] opacity-60 shrink-0">{formatBytes(it.file.size)}</span>
              </div>
              <input
                type="text"
                value={it.caption}
                maxLength={1000}
                placeholder="Добавить подпись..."
                onChange={(e) => onCaption(it.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onSend();
                  }
                }}
                className="mt-1 w-full min-w-0 bg-transparent border-b border-black/10 dark:border-white/15 focus:border-blue-500 outline-none text-base sm:text-xs py-0.5 placeholder:opacity-50"
              />
            </div>
            <button type="button" onClick={() => onRemove(it.id)} aria-label="Убрать файл" title="Убрать файл" className="shrink-0 p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      <p className="mt-2 px-1 text-[10px] opacity-60">Файлы уйдут получателю напрямую, до 10 ГБ каждый. Enter или кнопка отправки: отправить.</p>
    </div>
  );
}
