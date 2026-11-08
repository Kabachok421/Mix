'use strict';
// Встроенный локальный сервер для десктопной версии Mix.
// Делает то же, что server.ts: раздаёт веб-клиент и принимает файлы
// (/api/upload-raw, /api/upload, /api/files/:name). Зависимостей нет, только Node.
// Если задан apiBase, все запросы /api/* проксируются на общий сервер.
// Так файлы и голосовые, отправленные одним пользователем, доступны другому.

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const MAX_UPLOAD = 100 * 1024 * 1024; // как лимит 100 МБ в интерфейсе
const MAX_JSON_BODY = 150 * 1024 * 1024; // base64 на ~33% больше исходника

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
  '.pdf': 'application/pdf',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
};

function sendJson(res, code, obj) {
  if (res.headersSent) return res.end();
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    Connection: code >= 400 ? 'close' : 'keep-alive',
  });
  res.end(body);
}

function rfc5987(s) {
  return encodeURIComponent(s).replace(/['()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function safeBasename(raw) {
  let n;
  try {
    n = path.basename(decodeURIComponent(raw));
  } catch {
    n = path.basename(raw);
  }
  return n || 'file.bin';
}

function uniqueName(safeFilename) {
  const rawExt = path.extname(safeFilename) || '';
  const ext = rawExt.replace(/[^.a-zA-Z0-9]/g, '').slice(0, 12);
  const base =
    path.basename(safeFilename, rawExt).replace(/[^a-zA-Z0-9_\-\u0400-\u04FF]/g, '_').substring(0, 40) || 'file';
  return `${Date.now()}_${crypto.randomBytes(3).toString('hex')}_${base}${ext}`;
}

function mimeFor(filePath) {
  const name = path.basename(filePath);
  if (/_voice_\d+\.webm$/i.test(name)) return 'audio/webm';
  return MIME[path.extname(name).toLowerCase()] || 'application/octet-stream';
}

function serveFile(req, res, filePath, opts = {}) {
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) return sendJson(res, 404, { error: 'Файл не найден' });

    const headers = {
      'Content-Type': opts.type || mimeFor(filePath),
      'Accept-Ranges': 'bytes',
      'Cache-Control': opts.cache || 'private, max-age=3600',
    };
    if (opts.downloadName) {
      headers['Content-Disposition'] = `attachment; filename*=UTF-8''${rfc5987(opts.downloadName)}`;
    }

    let start = 0;
    let end = st.size - 1;
    let status = 200;
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (m && (m[1] || m[2])) {
      if (m[1] === '') {
        start = Math.max(0, st.size - Number(m[2]));
      } else {
        start = Number(m[1]);
        if (m[2]) end = Math.min(Number(m[2]), end);
      }
      if (start > end || start >= st.size) {
        res.writeHead(416, { 'Content-Range': `bytes */${st.size}` });
        return res.end();
      }
      status = 206;
      headers['Content-Range'] = `bytes ${start}-${end}/${st.size}`;
    }

    headers['Content-Length'] = st.size === 0 ? 0 : end - start + 1;
    res.writeHead(status, headers);
    if (req.method === 'HEAD' || st.size === 0) return res.end();
    fs.createReadStream(filePath, { start, end })
      .on('error', () => res.destroy())
      .pipe(res);
  });
}

function insideDir(dir, target) {
  const rel = path.relative(dir, target);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function handleUploadRaw(req, res, url, uploadDir) {
  const safeFilename = safeBasename(url.searchParams.get('filename') || 'file.bin');
  const mimeType = url.searchParams.get('mimeType') || req.headers['content-type'] || 'application/octet-stream';
  const name = uniqueName(safeFilename);
  const filePath = path.join(uploadDir, name);

  const declared = Number(req.headers['content-length'] || 0);
  if (declared > MAX_UPLOAD) return sendJson(res, 413, { error: 'Размер файла превышает 100 МБ' });

  const out = fs.createWriteStream(filePath);
  let size = 0;
  let failed = false;

  const fail = (code, msg) => {
    if (failed) return;
    failed = true;
    req.unpipe(out);
    out.destroy();
    fs.unlink(filePath, () => {});
    sendJson(res, code, { error: msg });
    req.resume();
  };

  req.on('data', (c) => {
    size += c.length;
    if (size > MAX_UPLOAD) fail(413, 'Размер файла превышает 100 МБ');
  });
  req.on('error', () => fail(500, 'Ошибка при приёме файла'));
  req.on('aborted', () => fail(400, 'Загрузка прервана'));
  out.on('error', (e) => fail(500, e.message || 'Ошибка записи файла'));
  out.on('finish', () => {
    if (failed) return;
    if (size === 0) {
      fs.unlink(filePath, () => {});
      return sendJson(res, 400, { error: 'Файл пуст или не передан' });
    }
    sendJson(res, 200, {
      url: `/api/files/${encodeURIComponent(name)}`,
      status: 'ok',
      fileName: safeFilename,
      fileSize: size,
      mimeType,
    });
  });
  req.pipe(out);
}

function handleUploadJson(req, res, uploadDir) {
  const chunks = [];
  let size = 0;
  let failed = false;
  req.on('data', (c) => {
    if (failed) return;
    size += c.length;
    if (size > MAX_JSON_BODY) {
      failed = true;
      sendJson(res, 413, { error: 'Размер файла превышает 100 МБ' });
      req.resume();
      return;
    }
    chunks.push(c);
  });
  req.on('error', () => !failed && ((failed = true), sendJson(res, 500, { error: 'Ошибка при приёме файла' })));
  req.on('end', async () => {
    if (failed) return;
    try {
      const { filename, fileData, mimeType } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!fileData) return sendJson(res, 400, { error: 'Файл не передан' });
      const b64 = fileData.includes('base64,') ? fileData.split('base64,')[1] : fileData;
      const buffer = Buffer.from(b64, 'base64');
      if (buffer.length > MAX_UPLOAD) return sendJson(res, 413, { error: 'Размер файла превышает 100 МБ' });
      const safeFilename = filename ? path.basename(String(filename)) : 'file.bin';
      const name = uniqueName(safeFilename);
      await fs.promises.writeFile(path.join(uploadDir, name), buffer);
      sendJson(res, 200, {
        url: `/api/files/${encodeURIComponent(name)}`,
        status: 'ok',
        fileName: safeFilename,
        fileSize: buffer.length,
        mimeType: mimeType || 'application/octet-stream',
      });
    } catch (e) {
      sendJson(res, 500, { error: (e && e.message) || 'Ошибка сервера при загрузке файла' });
    }
  });
}

