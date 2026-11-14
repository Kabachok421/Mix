// Ссылки в сообщениях: поиск, разбор текста на части и очистка данных вложения (embed).

export interface LinkEmbed {
  url: string;
  title?: string;
  description?: string;
  siteName?: string;
  image?: string; // уменьшенная картинка в виде data:image/jpeg;base64,... (делается в приложении при отправке)
}

export type TextPart = { type: 'text'; text: string } | { type: 'link'; text: string; href: string };

const URL_RE = /(?:https?:\/\/|www\.)[^\s<>"'«»]+/gi;
const TRAILING = '.,!?:;"\'»…';

// Убираем знаки препинания в конце ссылки: «смотри https://a.ru/x.» -> без точки. Скобка остаётся, если она парная.
function trimLink(raw: string): string {
  let s = raw;
  for (;;) {
    const last = s[s.length - 1];
    if (!last) break;
    if (TRAILING.includes(last)) {
      s = s.slice(0, -1);
    } else if (last === ')' && (s.match(/\(/g) || []).length < (s.match(/\)/g) || []).length) {
      s = s.slice(0, -1);
    } else if ((last === ']' || last === '}') && !s.includes(last === ']' ? '[' : '{')) {
      s = s.slice(0, -1);
    } else break;
  }
  return s;
}

function toHref(link: string): string | null {
  const full = /^www\./i.test(link) ? `https://${link}` : link;
  try {
    const u = new URL(full);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (!u.hostname.includes('.')) return null; // «http://localhost» и подобное ссылкой не считаем
    return full;
  } catch {
    return null;
  }
}

// Текст по частям: обычные куски и ссылки (для подсветки синим)
export function splitTextWithLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const start = m.index ?? 0;
    const link = trimLink(m[0]);
    const href = toHref(link);
    if (!href || !link) continue;
    if (start > last) parts.push({ type: 'text', text: text.slice(last, start) });
    parts.push({ type: 'link', text: link, href });
    last = start + link.length;
  }
  if (last < text.length) parts.push({ type: 'text', text: text.slice(last) });
  return parts;
}

// Первая ссылка в тексте (для вложения)
export function extractFirstUrl(text: string): string | null {
  const first = splitTextWithLinks(text).find((p) => p.type === 'link');
  return first && first.type === 'link' ? first.href : null;
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

const IMAGE_PREFIX = 'data:image/jpeg;base64,';
const clip = (v: unknown, max: number): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const t = v.replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, max) : undefined;
};

// Очистка вложения перед записью в базу и перед показом: только http(s) ссылки, ограниченные тексты,
// картинка только в нашем формате (так нельзя подсунуть чужой адрес или скрипт).
export function sanitizeEmbed(raw: unknown): LinkEmbed | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const url = typeof r.url === 'string' && r.url.length <= 2000 ? r.url : '';
  if (!url || toHref(url) === null) return null;
  const embed: LinkEmbed = { url };
  const title = clip(r.title, 200);
  const description = clip(r.description, 400);
  const siteName = clip(r.siteName, 80);
  if (title) embed.title = title;
  if (description) embed.description = description;
  if (siteName) embed.siteName = siteName;
  if (typeof r.image === 'string' && r.image.startsWith(IMAGE_PREFIX) && r.image.length <= 100_000 && /^[A-Za-z0-9+/=]+$/.test(r.image.slice(IMAGE_PREFIX.length))) {
    embed.image = r.image;
  }
  return embed;
}
