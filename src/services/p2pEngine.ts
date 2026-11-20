// Движок прямой передачи файлов. Файл остаётся на устройстве отправителя, а получатель скачивает его, когда нажмёт «Скачать».
// Сигнальные сообщения (кто к кому подключается) идут через документы Firestore chats/{чат}/transfers/{id}:
//   получатель создаёт запрос с предложением соединения -> отправитель отвечает -> дальше данные идут напрямую.
// На соединение уходит около двух записей в базу, сам файл через Firebase не проходит.

import type { DownloadSink } from './fileSink';
import { TransferError, serveFile, receiveFile } from './p2pCore';

export interface TransferDoc {
  id: string;
  messageId: string;
  senderId: string;
  receiverId: string;
  offer: string;
  answer?: string;
  status: 'requested' | 'answered' | 'rejected';
  offset?: number;
  createdAtMs?: number;
  reason?: string;
}

// Хранилище сигналов. В приложении это Firestore, в тестах память.
export interface SignalingBackend {
  create(chatId: string, id: string, data: Omit<TransferDoc, 'id' | 'createdAtMs'>): Promise<void>;
  answer(chatId: string, id: string, patch: { answer?: string; status: 'answered' | 'rejected'; reason?: string }): Promise<void>;
  remove(chatId: string, id: string): Promise<void>;
  watchDoc(chatId: string, id: string, cb: (d: TransferDoc | null) => void): () => void;
  watchRequests(chatId: string, senderId: string, cb: (docs: TransferDoc[]) => void): () => void;
}

export interface HostActivity {
  sending: boolean;
  sent: number;
  total: number;
}

interface EngineOptions {
  backend: SignalingBackend;
  getUserId: () => string | null;
  getIceServers: () => RTCIceServer[];
  newPeer?: (cfg: RTCConfiguration) => RTCPeerConnection;
  now?: () => number;
  answerTimeoutMs?: number;
  requestTtlMs?: number;
}

function waitForIce(pc: RTCPeerConnection, maxMs: number): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') return resolve();
    const done = () => {
      clearTimeout(t);
      pc.removeEventListener('icegatheringstatechange', onChange);
      resolve();
    };
    const onChange = () => {
      if (pc.iceGatheringState === 'complete') done();
    };
    const t = setTimeout(done, maxMs);
    pc.addEventListener('icegatheringstatechange', onChange);
  });
}

const randomId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

