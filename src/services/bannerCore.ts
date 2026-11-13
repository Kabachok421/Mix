// Анимированные баннеры профиля: чистая логика без Firebase (хранилище и кэш подставляются снаружи).
// Файл режется на куски по ~600 КБ, потому что документ Firestore не может быть больше 1 МБ.

export const CHUNK_BYTES = 600_000; // после base64 ~800 КБ, укладывается в лимит документа
export const MAX_BANNER_BYTES = 3 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 12;
export const ALLOWED_BANNER_TYPES = ['image/gif', 'image/webp', 'image/png', 'image/jpeg', 'video/mp4', 'video/webm'];

// Положение и масштаб баннера. Не зависит от размера рамки, поэтому один и тот же кадр
// выглядит одинаково и в карточке профиля, и в предпросмотре.
//  zoom: 1 = картинка ровно заполняет рамку, больше = приближение (до MAX_ZOOM)
//  cx, cy: какая точка картинки (0..1 по ширине и высоте) находится в центре рамки
export interface BannerTransform {
  zoom: number;
  cx: number;
  cy: number;
}

export const DEFAULT_TRANSFORM: BannerTransform = { zoom: 1, cx: 0.5, cy: 0.5 };
export const MAX_ZOOM = 4;
// Соотношение сторон рамки баннера в карточке профиля (384 x 192)
export const BANNER_ASPECT = 2;

export interface BannerMeta extends Partial<BannerTransform> {
  version: number;
  mime: string;
  size: number;
  chunks: number;
}

export interface BannerRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const clampNum = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function sanitizeTransform(t?: Partial<BannerTransform> | null): BannerTransform {
  const num = (v: unknown, fallback: number) => (typeof v === 'number' && isFinite(v) ? v : fallback);
  return {
    zoom: clampNum(num(t?.zoom, 1), 1, MAX_ZOOM),
    cx: clampNum(num(t?.cx, 0.5), 0, 1),
    cy: clampNum(num(t?.cy, 0.5), 0, 1),
  };
}

// Где и какого размера рисовать картинку внутри рамки. Картинка всегда закрывает рамку целиком.
export function computeBannerRect(frameW: number, frameH: number, nw: number, nh: number, t: BannerTransform): BannerRect {
  const cover = Math.max(frameW / nw, frameH / nh);
  const zoom = clampNum(t.zoom, 1, MAX_ZOOM);
  const width = nw * cover * zoom;
  const height = nh * cover * zoom;
  const left = clampNum(frameW / 2 - t.cx * width, frameW - width, 0);
  const top = clampNum(frameH / 2 - t.cy * height, frameH - height, 0);
  return { left, top, width, height };
}

// Обратное преобразование: по положению картинки получаем cx, cy (после ограничения краями)
export function transformFromRect(frameW: number, frameH: number, rect: BannerRect, zoom: number): BannerTransform {
  return sanitizeTransform({
    zoom,
    cx: (frameW / 2 - rect.left) / rect.width,
    cy: (frameH / 2 - rect.top) / rect.height,
  });
}

// Перетаскивание: картинка идёт за курсором на dx, dy пикселей
export function dragTransform(frameW: number, frameH: number, nw: number, nh: number, t: BannerTransform, dx: number, dy: number): BannerTransform {
  const r = computeBannerRect(frameW, frameH, nw, nh, t);
  const moved = { ...r, left: clampNum(r.left + dx, frameW - r.width, 0), top: clampNum(r.top + dy, frameH - r.height, 0) };
  return transformFromRect(frameW, frameH, moved, t.zoom);
}

// Смена масштаба: центр кадра остаётся на месте, края не оголяются
export function zoomTransform(frameW: number, frameH: number, nw: number, nh: number, t: BannerTransform, zoom: number): BannerTransform {
  const next = { ...t, zoom: clampNum(zoom, 1, MAX_ZOOM) };
  return transformFromRect(frameW, frameH, computeBannerRect(frameW, frameH, nw, nh, next), next.zoom);
}

export interface BannerBackend {
  getMeta(uid: string): Promise<BannerMeta | null>;
  updateTransform(uid: string, t: BannerTransform): Promise<void>;
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
  transform: BannerTransform;
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
      const transform = sanitizeTransform(meta);
      const inMemory = memory.get(uid);
      if (inMemory && inMemory.version === meta.version) {
        const refreshed = { ...inMemory, transform }; // положение могли изменить, файл тот же
        memory.set(uid, refreshed);
        return refreshed;
      }

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
      const loaded: LoadedBanner = { url: makeUrl(blob), mime: meta.mime, version: meta.version, transform };
      memory.set(uid, loaded);
      return loaded;
    },

    async set(uid: string, file: Blob & { name?: string }, transformIn?: Partial<BannerTransform>): Promise<void> {
      const err = validateBannerFile(file);
      if (err) throw new Error(err);
      const transform = sanitizeTransform(transformIn);
      const chunks = await splitToBase64Chunks(file);
      const meta: BannerMeta = { version: Date.now(), mime: file.type, size: file.size, chunks: chunks.length, ...transform };
      try {
        await backend.putBanner(uid, meta, chunks);
      } catch (e) {
        console.warn('Banner upload failed', e);
        throw new Error('Не удалось сохранить баннер. Проверьте соединение и правила Firestore');
      }
      backend.deleteOldChunks(uid, meta.version).catch((e) => console.warn('Old banner cleanup failed', e));
      forget(uid);
      memory.set(uid, { url: makeUrl(file), mime: meta.mime, version: meta.version, transform });
      await cache.set(uid, meta.version, file).catch(() => {});
      emit(uid);
    },

    // Только положение и масштаб (без повторной загрузки файла): одна запись
    async setTransform(uid: string, transformIn: Partial<BannerTransform>): Promise<void> {
      const transform = sanitizeTransform(transformIn);
      try {
        await backend.updateTransform(uid, transform);
      } catch (e) {
        console.warn('Banner transform update failed', e);
        throw new Error('Не удалось сохранить положение баннера. Проверьте соединение и правила Firestore');
      }
      const cur = memory.get(uid);
      if (cur) memory.set(uid, { ...cur, transform });
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
