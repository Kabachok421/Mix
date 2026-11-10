// Анимированные баннеры профиля: чистая логика без Firebase (хранилище и кэш подставляются снаружи).
// Файл режется на куски по ~600 КБ, потому что документ Firestore не может быть больше 1 МБ.

export const CHUNK_BYTES = 600_000; // после base64 ~800 КБ, укладывается в лимит документа
export const MAX_BANNER_BYTES = 3 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 12;
export const ALLOWED_BANNER_TYPES = ['image/gif', 'image/webp', 'image/png', 'image/jpeg', 'video/mp4', 'video/webm'];

export interface BannerMeta {
  version: number;
  mime: string;
  size: number;
  chunks: number;
}

export interface BannerBackend {
  getMeta(uid: string): Promise<BannerMeta | null>;
  getChunk(uid: string, version: number, index: number): Promise<string | null>;
  putBanner(uid: string, meta: BannerMeta, chunks: string[]): Promise<void>;
  deleteOldChunks(uid: string, keepVersion: number): Promise<void>;
  deleteBanner(uid: string): Promise<void>;
}

export interface BannerCache {
  get(uid: string): Promise<{ version: number; blob: Blob } | null>;
  set(uid: string, version: number, blob: Blob): Promise<void>;
  clear(uid: string): Promise<void>;
}

export interface LoadedBanner {
  url: string;
  mime: string;
  version: number;
}

// Возвращает текст ошибки или null, если файл подходит
export function validateBannerFile(file: { type: string; size: number }): string | null {
  if (!ALLOWED_BANNER_TYPES.includes(file.type)) return 'Формат не подходит. Подойдут GIF, WebP, PNG, JPG, MP4 и WebM';
  if (file.size <= 0) return 'Файл пуст';
  if (file.size > MAX_BANNER_BYTES) return 'Файл больше 3 МБ. Сожмите его или обрежьте';
  return null;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function splitToBase64Chunks(blob: Blob): Promise<string[]> {
  const chunks: string[] = [];
  for (let offset = 0; offset < blob.size; offset += CHUNK_BYTES) {
    const part = new Uint8Array(await blob.slice(offset, offset + CHUNK_BYTES).arrayBuffer());
    chunks.push(bytesToBase64(part));
  }
  return chunks;
}

export function createBannerService(
  backend: BannerBackend,
  cache: BannerCache,
  makeUrl: (b: Blob) => string = (b) => URL.createObjectURL(b),
  revokeUrl: (u: string) => void = (u) => URL.revokeObjectURL(u)
) {
  const memory = new Map<string, LoadedBanner>();
  const listeners = new Set<(uid: string) => void>();

  const emit = (uid: string) => listeners.forEach((l) => l(uid));
  const forget = (uid: string) => {
    const old = memory.get(uid);
    if (old) revokeUrl(old.url);
    memory.delete(uid);
  };

  return {
    onChange(listener: (uid: string) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    // Баннер пользователя или null. Скачивает куски только при новой версии, дальше берёт из кэша.
    async load(uid: string): Promise<LoadedBanner | null> {
      const meta = await backend.getMeta(uid);
      if (!meta) {
        forget(uid);
        await cache.clear(uid).catch(() => {});
        return null;
      }
      const inMemory = memory.get(uid);
      if (inMemory && inMemory.version === meta.version) return inMemory;

      let blob: Blob | null = null;
      const cached = await cache.get(uid).catch(() => null);
      if (cached && cached.version === meta.version) blob = cached.blob;

      if (!blob) {
        const parts: Uint8Array[] = [];
        for (let i = 0; i < meta.chunks; i++) {
          const b64 = await backend.getChunk(uid, meta.version, i);
          if (!b64) return null; // баннер ещё загружается или повреждён
          parts.push(base64ToBytes(b64));
        }
        blob = new Blob(parts, { type: meta.mime });
        await cache.set(uid, meta.version, blob).catch(() => {});
      }

      forget(uid);
      const loaded: LoadedBanner = { url: makeUrl(blob), mime: meta.mime, version: meta.version };
      memory.set(uid, loaded);
      return loaded;
    },

    async set(uid: string, file: Blob & { name?: string }): Promise<void> {
      const err = validateBannerFile(file);
      if (err) throw new Error(err);
      const chunks = await splitToBase64Chunks(file);
      const meta: BannerMeta = { version: Date.now(), mime: file.type, size: file.size, chunks: chunks.length };
      try {
        await backend.putBanner(uid, meta, chunks);
      } catch (e) {
        console.warn('Banner upload failed', e);
        throw new Error('Не удалось сохранить баннер. Проверьте соединение и правила Firestore');
      }
      backend.deleteOldChunks(uid, meta.version).catch((e) => console.warn('Old banner cleanup failed', e));
      forget(uid);
      memory.set(uid, { url: makeUrl(file), mime: meta.mime, version: meta.version });
      await cache.set(uid, meta.version, file).catch(() => {});
      emit(uid);
    },

    async remove(uid: string): Promise<void> {
      await backend.deleteBanner(uid);
      forget(uid);
      await cache.clear(uid).catch(() => {});
      emit(uid);
    },
  };
}
