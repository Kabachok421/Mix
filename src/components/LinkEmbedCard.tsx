import React from 'react';
import { X } from 'lucide-react';
import { LinkEmbed } from '../lib/linkUtils';
import { cn } from '../lib/utils';

// Вложение-превью ссылки (как в Discord): название сайта, заголовок, описание и картинка.
// В поле ввода (передан onDismiss) в углу есть крестик «Открепить», в сообщении карточка открывает ссылку.
export function LinkEmbedCard({
  embed,
  onDismiss,
  loading,
  className,
}: {
  embed: LinkEmbed | null;
  onDismiss?: () => void;
  loading?: boolean;
  className?: string;
}) {
  const compact = !!onDismiss;
  const body = loading && !embed ? (
    <div className="px-3 py-3 space-y-2 animate-pulse">
      <div className="h-2.5 w-24 rounded bg-current opacity-20" />
      <div className="h-3.5 w-48 rounded bg-current opacity-25" />
      <div className="h-2.5 w-40 rounded bg-current opacity-15" />
    </div>
  ) : embed ? (
    <>
      <div className={cn('px-3 py-2 space-y-1', onDismiss && 'pr-9')}>
        {embed.siteName && <p className="text-[11px] opacity-70 truncate">{embed.siteName}</p>}
        {embed.title && <p className="msg-link text-sm font-semibold leading-snug line-clamp-2 break-words">{embed.title}</p>}
        {embed.description && (
          <p className={cn('text-xs opacity-80 break-words', compact ? 'line-clamp-2' : 'line-clamp-3')}>{embed.description}</p>
        )}
        {!embed.title && !embed.description && <p className="msg-link text-xs break-all line-clamp-2">{embed.url}</p>}
      </div>
      {embed.image && (
        <img
          src={embed.image}
          alt=""
          draggable={false}
          className={cn('w-full object-cover', compact ? 'max-h-24' : 'max-h-52')}
        />
      )}
    </>
  ) : null;

  if (!body) return null;

  const shell = cn('relative block w-[300px] max-w-full overflow-hidden rounded-lg text-left', className);
  const shellStyle: React.CSSProperties = {
    background: 'color-mix(in srgb, currentColor 11%, transparent)',
    borderLeft: '4px solid #3b82f6',
  };

  // Сообщение: вся карточка ссылка. Поле ввода: просто предпросмотр с кнопкой «Открепить».
  if (!onDismiss && embed) {
    return (
      <a href={embed.url} target="_blank" rel="noopener noreferrer" className={cn(shell, 'no-underline hover:brightness-110 transition')} style={shellStyle}>
        {body}
      </a>
    );
  }

  return (
    <div className={shell} style={shellStyle}>
      {body}
      <button
        type="button"
        onClick={onDismiss}
        title="Открепить вложение"
        aria-label="Открепить вложение"
        className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/45 text-white hover:bg-black/65 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
