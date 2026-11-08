// Хранилище собственного звука уведомления.
// Файл лежит в IndexedDB на этом устройстве. В Firestore ничего не пишется,
// поэтому дневной лимит записей не расходуется.

const DB_NAME = 'mix_sound';
const STORE = 'sounds';
const KEY = 'notification';

export interface StoredSound {
  name: string;
  blob: Blob;
}

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

export const soundStore = {
  async save(sound: StoredSound): Promise<void> {
    await run('readwrite', (s) => s.put(sound, KEY));
  },
  async load(): Promise<StoredSound | null> {
    const value = await run<StoredSound | undefined>('readonly', (s) => s.get(KEY));
    return value ?? null;
  },
  async clear(): Promise<void> {
    await run('readwrite', (s) => s.delete(KEY));
  },
};