export function createP2PEngine(opts: EngineOptions) {
  const { backend } = opts;
  const now = opts.now ?? Date.now;
  const newPeer = opts.newPeer ?? ((cfg) => new RTCPeerConnection(cfg));
  const answerTimeoutMs = opts.answerTimeoutMs ?? 20000;
  const requestTtlMs = opts.requestTtlMs ?? 120000;

  // ---------- Отправитель ----------
  const files = new Map<string, { chatId: string; file: Blob }>();
  const watchers = new Map<string, { refs: number; unsub: () => void }>();
  const handled = new Set<string>();
  const activity = new Map<string, HostActivity>();
  const listeners = new Map<string, Set<(a: HostActivity | null) => void>>();

  const emit = (messageId: string) => {
    const a = activity.get(messageId) ?? null;
    listeners.get(messageId)?.forEach((cb) => cb(a));
  };

  async function serve(chatId: string, d: TransferDoc, file: Blob) {
    const pc = newPeer({ iceServers: opts.getIceServers() });
    const guard = setTimeout(() => pc.close(), 5 * 60 * 1000); // соединение, по которому так и не пришёл канал
    pc.ondatachannel = (ev) => {
      clearTimeout(guard);
      activity.set(d.messageId, { sending: true, sent: 0, total: file.size });
      emit(d.messageId);
      serveFile(ev.channel, file, {
        onProgress: (sent, total) => {
          activity.set(d.messageId, { sending: true, sent, total });
          emit(d.messageId);
        },
      })
        .catch(() => {})
        .finally(() => {
          activity.delete(d.messageId);
          emit(d.messageId);
          backend.remove(chatId, d.id).catch(() => {});
          setTimeout(() => pc.close(), 1000);
        });
    };
    try {
      await pc.setRemoteDescription(JSON.parse(d.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await waitForIce(pc, 2500);
      await backend.answer(chatId, d.id, { answer: JSON.stringify(pc.localDescription), status: 'answered' });
    } catch (err) {
      clearTimeout(guard);
      pc.close();
      backend.answer(chatId, d.id, { status: 'rejected', reason: 'error' }).catch(() => {});
    }
  }

  function onRequests(chatId: string, docs: TransferDoc[]) {
    for (const d of docs) {
      if (d.status !== 'requested' || handled.has(d.id)) continue;
      handled.add(d.id);
      if (d.createdAtMs && now() - d.createdAtMs > requestTtlMs) {
        backend.remove(chatId, d.id).catch(() => {}); // старый запрос, получатель давно не ждёт
        continue;
      }
      const entry = files.get(d.messageId);
      if (!entry || entry.chatId !== chatId) {
        backend.answer(chatId, d.id, { status: 'rejected', reason: 'unavailable' }).catch(() => {}); // файла нет (приложение перезапускали)
        continue;
      }
      void serve(chatId, d, entry.file);
    }
  }

  function ensureWatch(chatId: string) {
    const uid = opts.getUserId();
    if (!uid) return;
    const w = watchers.get(chatId);
    if (w) {
      w.refs++;
      return;
    }
    watchers.set(chatId, { refs: 1, unsub: backend.watchRequests(chatId, uid, (docs) => onRequests(chatId, docs)) });
  }

  const host = {
    // Файл отправлен в чат: он доступен для скачивания, пока приложение открыто
    register(chatId: string, messageId: string, file: Blob) {
      files.set(messageId, { chatId, file });
      ensureWatch(chatId);
    },
    has: (messageId: string) => files.has(messageId),
    unregister(messageId: string) {
      const e = files.get(messageId);
      if (!e) return;
      files.delete(messageId);
      const w = watchers.get(e.chatId);
      if (w && --w.refs <= 0) {
        w.unsub();
        watchers.delete(e.chatId);
      }
    },
    stopAll() {
      watchers.forEach((w) => w.unsub());
      watchers.clear();
      files.clear();
      handled.clear();
      activity.clear();
    },
    getActivity: (messageId: string) => activity.get(messageId) ?? null,
    subscribe(messageId: string, cb: (a: HostActivity | null) => void) {
      if (!listeners.has(messageId)) listeners.set(messageId, new Set());
      listeners.get(messageId)!.add(cb);
      return () => {
        listeners.get(messageId)?.delete(cb);
      };
    },
  };

  // ---------- Получатель ----------
  // Можно вызывать повторно с тем же sink: передача продолжится с места обрыва.
  async function download(args: {
    chatId: string;
    messageId: string;
    senderId: string;
    size: number;
    sink: DownloadSink;
    signal?: AbortSignal;
    onState?: (s: 'connecting' | 'transferring') => void;
    onProgress?: (received: number, total: number) => void;
  }): Promise<void> {
    const uid = opts.getUserId();
    if (!uid) throw new TransferError('Нужно войти в аккаунт', 'unavailable');
    const { chatId, sink } = args;
    const id = randomId();
    const pc = newPeer({ iceServers: opts.getIceServers() });
    const dc = pc.createDataChannel('file', { ordered: true });
    dc.binaryType = 'arraybuffer';

    let unsub: (() => void) | null = null;
    let answerTimer: ReturnType<typeof setTimeout> | null = null;
    let failReject: (e: Error) => void = () => {};
    const failure = new Promise<never>((_, reject) => (failReject = reject));
    failure.catch(() => {});
    const fail = (e: Error) => {
      failReject(e);
      try {
        dc.close();
      } catch {
        // уже закрыт
      }
    };

    args.onState?.('connecting');
    const transfer = receiveFile(dc, sink, {
      size: args.size,
      signal: args.signal,
      onProgress: (received, total) => {
        args.onState?.('transferring');
        args.onProgress?.(received, total);
      },
    });

    const cleanup = () => {
      if (answerTimer) clearTimeout(answerTimer);
      unsub?.();
      setTimeout(() => pc.close(), 500);
      backend.remove(chatId, id).catch(() => {});
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') fail(new TransferError('Не удалось установить прямое соединение. Возможно, нужен ретранслятор (TURN).', 'interrupted', sink.received));
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIce(pc, 2500);
      await backend.create(chatId, id, {
        messageId: args.messageId,
        senderId: args.senderId,
        receiverId: uid,
        offer: JSON.stringify(pc.localDescription),
        status: 'requested',
        offset: sink.received,
      });
      answerTimer = setTimeout(
        () => fail(new TransferError('Отправитель не в сети или файл у него больше недоступен. Попробуйте позже.', 'unavailable', sink.received)),
        answerTimeoutMs
      );
      let answered = false;
      unsub = backend.watchDoc(chatId, id, (d) => {
        if (!d || answered) return;
        if (d.status === 'rejected') {
          answered = true;
          fail(new TransferError('У отправителя этого файла больше нет: он закрывал приложение. Попросите отправить файл заново.', 'unavailable', sink.received));
        } else if (d.status === 'answered' && d.answer) {
          answered = true;
          if (answerTimer) clearTimeout(answerTimer);
          pc.setRemoteDescription(JSON.parse(d.answer)).catch((e) => fail(new TransferError(e?.message || 'Ошибка соединения', 'interrupted', sink.received)));
        }
      });
      await Promise.race([transfer, failure]);
    } finally {
      cleanup();
      transfer.catch(() => {});
    }
  }

  return { host, download };
}
