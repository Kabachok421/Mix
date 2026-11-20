// Передача файла по каналу WebRTC (RTCDataChannel) без сервера. Подходит для файлов до 10 ГБ:
//  - отправитель читает файл кусками с диска и не держит его в памяти;
//  - скорость отправки подстраивается под канал (не копится очередь);
//  - получатель пишет куски сразу на диск и умеет продолжить с места обрыва.

export const MAX_FILE_BYTES = 10 * 1024 * 1024 * 1024; // 10 ГБ
export const CHUNK_BYTES = 64 * 1024; // безопасный размер сообщения для всех браузеров
const READ_BLOCK = 1024 * 1024;
const HIGH_WATER = 8 * 1024 * 1024; // очередь канала больше этого: ждём
const LOW_WATER = 2 * 1024 * 1024;

export type TransferErrorCode = 'interrupted' | 'cancelled' | 'mismatch' | 'sink' | 'timeout' | 'unavailable';

export class TransferError extends Error {
  constructor(message: string, public code: TransferErrorCode, public received?: number) {
    super(message);
    this.name = 'TransferError';
  }
}

// Куда получатель складывает данные (файл на диске или память). received = сколько байт уже записано подряд с начала.
export interface Sink {
  readonly received: number;
  write(chunk: ArrayBuffer): Promise<void>;
}

async function drain(dc: RTCDataChannel) {
  while (dc.bufferedAmount > LOW_WATER) {
    if (dc.readyState !== 'open') throw new TransferError('Соединение прервано', 'interrupted');
    await new Promise<void>((resolve) => {
      dc.onbufferedamountlow = () => resolve();
      setTimeout(resolve, 250); // и по таймеру: закрытие канала тоже должно разбудить цикл
    });
  }
  dc.onbufferedamountlow = null;
}

// Отправитель: ждёт «start» от получателя, затем шлёт заголовок, куски и «eof», ждёт «done»
export function serveFile(
  dc: RTCDataChannel,
  file: Blob,
  opts: { signal?: AbortSignal; onProgress?: (sent: number, total: number) => void; startTimeoutMs?: number } = {}
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    let started = false;
    let eofSent = false;

    const cleanup = () => {
      clearTimeout(timer);
      dc.onmessage = null;
      dc.onclose = null;
      dc.onerror = null;
      dc.onbufferedamountlow = null;
      opts.signal?.removeEventListener('abort', onAbort);
    };
    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (err) reject(err);
      else resolve();
    };
    const onAbort = () => {
      try {
        if (dc.readyState === 'open') dc.send(JSON.stringify({ type: 'cancel' }));
      } catch {
        // канал уже закрыт
      }
      finish(new TransferError('Отменено', 'cancelled'));
    };
    const timer = setTimeout(() => finish(new TransferError('Получатель не начал приём', 'timeout')), opts.startTimeoutMs ?? 30000);

    if (opts.signal?.aborted) onAbort();
    else opts.signal?.addEventListener('abort', onAbort);

    dc.onclose = () => (eofSent ? finish() : finish(new TransferError('Соединение прервано', 'interrupted')));
    dc.onerror = () => finish(new TransferError('Ошибка соединения', 'interrupted'));

    const pump = async (rawOffset: unknown) => {
      const size = file.size;
      let offset = Math.max(0, Math.min(Math.floor(Number(rawOffset) || 0), size));
      dc.send(JSON.stringify({ type: 'meta', size, offset }));
      dc.bufferedAmountLowThreshold = LOW_WATER;
      while (offset < size) {
        if (settled) return;
        const end = Math.min(offset + READ_BLOCK, size);
        const block = await file.slice(offset, end).arrayBuffer();
        for (let i = 0; i < block.byteLength; i += CHUNK_BYTES) {
          if (settled) return;
          if (dc.readyState !== 'open') throw new TransferError('Соединение прервано', 'interrupted');
          if (dc.bufferedAmount > HIGH_WATER) await drain(dc);
          dc.send(new Uint8Array(block, i, Math.min(CHUNK_BYTES, block.byteLength - i)));
        }
        offset = end;
        opts.onProgress?.(offset, size);
      }
      eofSent = true;
      dc.send(JSON.stringify({ type: 'eof', size }));
    };

    dc.onmessage = (e) => {
      if (typeof e.data !== 'string') return;
      let m: any;
      try {
        m = JSON.parse(e.data);
      } catch {
        return;
      }
      if (m.type === 'start' && !started) {
        started = true;
        clearTimeout(timer);
        pump(m.offset).catch((err) => finish(err instanceof TransferError ? err : new TransferError(err?.message || 'Ошибка передачи', 'interrupted')));
      } else if (m.type === 'done') {
        finish();
      } else if (m.type === 'cancel') {
        finish(new TransferError('Получатель отменил приём', 'cancelled'));
      }
    };
  });
}

