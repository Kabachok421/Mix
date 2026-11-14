'use strict';
// Сбор данных для вложения-превью ссылки (как embed в Discord): заголовок, описание, название сайта и картинка.
// Работает в главном процессе приложения, где нет ограничений CORS. Защита:
//  - только http и https, не больше 4 переадресаций, каждая проверяется заново;
//  - адреса внутренней сети и самого компьютера запрещены (нельзя «сканировать» домашнюю сеть через ссылку);
//  - ограничены время и размер загрузки (страница до 600 КБ, картинка до 3 МБ).

const dns = require('dns').promises;
const net = require('net');

const MAX_HTML_BYTES = 600 * 1024;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECTS = 4;
const TIMEOUT_MS = 7000;

function isPrivateIPv4(ip) {
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === '::' || v === '::1') return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
    if (mapped) return isPrivateIPv4(mapped[1]);
    return v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb') || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('ff');
  }
  return true; // непонятный адрес считаем небезопасным
}

async function assertPublicHost(hostname, lookup) {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('private host');
  }
  if (net.isIP(host)) {
    if (isPrivateAddress(host)) throw new Error('private address');
    return;
  }
  const addrs = await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) throw new Error('private address');
}

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeChar(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeChar(parseInt(d, 10)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp|laquo|raquo|mdash|ndash|hellip);/gi, (_, n) =>
      ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', laquo: '«', raquo: '»', mdash: '—', ndash: '–', hellip: '…' }[n.toLowerCase()]));
}
function safeChar(code) {
  try { return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : ''; } catch { return ''; }
}
const tidy = (s, max) => (s ? decodeEntities(s).replace(/\s+/g, ' ').trim().slice(0, max) : '');

// Разбор Open Graph и обычных мета-тегов страницы
function parseMeta(html, baseUrl) {
  const meta = {};
  for (const m of html.matchAll(/<meta\s[^>]*>/gi)) {
    const attrs = {};
    for (const a of m[0].matchAll(/([a-zA-Z_:][-\w:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
      attrs[a[1].toLowerCase()] = a[2] ?? a[3] ?? a[4] ?? '';
    }
    const key = (attrs.property || attrs.name || '').toLowerCase();
    if (key && attrs.content !== undefined && !(key in meta)) meta[key] = attrs.content;
  }
  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = tidy(meta['og:title'] || meta['twitter:title'] || (titleTag ? titleTag[1] : ''), 200);
  const description = tidy(meta['og:description'] || meta['twitter:description'] || meta['description'], 400);
  const siteName = tidy(meta['og:site_name'], 80);
  let image = meta['og:image'] || meta['og:image:url'] || meta['twitter:image'] || meta['twitter:image:src'] || '';
  if (image) {
    try { image = new URL(decodeEntities(image), baseUrl).href; } catch { image = ''; }
  }
  return { title, description, siteName, image };
}

// Читает ответ не больше max байт
async function readLimited(res, max) {
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > max) {
      const keep = value.length - (total - max);
      if (keep > 0) chunks.push(value.subarray(0, keep));
      try { await reader.cancel(); } catch { /* уже закрыто */ }
      return { buffer: Buffer.concat(chunks), truncated: true };
    }
    chunks.push(value);
  }
  return { buffer: Buffer.concat(chunks), truncated: false };
}

async function safeFetch(url, opts, accept, maxBytes, { fetchImpl, lookup }) {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const u = new URL(current);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('bad protocol');
    await assertPublicHost(u.hostname, lookup);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetchImpl(current, {
        redirect: 'manual',
        signal: ctrl.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MixLinkPreview/1.0)', Accept: accept, 'Accept-Language': 'ru,en;q=0.8' },
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        current = new URL(res.headers.get('location'), current).href;
        continue;
      }
      if (!res.ok || !res.body) throw new Error(`http ${res.status}`);
      const type = (res.headers.get('content-type') || '').toLowerCase();
      const { buffer } = await readLimited(res, maxBytes);
      return { buffer, type, finalUrl: current };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error('too many redirects');
}

function decodeHtml(buffer, contentType) {
  let charset = /charset=([\w-]+)/i.exec(contentType)?.[1];
  if (!charset) charset = /<meta[^>]+charset=["']?([\w-]+)/i.exec(buffer.subarray(0, 4096).toString('latin1'))?.[1];
  try { return new TextDecoder(charset || 'utf-8').decode(buffer); } catch { return new TextDecoder('utf-8').decode(buffer); }
}

// Возвращает { url, title?, description?, siteName?, image? } или null, если показывать нечего
async function fetchLinkPreview(url, { fetchImpl = fetch, lookup = dns.lookup, resizeImage = () => null } = {}) {
  const deps = { fetchImpl, lookup };
  const target = new URL(url);
  const host = target.hostname.replace(/^www\./i, '');

  const page = await safeFetch(url, {}, 'text/html,application/xhtml+xml,image/*;q=0.8', MAX_HTML_BYTES, deps);

  // Ссылка прямо на картинку: вложение только с картинкой
  if (page.type.startsWith('image/')) {
    const image = resizeImage(page.buffer);
    return image ? { url, siteName: host, image } : null;
  }
  if (!/text\/html|application\/xhtml\+xml/.test(page.type)) return null;

  const m = parseMeta(decodeHtml(page.buffer, page.type), page.finalUrl);
  const embed = { url };
  if (m.title) embed.title = m.title;
  if (m.description) embed.description = m.description;
  embed.siteName = m.siteName || host;

  if (m.image) {
    try {
      const img = await safeFetch(m.image, {}, 'image/*', MAX_IMAGE_BYTES, deps);
      if (img.type.startsWith('image/')) {
        const dataUrl = resizeImage(img.buffer);
        if (dataUrl) embed.image = dataUrl;
      }
    } catch { /* без картинки */ }
  }
  return embed.title || embed.description || embed.image ? embed : null;
}

module.exports = { fetchLinkPreview, isPrivateAddress, parseMeta, MAX_HTML_BYTES, MAX_IMAGE_BYTES };
