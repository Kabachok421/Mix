import { useEffect, useRef, useState } from 'react';
import { type LinkEmbed, extractFirstUrl, hostnameOf, sanitizeEmbed } from '../lib/linkUtils';

const DEBOUNCE_MS = 600;

// Вложение для первой ссылки в вводимом тексте.
// В приложении Windows страницу читает приложение (заголовок, описание, картинка). В браузере сайты закрыты от чтения,
// поэтому там вложение простое: адрес сайта. Любое вложение можно открепить до отправки.
export function useLinkPreview(text: string, enabled: boolean) {
  const url = enabled ? extractFirstUrl(text) : null;
  const [embed, setEmbed] = useState<LinkEmbed | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState<string | null>(null); // ссылка, вложение которой открепили
  const cache = useRef(new Map<string, LinkEmbed | null>());

  // Убрали ссылку из текста: открепление забываем, при новом вводе вложение появится снова
  useEffect(() => {
    if (!url) setDismissed(null);
  }, [url]);

  useEffect(() => {
    if (!url) {
      setEmbed(null);
      setLoading(false);
      return;
    }
    if (dismissed === url) return;
    if (cache.current.has(url)) {
      setEmbed(cache.current.get(url) ?? null);
      setLoading(false);
      return;
    }

    const bridge = typeof window !== 'undefined' ? window.mixApp?.fetchLinkPreview : undefined;
    if (!bridge) {
      const basic = sanitizeEmbed({ url, title: hostnameOf(url), siteName: hostnameOf(url) });
      cache.current.set(url, basic);
      setEmbed(basic);
      setLoading(false);
      return;
    }

    let alive = true;
    setEmbed(null);
    setLoading(true);
    const timer = setTimeout(async () => {
      let result: LinkEmbed | null = null;
      try {
        result = sanitizeEmbed(await bridge(url));
      } catch {
        result = null;
      }
      cache.current.set(url, result);
      if (alive) {
        setEmbed(result);
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [url, dismissed]);

  const hidden = !url || dismissed === url;
  return {
    embed: hidden ? null : embed,
    loading: hidden ? false : loading,
    dismiss: () => url && setDismissed(url),
  };
}
