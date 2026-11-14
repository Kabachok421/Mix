'use strict';
// Передаёт окну настроек и чата запрос «собрать превью ссылки» и превращает картинку в маленький JPEG.
const { ipcMain, nativeImage } = require('electron');
const { fetchLinkPreview } = require('./linkPreviewCore.cjs');

const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_DATA_URL = 70_000; // байт JPEG: превью хранится прямо в документе сообщения

function resizeToJpegDataUrl(buffer) {
  try {
    let img = nativeImage.createFromBuffer(buffer);
    if (img.isEmpty()) return null; // формат, который Electron не читает (например WebP): картинки не будет
    if (img.getSize().width > 480) img = img.resize({ width: 480, quality: 'good' });
    for (const q of [70, 55, 40]) {
      const jpg = img.toJPEG(q);
      if (jpg.length <= MAX_DATA_URL) return 'data:image/jpeg;base64,' + jpg.toString('base64');
    }
  } catch { /* без картинки */ }
  return null;
}

function initLinkPreview({ getWindow }) {
  const cache = new Map(); // url -> { at, value }
  const fromMain = (e) => {
    const w = getWindow();
    return !!w && !w.isDestroyed() && e.sender === w.webContents;
  };

  ipcMain.handle('link:preview', async (e, url) => {
    if (!fromMain(e) || typeof url !== 'string' || url.length > 2000) return null;
    const hit = cache.get(url);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
    let value = null;
    try {
      value = await fetchLinkPreview(url, { resizeImage: resizeToJpegDataUrl });
    } catch (err) {
      console.warn('[link preview]', url, err && err.message);
    }
    if (cache.size > 60) cache.delete(cache.keys().next().value);
    cache.set(url, { at: Date.now(), value });
    return value;
  });
}

module.exports = { initLinkPreview };
