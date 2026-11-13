import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BannerTransform, computeBannerRect } from '../services/bannerCore';

// Рисует картинку или видео баннера внутри рамки родителя с учётом положения и масштаба.
// Размер рамки отслеживается, поэтому один и тот же кадр выглядит одинаково в любом месте.
export function BannerCanvas({
  src,
  mime,
  transform,
  onNatural,
}: {
  src: string;
  mime: string;
  transform: BannerTransform;
  onNatural?: (w: number, h: number) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const update = () => setFrame({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setNat(null);
  }, [src]);

  const gotSize = (w: number, h: number) => {
    if (!w || !h) return;
    setNat({ w, h });
    onNatural?.(w, h);
  };

  const rect = nat && frame.w > 0 && frame.h > 0 ? computeBannerRect(frame.w, frame.h, nat.w, nat.h, transform) : null;
  const style: React.CSSProperties = rect
    ? { position: 'absolute', left: rect.left, top: rect.top, width: rect.width, height: rect.height, maxWidth: 'none', opacity: 1 }
    : { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0 };
  const common = { style: { ...style, transition: 'opacity 500ms' }, draggable: false } as const;

  return (
    <div ref={frameRef} className="absolute inset-0 overflow-hidden">
      {mime.startsWith('video/') ? (
        <video
          key={src}
          src={src}
          {...common}
          autoPlay
          loop
          muted
          playsInline
          onLoadedMetadata={(e) => gotSize(e.currentTarget.videoWidth, e.currentTarget.videoHeight)}
        />
      ) : (
        <img
          key={src}
          src={src}
          alt=""
          {...common}
          onLoad={(e) => gotSize(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
        />
      )}
    </div>
  );
}
