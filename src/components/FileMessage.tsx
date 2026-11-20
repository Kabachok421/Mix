import React from 'react';
import { Download, File as FileIcon, FileText, Archive, Music, Film, Loader2, X, RotateCcw, Check, Info } from 'lucide-react';
import { LinkifiedText } from './LinkifiedText';
import { useP2PFile, useHostActivity } from '../hooks/useP2PFile';
import { formatBytes, formatEta } from '../lib/fileUtils';
import type { Message } from '../types';
import { cn } from '../lib/utils';

const TINT: React.CSSProperties = { background: 'color-mix(in srgb, currentColor 11%, transparent)' };

function iconFor(name = '', mime = '') {
  if (mime.startsWith('video/') || /\.(mp4|webm|mov|mkv)$/i.test(name)) return Film;
  if (mime.startsWith('audio/') || /\.(mp3|wav|ogg|flac|m4a)$/i.test(name)) return Music;
  if (/\.(zip|rar|7z|tar|gz)$/i.test(name)) return Archive;
  if (/\.(pdf|docx?|txt|rtf|xlsx?|pptx?)$/i.test(name)) return FileText;
  return FileIcon;
}

function Progress({ value }: { value: number }) {
  return (
    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'color-mix(in srgb, currentColor 20%, transparent)' }}>
      <div className="h-full rounded-full bg-blue-500 transition-[width] duration-300" style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
    </div>
  );
}

function Caption({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <p className="mt-2 whitespace-pre-wrap [overflow-wrap:anywhere]">
      <LinkifiedText text={text} />
    </p>
  );
}

// Карточка файла: имя, размер, кнопка справа и строка состояния под ней
function Card({ message, action, children, preview }: { message: Message; action?: React.ReactNode; children?: React.ReactNode; preview?: React.ReactNode }) {
  const Icon = iconFor(message.fileName, message.mimeType);
  return (
    <div className="w-[270px] max-w-full">
      {preview}
      <div className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={TINT}>
        <Icon className="w-6 h-6 shrink-0 opacity-80" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate" title={message.fileName}>
            {message.fileName || 'Файл'}
          </p>
          <p className="text-[11px] opacity-70">{formatBytes(message.fileSize)}</p>
        </div>
        {action}
      </div>
      {children && <div className="mt-1.5 px-1 text-[11px] leading-snug space-y-1">{children}</div>}
      <Caption text={message.text} />
    </div>
  );
}

function thumbPreview(message: Message, savedUrl?: string | null) {
  const mime = message.mimeType || '';
  if (savedUrl && mime.startsWith('video/')) return <video src={savedUrl} controls className="w-full rounded-xl mb-2 max-h-64 bg-black" />;
  if (savedUrl && mime.startsWith('audio/')) return <audio src={savedUrl} controls className="w-full mb-2" />;
  const src = savedUrl && mime.startsWith('image/') ? savedUrl : message.thumbnail;
  if (!src) return null;
  return <img src={src} alt="" draggable={false} className="w-full rounded-xl mb-2 max-h-64 object-cover" />;
}

const btn = 'shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors';
const iconBtn = 'shrink-0 p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors';

function ReceiverFile({ message, chatId }: { message: Message; chatId: string }) {
  const { state, start, cancel } = useP2PFile(chatId, message);
  const busy = state.phase === 'connecting' || state.phase === 'transferring';

  let action: React.ReactNode = null;
  if (state.phase === 'idle') {
    action = (
      <button type="button" onClick={start} className={btn}>
        <Download className="w-3.5 h-3.5" />
        Скачать
      </button>
    );
  } else if (busy) {
    action = (
      <button type="button" onClick={cancel} className={iconBtn} title="Отменить">
        <X className="w-4 h-4" />
      </button>
    );
  } else if (state.phase === 'saved') {
    action = <Check className="w-5 h-5 text-emerald-500 shrink-0" />;
  } else if (state.phase === 'error') {
    action = (
      <button type="button" onClick={start} className={btn}>
        <RotateCcw className="w-3.5 h-3.5" />
        {state.resumable ? 'Продолжить' : 'Повторить'}
      </button>
    );
  }

  let status: React.ReactNode = null;
  if (state.phase === 'idle') {
    status = <p className="opacity-70">Файл передаётся напрямую от отправителя, он должен быть в сети.</p>;
  } else if (state.phase === 'connecting') {
    status = (
      <p className="flex items-center gap-1.5 opacity-80">
        <Loader2 className="w-3 h-3 animate-spin" />
        Подключение к отправителю...
      </p>
    );
  } else if (state.phase === 'transferring') {
    const pct = state.total ? (state.received / state.total) * 100 : 0;
    const eta = state.speed > 0 ? formatEta((state.total - state.received) / state.speed) : '';
    status = (
      <>
        <Progress value={pct} />
        <p className="opacity-80 tabular-nums">
          {Math.floor(pct)}% · {formatBytes(state.received)} из {formatBytes(state.total)}
          {state.speed > 0 && ` · ${formatBytes(state.speed)}/с`}
          {eta && ` · ещё ${eta}`}
        </p>
      </>
    );
  } else if (state.phase === 'saved') {
    status = <p className="opacity-80">{state.savedTo === 'disk' ? 'Сохранено на устройстве' : 'Файл сохранён в «Загрузки»'}</p>;
  } else {
    status = (
      <>
        <p className="text-red-500 dark:text-red-400">{state.message}</p>
        {state.resumable && <p className="opacity-70">Получено {formatBytes(state.received)}, можно продолжить с этого места.</p>}
      </>
    );
  }

  return (
    <Card message={message} action={action} preview={thumbPreview(message, state.phase === 'saved' ? state.previewUrl : null)}>
      {status}
    </Card>
  );
}

function SenderFile({ message }: { message: Message }) {
  const { available, activity } = useHostActivity(message.id);
  const pct = activity && activity.total ? (activity.sent / activity.total) * 100 : 0;
  return (
    <Card message={message} preview={thumbPreview(message)}>
      {activity?.sending ? (
        <>
          <Progress value={pct} />
          <p className="opacity-80 tabular-nums">Передаётся получателю: {Math.floor(pct)}%</p>
        </>
      ) : available ? (
        <p className="opacity-70">Файл доступен для скачивания, пока открыт Mix. Не закрывайте приложение, пока собеседник не скачает.</p>
      ) : (
        <p className="flex items-start gap-1.5 opacity-80">
          <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
          Файл больше недоступен для скачивания: Mix закрывали после отправки.
        </p>
      )}
    </Card>
  );
}

// Сообщения, отправленные прежними способами (через сервер): картинки-вставки ещё видны, остальное недоступно
function LegacyFile({ message }: { message: Message }) {
  const inline = message.url && message.url.startsWith('data:');
  if (inline && message.url!.startsWith('data:image/')) {
    return (
      <div className="w-[270px] max-w-full">
        <img src={message.url} alt="" draggable={false} className="w-full rounded-xl max-h-64 object-cover" />
        <Caption text={message.text} />
      </div>
    );
  }
  return (
    <Card message={message}>
      <p className="opacity-70">Файл отправлен прежним способом и больше недоступен.</p>
    </Card>
  );
}

export function FileMessage({ message, chatId, isMe }: { message: Message; chatId: string; isMe: boolean }) {
  if (!message.p2p) return <LegacyFile message={message} />;
  return isMe ? <SenderFile message={message} /> : <ReceiverFile message={message} chatId={chatId} />;
}
