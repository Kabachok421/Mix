// Куда получатель сохраняет файл. Выбираем лучший из доступных способов:
//  1. Файловая система (окно «Сохранить как»): Windows-приложение и Chrome на компьютере. Данные идут прямо на диск.
//  2. Закрытая папка браузера (OPFS): Chrome на телефоне. Тоже на диск, потом файл отдаётся на скачивание.
//  3. Память: только маленькие файлы, когда ничего другого нет.

import { TransferError, type Sink } from './p2pCore';

export interface DownloadSink extends Sink {
  kind: 'filesystem' | 'opfs' | 'memory';
  // Завершить запись. Возвращает файл, если его можно показать или отдать на скачивание.
  close(): Promise<Blob | null>;
  // Бросить недокачанное
  abort(): Promise<void>;
}

const MEMORY_LIMIT = 300 * 1024 * 1024;
const OPFS_PREFIX = 'mix-dl-';

function fsSink(handle: any): Promise<DownloadSink> {
  return handle.createWritable().then((writable: any) => {
    let received = 0;
    const sink: DownloadSink = {
      kind: 'filesystem',
      get received() {
        return received;
      },
      async write(chunk) {
        await writable.write(chunk);
        received += chunk.byteLength;
      },
      async close() {
        await writable.close();
        try {
          return await handle.getFile();
        } catch {
          return null;
        }
      },
      async abort() {
        try {
          await writable.abort();
        } catch {
          // уже закрыт
        }
      },
    };
    return sink;
  });
}

export async function createOpfsSink(): Promise<DownloadSink> {
  const root = await (navigator as any).storage.getDirectory();
  const name = `${OPFS_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const handle = await root.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  let received = 0;
  return {
    kind: 'opfs',
    get received() {
      return received;
    },
    async write(chunk) {
      await writable.write(chunk);
      received += chunk.byteLength;
    },
    async close() {
      await writable.close();
      return handle.getFile();
    },
    async abort() {
      try {
        await writable.abort();
      } catch {
        // уже закрыт
      }
      try {
        await root.removeEntry(name);
      } catch {
        // нечего удалять
      }
    },
  };
}

export function createMemorySink(): DownloadSink {
  const parts: ArrayBuffer[] = [];
  let received = 0;
  return {
    kind: 'memory',
    get received() {
      return received;
    },
    async write(chunk) {
      parts.push(chunk);
      received += chunk.byteLength;
    },
    async close() {
      return new Blob(parts);
    },
    async abort() {
      parts.length = 0;
    },
  };
}

// Остатки прошлых сеансов в закрытой папке браузера (скачанные через OPFS файлы) удаляем при запуске
export async function cleanupOpfsLeftovers() {
  try {
    const root = await (navigator as any).storage?.getDirectory?.();
    if (!root) return;
    for await (const [name] of root.entries()) {
      if (String(name).startsWith(OPFS_PREFIX)) await root.removeEntry(name).catch(() => {});
    }
  } catch {
    // не поддерживается
  }
}

// Вызывать сразу из обработчика клика: окно «Сохранить как» требует действия пользователя
export async function openSink(fileName: string, size: number): Promise<DownloadSink> {
  const w = window as any;
  if (typeof w.showSaveFilePicker === 'function') {
    try {
      const handle = await w.showSaveFilePicker({ suggestedName: fileName });
      return await fsSink(handle);
    } catch (err: any) {
      if (err?.name === 'AbortError') throw new TransferError('Сохранение отменено', 'cancelled');
      console.warn('showSaveFilePicker failed, falling back:', err);
    }
  }
  const hasOpfs = !!(navigator as any).storage?.getDirectory && typeof (window as any).FileSystemFileHandle?.prototype?.createWritable === 'function';
  if (hasOpfs) {
    try {
      return await createOpfsSink();
    } catch (err) {
      console.warn('OPFS unavailable, falling back to memory:', err);
    }
  }
  if (size > MEMORY_LIMIT) {
    throw new TransferError('Этот браузер не умеет сохранять большие файлы. Откройте Mix в Chrome на компьютере или в приложении для Windows.', 'sink');
  }
  return createMemorySink();
}
