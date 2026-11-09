import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, Variants } from 'motion/react';
import { useAppearance, MenuAnim } from '../services/appearanceService';
import { cn } from '../lib/utils';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  onClick: () => void;
}

// Анимации: «Плавная» (лёгкое появление) и «Пружинная» (выскакивает из угла + элементы по очереди)
function panelVariants(anim: MenuAnim): Variants {
  if (anim === 'off') {
    return { closed: { opacity: 1 }, open: { opacity: 1 }, exit: { opacity: 0, transition: { duration: 0 } } };
  }
  if (anim === 'soft') {
    return {
      closed: { opacity: 0, scale: 0.94, y: -4 },
      open: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.16, ease: [0.22, 1, 0.36, 1] } },
      exit: { opacity: 0, scale: 0.97, transition: { duration: 0.1 } },
    };
  }
  return {
    closed: { opacity: 0, scale: 0.55 },
    open: {
      opacity: 1,
      scale: 1,
      transition: { type: 'spring', stiffness: 520, damping: 26, mass: 0.8, staggerChildren: 0.035, delayChildren: 0.04 },
    },
    exit: { opacity: 0, scale: 0.85, transition: { duration: 0.12 } },
  };
}

function itemVariants(anim: MenuAnim): Variants {
  if (anim !== 'spring') return { closed: {}, open: {} };
  return {
    closed: { opacity: 0, x: -8 },
    open: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 500, damping: 30 } },
  };
}

// Сама панель меню. Используется и в чате, и в предпросмотре настроек.
export function ContextMenuPanel({
  items,
  anim,
  onSelect,
  className,
  style,
  animateState = 'open',
  panelRef,
}: {
  items: ContextMenuItem[];
  anim: MenuAnim;
  onSelect?: (item: ContextMenuItem) => void;
  className?: string;
  style?: React.CSSProperties;
  animateState?: 'open' | 'closed';
  panelRef?: React.Ref<HTMLDivElement>;
}) {
  const iv = itemVariants(anim);
  return (
    <motion.div
      ref={panelRef}
      role="menu"
      variants={panelVariants(anim)}
      initial="closed"
      animate={animateState}
      exit="exit"
      className={cn('glass-menu isolate min-w-[190px] py-1.5 overflow-hidden select-none', className)}
      style={style}
    >
      {items.map((item) => (
        <motion.button
          key={item.id}
          role="menuitem"
          type="button"
          variants={iv}
          onClick={() => onSelect?.(item)}
          className={cn(
            'flex w-full items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors',
            item.danger ? 'text-red-500 hover:bg-red-500/10' : 'hover:bg-black/5 dark:hover:bg-white/10'
          )}
        >
          {item.icon && <span className="w-4 h-4 flex items-center justify-center shrink-0 opacity-80">{item.icon}</span>}
          <span className="truncate">{item.label}</span>
        </motion.button>
      ))}
    </motion.div>
  );
}

// Меню у курсора: рисуется поверх всего через портал, не вылезает за экран, закрывается кликом мимо, Esc и прокруткой
export function MessageContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}) {
  const { menuAnim } = useAppearance();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; origin: string } | null>(null);

  // Измеряем меню и разворачиваем его от курсора так, чтобы оно влезло в окно
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { offsetWidth: w, offsetHeight: h } = el;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const m = 8;
    const flipX = x + w > vw - m;
    const flipY = y + h > vh - m;
    setPos({
      left: Math.max(m, flipX ? x - w : x),
      top: Math.max(m, flipY ? y - h : y),
      origin: `${flipX ? 'right' : 'left'} ${flipY ? 'bottom' : 'top'}`,
    });
  }, [x, y, items.length]);

  useEffect(() => {
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    window.addEventListener('blur', close);
    document.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('blur', close);
      document.removeEventListener('scroll', close, true);
    };
  }, [onClose]);

  return createPortal(
    <ContextMenuPanel
      panelRef={ref}
      items={items}
      anim={menuAnim}
      animateState={pos ? 'open' : 'closed'}
      onSelect={(item) => {
        onClose();
        item.onClick();
      }}
      className="fixed z-[300]"
      style={{
        left: pos?.left ?? x,
        top: pos?.top ?? y,
        transformOrigin: pos?.origin ?? 'left top',
        visibility: pos ? 'visible' : 'hidden', // пока меню не измерено, его не видно
      }}
    />,
    document.body
  );
}