// Получатель: просит файл с места sink.received, пишет куски в sink, проверяет размер в конце
export function receiveFile(
  dc: RTCDataChannel,
  sink: Sink,
  opts: { size: number; signal?: AbortSignal; onProgress?: (received: number, total: number) => void; startTimeoutMs?: number }
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    dc.binaryType = 'arraybuffer';
    let settled = false;
    let gotMeta = false;
    let eofSeen = false;
    let chain: Promise<void> = Promise.resolve();

    const cleanup = () => {
      clearTimeout(timer);
      dc.onmessage = null;
      dc.onopen = null;
      opts.signal?.removeEventListener('abort', onAbort);
    };
    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (err) reject(err);
      else resolve();
    };
    const fail = (message: string, code: TransferErrorCode) => finish(new TransferError(message, code, sink.received));
    const onAbort = () => {
      try {
        if (dc.readyState === 'open') dc.send(JSON.stringify({ type: 'cancel' }));
      } catch {
        // канал уже закрыт
      }
      chain.then(() => fail('Отменено', 'cancelled'));
    };
    const timer = setTimeout(() => fail('Отправитель не начал передачу', 'timeout'), opts.startTimeoutMs ?? 30000);

    if (opts.signal?.aborted) onAbort();
    else opts.signal?.addEventListener('abort', onAbort);

    const begin = () => dc.send(JSON.stringify({ type: 'start', offset: sink.received }));
    if (dc.readyState === 'open') begin();
    else dc.onopen = begin;

    dc.onclose = () => {
      if (eofSeen) return;
      // ждём, пока дозапишутся уже пришедшие куски: от них зависит, с какого места продолжать
      chain.then(() => fail('Соединение прервано', 'interrupted'));
    };
    dc.onerror = () => chain.then(() => fail('Ошибка соединения', 'interrupted'));

    dc.onmessage = (e) => {
      if (typeof e.data === 'string') {
        let m: any;
        try {
          m = JSON.parse(e.data);
        } catch {
          return;
        }
        if (m.type === 'meta') {
          clearTimeout(timer);
          if (m.size !== opts.size || m.offset !== sink.received) {
            fail('Файл у отправителя изменился', 'mismatch');
            try {
              dc.close();
            } catch {
              // уже закрыт
            }
            return;
          }
          gotMeta = true;
          if (sink.received >= opts.size) opts.onProgress?.(sink.received, opts.size);
        } else if (m.type === 'eof') {
          eofSeen = true;
          chain = chain.then(() => {
            if (settled) return;
            if (sink.received !== opts.size) return fail('Файл получен не полностью', 'mismatch');
            try {
              dc.send(JSON.stringify({ type: 'done' }));
            } catch {
              // отправитель уже закрыл канал, файл получен
            }
            finish();
          });
        } else if (m.type === 'cancel') {
          chain.then(() => fail('Отправитель отменил передачу', 'cancelled'));
        }
        return;
      }
      if (!gotMeta || settled) return;
      const buf = e.data as ArrayBuffer;
      chain = chain.then(async () => {
        if (settled) return;
        try {
          await sink.write(buf);
          opts.onProgress?.(sink.received, opts.size);
        } catch (err) {
          fail('Не удалось записать файл на диск', 'sink');
          try {
            dc.close();
          } catch {
            // уже закрыт
          }
        }
      });
    };
  });
}
