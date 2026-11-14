import React, { useMemo } from 'react';
import { splitTextWithLinks } from '../lib/linkUtils';

// Текст сообщения, где ссылки подсвечены синим и открываются по клику (в приложении во внешнем браузере)
export function LinkifiedText({ text }: { text: string }) {
  const parts = useMemo(() => splitTextWithLinks(text), [text]);
  return (
    <>
      {parts.map((p, i) =>
        p.type === 'link' ? (
          <a key={i} href={p.href} target="_blank" rel="noopener noreferrer" className="msg-link">
            {p.text}
          </a>
        ) : (
          <React.Fragment key={i}>{p.text}</React.Fragment>
        )
      )}
    </>
  );
}
