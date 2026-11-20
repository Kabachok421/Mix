import { useEffect, useState } from 'react';
import { p2p } from '../services/p2pFirestore';
import { openSink, type DownloadSink } from '../services/fileSink';
import { TransferError } from '../services/p2pCore';
import type { HostActivity } from '../services/p2pEngine';
import type { Message } from '../types';

export type P2PState =
  | { phase: 'idle' }
  | { phase: 'connecting' }
  | { phase: 'transferring'; received: number; total: number; speed: number }
  | { phase: 'saved'; previewUrl: string | null; savedTo: 'disk' | 'downloads' }
  | { phase: 'error'; message: string; received: number; resumable: boolean };

interface Job {
  state: P2PState;
  sink?: DownloadSink;
  abort?: AbortController;
  running: boolean;
  cancelled: boolean;
  listeners: Set<() => void>;
}

// Скачивания живут здесь, а не в компоненте: если уйти в другой чат, загрузка не прервётся
const jobs = new Map<string, Job>();
const keyOf = (chatId: string, messageId: string) => `${chatId}/${messageId}`;

function getJob(key: string): Job {
  let j = jobs.get(key);
  if (!j) {
    j = { state: { phase: 'idle' }, running: false, cancelled: false, listeners: new Set() };
    jobs.set(key, j);
  }
  return j;
}
function setState(j: Job, s: P2PState) {
  j.state = s;
  j.listeners.forEach((cb) => cb());
}

function saveToDownloads(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// Нужно вызывать сразу из клика: окно «Сохранить как» открывается только по действию пользователя
function startDownload(chatId: string, msg: Message) {
  const key = keyOf(chatId, msg.id);
  const job = getJob(key);
  if (job.running) return;
  job.running = true;
  job.cancelled = false;
  const fileName = msg.fileName || 'file';
  const size = msg.fileSize || 0;

  (async () => {
    try {
      setState(job, { phase: 'connecting' });
      if (!job.sink) job.sink = await openSink(fileName, size); // здесь пользователь выбирает, куда сохранить
      job.abort = new AbortController();
      let lastT = performance.now();
      let lastBytes = job.sink.received;
      let speed = 0;
      await p2p.download({
        chatId,
        messageId: msg.id,
        senderId: msg.senderId,
        size,
        sink: job.sink,
        signal: job.abort.signal,
        onProgress: (received, total) => {
          const now = performance.now();
          if (now - lastT >= 700) {
            const inst = ((received - lastBytes) / (now - lastT)) * 1000;
            speed = speed ? speed * 0.6 + inst * 0.4 : inst;
            lastT = now;
            lastBytes = received;
          }
          setState(job, { phase: 'transferring', received, total, speed });
        },
      });
      const sink = job.sink;
      const blob = await sink.close();
      if (sink.kind !== 'filesystem' && blob) saveToDownloads(blob, fileName);
      setState(job, { phase: 'saved', previewUrl: blob ? URL.createObjectURL(blob) : null, savedTo: sink.kind === 'filesystem' ? 'disk' : 'downloads' });
      job.sink = undefined;
    } catch (err: any) {
      const code = err instanceof TransferError ? err.code : undefined;
      if (!job.sink && code === 'cancelled') {
        setState(job, { phase: 'idle' }); // закрыли окно «Сохранить как»
      } else if (job.cancelled) {
        await job.sink?.abort();
        job.sink = undefined;
        setState(job, { phase: 'idle' });
      } else {
        const received = job.sink?.received ?? 0;
        const fatal = code === 'mismatch' || code === 'sink' || !job.sink;
        if (fatal && job.sink) {
          await job.sink.abort();
          job.sink = undefined;
        }
        setState(job, { phase: 'error', message: err?.message || 'Не удалось получить файл', received: fatal ? 0 : received, resumable: !fatal && received > 0 });
      }
    } finally {
      job.running = false;
    }
  })();
}

function cancelDownload(chatId: string, messageId: string) {
  const job = jobs.get(keyOf(chatId, messageId));
  if (!job) return;
  job.cancelled = true;
  job.abort?.abort();
}

export function useP2PFile(chatId: string, message: Message) {
  const key = keyOf(chatId, message.id);
  const [, tick] = useState(0);
  useEffect(() => {
    const job = getJob(key);
    const cb = () => tick((n) => n + 1);
    job.listeners.add(cb);
    return () => {
      job.listeners.delete(cb);
    };
  }, [key]);
  const state = jobs.get(key)?.state ?? ({ phase: 'idle' } as P2PState);
  return {
    state,
    start: () => startDownload(chatId, message),
    cancel: () => cancelDownload(chatId, message.id),
  };
}

// Состояние отправителя: файл ещё доступен для скачивания и идёт ли сейчас передача
export function useHostActivity(messageId: string): { available: boolean; activity: HostActivity | null } {
  const [, tick] = useState(0);
  useEffect(() => p2p.host.subscribe(messageId, () => tick((n) => n + 1)), [messageId]);
  return { available: p2p.host.has(messageId), activity: p2p.host.getActivity(messageId) };
}
