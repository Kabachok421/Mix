// Баннеры профиля в Firestore: banners/{uid} (описание) и banners/{uid}/chunks/{версия_номер} (куски файла).
// Описание читается при каждом открытии профиля (1 чтение), сам файл скачивается один раз на версию и кэшируется в IndexedDB.

import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BannerBackend, BannerCache, BannerMeta, createBannerService } from './bannerCore';

const backend: BannerBackend = {
  async getMeta(uid) {
    const snap = await getDoc(doc(db, 'banners', uid));
    if (!snap.exists()) return null;
    const d = snap.data();
    if (typeof d.version !== 'number' || typeof d.mime !== 'string' || typeof d.chunks !== 'number') return null;
    return { version: d.version, mime: d.mime, size: d.size, chunks: d.chunks, zoom: d.zoom, cx: d.cx, cy: d.cy } as BannerMeta;
  },

  async updateTransform(uid, t) {
    await updateDoc(doc(db, 'banners', uid), { zoom: t.zoom, cx: t.cx, cy: t.cy, updatedAt: serverTimestamp() });
  },

  async getChunk(uid, version, index) {
    const snap = await getDoc(doc(db, 'banners', uid, 'chunks', `${version}_${index}`));
    return snap.exists() ? (snap.data().data as string) : null;
  },

  // Сначала куски, потом описание: пока описание не записано, зрители видят старый баннер целиком
  async putBanner(uid, meta, chunks) {
    const batch = writeBatch(db);
    chunks.forEach((data, i) => {
      batch.set(doc(db, 'banners', uid, 'chunks', `${meta.version}_${i}`), { v: meta.version, i, data });
    });
    await batch.commit();
    await setDoc(doc(db, 'banners', uid), { ...meta, updatedAt: serverTimestamp() });
  },

  async deleteOldChunks(uid, keepVersion) {
    const snap = await getDocs(collection(db, 'banners', uid, 'chunks'));
    const batch = writeBatch(db);
    let n = 0;
    snap.forEach((d) => {
      if (d.data().v !== keepVersion) {
        batch.delete(d.ref);
        n++;
      }
    });
    if (n > 0) await batch.commit();
  },

  async deleteBanner(uid) {
    await deleteDoc(doc(db, 'banners', uid)); // сначала описание, чтобы баннер сразу пропал у всех
    await this.deleteOldChunks(uid, -1);
  },
};

// Кэш скачанных баннеров на этом устройстве
const DB_NAME = 'mix_banners';
const STORE = 'banners';

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
  const idb = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = idb.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    idb.close();
  }
}

const cache: BannerCache = {
  async get(uid) {
    const v = await run<{ version: number; blob: Blob } | undefined>('readonly', (s) => s.get(uid));
    return v ?? null;
  },
  async set(uid, version, blob) {
    await run('readwrite', (s) => s.put({ version, blob }, uid));
  },
  async clear(uid) {
    await run('readwrite', (s) => s.delete(uid));
  },
};

export const bannerService = createBannerService(backend, cache);
