'use strict';
// Встроенный локальный сервер десктопной версии Mix: только раздаёт веб-клиент.
// Он нужен, чтобы у приложения был адрес http://localhost:ПОРТ: на нём работают вход Firebase и хранение данных.
// Файлы между пользователями идут напрямую (WebRTC) и через этот сервер не проходят.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

function sendText(res, code, text) {
  if (res.headersSent) return res.end();
  res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8', Connection: code >= 400 ? 'close' : 'keep-alive' });
  res.end(text);
}

function insideDir(dir, target) {
  const rel = path.relative(dir, target);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function serveFile(req, res, filePath, cache) {
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) return sendText(res, 404, 'Not found');
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': cache,
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(filePath).on('error', () => res.destroy()).pipe(res);
  });
}

function serveStatic(req, res, webDir, pathname) {
  let rel;
  try {
    rel = decodeURIComponent(pathname);
  } catch {
    rel = '/';
  }
  let filePath = path.resolve(path.join(webDir, rel));
  if (filePath !== webDir && !insideDir(webDir, filePath)) return sendText(res, 403, 'Forbidden');

  fs.stat(filePath, (err, st) => {
    if (err) {
      // Запрос ресурса с расширением, которого нет: честный 404. Остальное отдаёт одностраничное приложение.
      if (path.extname(rel)) return sendText(res, 404, 'Not found');
      return serveFile(req, res, path.join(webDir, 'index.html'), 'no-cache');
    }
    if (st.isDirectory()) filePath = path.join(filePath, 'index.html');
    const isAsset = /[\\/]assets[\\/]/.test(filePath);
    const isIndex = path.basename(filePath) === 'index.html';
    serveFile(req, res, filePath, isIndex ? 'no-cache' : isAsset ? 'public, max-age=31536000, immutable' : 'public, max-age=3600');
  });
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve(server.address().port);
    });
  });
}

async function startServer({ webDir, port = 0, retryMs = 0 }) {
  webDir = path.resolve(webDir);
  let boundPort = 0;

  const server = http.createServer((req, res) => {
    try {
      // Защита от DNS-rebinding: отвечаем только на запросы к localhost с нашим портом
      const host = String(req.headers.host || '');
      if (!new RegExp(`^(localhost|127\\.0\\.0\\.1):${boundPort}$`).test(host)) return sendText(res, 403, 'Forbidden');
      if (req.method !== 'GET' && req.method !== 'HEAD') return sendText(res, 405, 'Method not allowed');
      const url = new URL(req.url, `http://localhost:${boundPort}`);
      serveStatic(req, res, webDir, url.pathname);
    } catch (e) {
      sendText(res, 500, (e && e.message) || 'Server error');
    }
  });

  // Адрес (localhost:ПОРТ) хранит вход в аккаунт, поэтому порт меняем только в крайнем случае:
  // сначала ждём, пока он освободится (например, закрывается прежний экземпляр после обновления).
  let fellBack = false;
  const deadline = Date.now() + retryMs;
  for (;;) {
    try {
      boundPort = await listen(server, port);
      break;
    } catch (e) {
      const inUse = e && e.code === 'EADDRINUSE';
      const denied = e && e.code === 'EACCES';
      if (port === 0 || !(inUse || denied)) throw e;
      if (inUse && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 300));
        continue;
      }
      boundPort = await listen(server, 0);
      fellBack = true;
      break;
    }
  }

  return { server, port: boundPort, fellBack, close: () => new Promise((r) => server.close(() => r())) };
}

module.exports = { startServer };
