// Хранилище картинки фона чата. Файл лежит в IndexedDB на этом устройстве,
// в Firestore ничего не пишется.

const DB_NAME = 'mix_appearance';
const STORE = 'images';
const KEY = 'chatBg';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export const bgStore = {
  async save(blob: Blob): Promise<void> {
    await run('readwrite', (s) => s.put(blob, KEY));
  },
  async load(): Promise<Blob | null> {
    const value = await run<Blob | undefined>('readonly', (s) => s.get(KEY));
    return value ?? null;
  },
  async clear(): Promise<void> {
    await run('readwrite', (s) => s.delete(KEY));
  },
};