function handleFileGet(req, res, pathname, url, uploadDir) {
  let filename;
  try {
    filename = path.basename(decodeURIComponent(pathname.slice('/api/files/'.length)));
  } catch {
    return sendJson(res, 400, { error: 'Некорректное имя файла' });
  }
  const filePath = path.join(uploadDir, filename);
  if (!filename || !insideDir(uploadDir, filePath)) return sendJson(res, 404, { error: 'Файл не найден' });

  let downloadName;
  if (url.searchParams.get('download') === 'true') {
    downloadName =
      url.searchParams.get('downloadName') || filename.replace(/^\d+_[a-z0-9]+_/, '') || filename;
  }
  serveFile(req, res, filePath, { downloadName });
}

function serveStatic(req, res, webDir, pathname) {
  let rel;
  try {
    rel = decodeURIComponent(pathname);
  } catch {
    rel = '/';
  }
  let filePath = path.resolve(path.join(webDir, rel));
  if (filePath !== webDir && !insideDir(webDir, filePath)) return sendJson(res, 403, { error: 'Forbidden' });

  const trySpa = () => {
    // Запрос ресурса с расширением, которого нет: честный 404. Остальное отдаёт SPA.
    if (path.extname(rel)) return sendJson(res, 404, { error: 'Not found' });
    serveFile(req, res, path.join(webDir, 'index.html'), { cache: 'no-cache' });
  };

  fs.stat(filePath, (err, st) => {
    if (err) return trySpa();
    if (st.isDirectory()) filePath = path.join(filePath, 'index.html');
    const isAsset = /[\\/]assets[\\/]/.test(filePath);
    const isIndex = path.basename(filePath) === 'index.html';
    serveFile(req, res, filePath, {
      cache: isIndex ? 'no-cache' : isAsset ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
    });
  });
}

function proxyToRemote(req, res, base) {
  let target;
  try {
    target = new URL(req.url, base);
  } catch {
    return sendJson(res, 502, { error: 'Некорректный адрес сервера в настройках' });
  }
  const headers = { ...req.headers, host: target.host };
  delete headers.origin;
  delete headers.referer;
  delete headers.connection;

  const lib = target.protocol === 'https:' ? https : http;
  const up = lib.request(target, { method: req.method, headers }, (r) => {
    res.writeHead(r.statusCode || 502, r.headers);
    r.pipe(res);
  });
  up.setTimeout(120000, () => up.destroy(new Error('таймаут')));
  up.on('error', (e) => sendJson(res, 502, { error: 'Сервер недоступен: ' + e.message }));
  req.on('aborted', () => up.destroy());
  req.pipe(up);
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

async function startServer({ webDir, uploadDir, apiBase = '', port = 0, retryMs = 0 }) {
  webDir = path.resolve(webDir);
  uploadDir = path.resolve(uploadDir);
  fs.mkdirSync(uploadDir, { recursive: true });
  const remote = String(apiBase || '').trim().replace(/\/+$/, '');

  let boundPort = 0;
  const server = http.createServer((req, res) => {
    try {
      // Защита от DNS-rebinding и чужих сайтов: только localhost и свой origin.
      const host = String(req.headers.host || '');
      if (!new RegExp(`^(localhost|127\\.0\\.0\\.1):${boundPort}$`).test(host)) {
        return sendJson(res, 403, { error: 'Forbidden' });
      }
      const origin = req.headers.origin;
      if (origin && req.method !== 'GET' && req.method !== 'HEAD') {
        if (origin !== `http://localhost:${boundPort}` && origin !== `http://127.0.0.1:${boundPort}`) {
          return sendJson(res, 403, { error: 'Forbidden' });
        }
      }

      const url = new URL(req.url, `http://localhost:${boundPort}`);
      const pathname = url.pathname;

      if (remote && pathname.startsWith('/api/')) return proxyToRemote(req, res, remote);

      if (req.method === 'POST' && pathname === '/api/upload-raw') return handleUploadRaw(req, res, url, uploadDir);
      if (req.method === 'POST' && pathname === '/api/upload') return handleUploadJson(req, res, uploadDir);
      if ((req.method === 'GET' || req.method === 'HEAD') && pathname.startsWith('/api/files/')) {
        return handleFileGet(req, res, pathname, url, uploadDir);
      }
      if ((req.method === 'GET' || req.method === 'HEAD') && pathname.startsWith('/uploads/')) {
        const filePath = path.join(uploadDir, path.basename(decodeURIComponent(pathname)));
        return serveFile(req, res, filePath);
      }
      if (pathname.startsWith('/api/')) return sendJson(res, 404, { error: 'Not found' });
      if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'Method not allowed' });

      serveStatic(req, res, webDir, pathname);
    } catch (e) {
      sendJson(res, 500, { error: (e && e.message) || 'Server error' });
    }
  });

  // Origin (http://localhost:ПОРТ) хранит вход в аккаунт, поэтому порт меняем только в крайнем случае:
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
