import React, { useRef, useState } from 'react';
import { Palette, Image as ImageIcon, Upload, Trash2, RotateCcw, Droplets, MousePointerClick, Play, Reply, Copy } from 'lucide-react';
import { appearance, useAppearance, DEFAULT_APPEARANCE, BgMode, MenuAnim } from '../services/appearanceService';
import { ContextMenuPanel, ContextMenuItem } from './ContextMenu';
import { cn } from '../lib/utils';

const card = 'p-3 rounded-2xl border border-gray-200 dark:border-[#333] space-y-3';
const subTitle = 'text-xs md:text-sm font-medium text-gray-900 dark:text-gray-100';
const hint = 'text-[11px] text-gray-500 dark:text-gray-400';
const smallBtn =
  'inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl border border-gray-200 dark:border-[#333] text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#252525] disabled:opacity-50 transition-all';

// Строка «цвет»: выбор цвета + сброс на стандартный
function ColorRow({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string;
  value: string | null;
  fallback: string;
  onChange: (v: string | null) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={hint}>{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || fallback}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="w-9 h-7 p-0 rounded-md border border-gray-300 dark:border-[#444] bg-transparent cursor-pointer"
        />
        <button
          type="button"
          onClick={() => onChange(null)}
          disabled={!value}
          className="text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-40 disabled:cursor-default"
        >
          стандарт
        </button>
      </div>
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block space-y-1">
      <div className="flex items-center justify-between">
        <span className={hint}>{label}</span>
        <span className="text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
          {Math.round(value)}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-blue-500"
      />
    </label>
  );
}

const BG_MODES: { id: BgMode; label: string }[] = [
  { id: 'default', label: 'Стандарт' },
  { id: 'color', label: 'Цвет' },
  { id: 'gradient', label: 'Градиент' },
  { id: 'image', label: 'Картинка' },
];

const MENU_ANIMS: { id: MenuAnim; label: string }[] = [
  { id: 'off', label: 'Нет' },
  { id: 'soft', label: 'Плавная' },
  { id: 'spring', label: 'Пружинная' },
];

const PREVIEW_ITEMS: ContextMenuItem[] = [
  { id: 'reply', label: 'Ответить', icon: <Reply className="w-4 h-4" />, onClick: () => {} },
  { id: 'copy', label: 'Копировать', icon: <Copy className="w-4 h-4" />, onClick: () => {} },
  { id: 'delete', label: 'Удалить', icon: <Trash2 className="w-4 h-4" />, danger: true, onClick: () => {} },
];

export function AppearanceSettings() {
  const s = useAppearance();
  const [previewKey, setPreviewKey] = useState(0); // меняем ключ, чтобы проиграть анимацию меню заново
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Любое изменение стекла включает «свои параметры»
  const setGlass = (patch: Partial<typeof s>) => appearance.update({ glassCustom: true, ...patch });
  const setMenu = (patch: Partial<typeof s>) => appearance.update({ menuCustom: true, ...patch });

  const pickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await appearance.setBackgroundImage(file);
    } catch (err: any) {
      setError(err?.message || 'Не удалось загрузить картинку');
    } finally {
      setBusy(false);
    }
  };

  const chooseMode = (mode: BgMode) => {
    setError(null);
    if (mode === 'image' && !s.bgImageName) {
      fileRef.current?.click(); // для картинки сразу открываем выбор файла
      return;
    }
    appearance.update({ bgMode: mode });
  };

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium dark:text-white flex items-center gap-2">
        <Palette className="w-4 h-4 text-[#5A5A40] dark:text-[#A0A080]" />
        Внешний вид чата
      </h4>

      {/* Предпросмотр: те же классы, что и в настоящем чате */}
      <div className="chat-surface relative overflow-hidden rounded-2xl border border-gray-200 dark:border-[#333] bg-[#fafafa] dark:bg-[#080808] p-3 pt-14 space-y-2">
        <div className="glass-bar absolute top-2 left-2 right-2 rounded-2xl px-3 py-2 text-xs font-medium text-gray-800 dark:text-gray-100 pointer-events-none">
          Жидкое стекло
        </div>
        <div className="flex">
          <div className="msg-theirs px-3 py-2 rounded-2xl rounded-tl-none text-xs shadow-sm bg-white dark:bg-[#1e1e1e] border border-gray-100 dark:border-[#333] text-gray-800 dark:text-gray-200">
            Привет! Как дела?
            <div className="msg-meta text-[9px] mt-0.5 text-gray-400 dark:text-gray-500 text-right">12:40</div>
          </div>
        </div>
        <div className="flex justify-end">
          <div className="msg-mine px-3 py-2 rounded-2xl rounded-tr-none text-xs shadow-md bg-[#1a1a1a] dark:bg-[#e5e5e0] text-white dark:text-black">
            Отлично, настраиваю Mix
            <div className="msg-meta text-[9px] mt-0.5 text-white/80 dark:text-black/80 text-right">12:41</div>
          </div>
        </div>
      </div>

      {/* Цвета сообщений */}
      <div className={card}>
        <div className="flex items-center justify-between">
          <p className={subTitle}>Цвета сообщений</p>
          <button type="button" onClick={() => appearance.reset('messages')} className={smallBtn}>
            <RotateCcw className="w-3 h-3" />
            Сбросить
          </button>
        </div>
        <ColorRow label="Мои: фон" value={s.myBubble} fallback="#1a1a1a" onChange={(v) => appearance.update({ myBubble: v })} />
        <ColorRow label="Мои: текст" value={s.myText} fallback="#ffffff" onChange={(v) => appearance.update({ myText: v })} />
        <ColorRow label="Собеседника: фон" value={s.theirBubble} fallback="#ffffff" onChange={(v) => appearance.update({ theirBubble: v })} />
        <ColorRow label="Собеседника: текст" value={s.theirText} fallback="#1f2937" onChange={(v) => appearance.update({ theirText: v })} />
      </div>

      {/* Фон чата */}
      <div className={card}>
        <div className="flex items-center justify-between">
          <p className={cn(subTitle, 'flex items-center gap-2')}>
            <ImageIcon className="w-4 h-4 text-gray-400" />
            Фон чата
          </p>
          <button type="button" onClick={() => appearance.reset('background')} className={smallBtn}>
            <RotateCcw className="w-3 h-3" />
            Сбросить
          </button>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {BG_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => chooseMode(m.id)}
              className={cn(
                'py-1.5 rounded-xl text-[11px] font-medium border transition-all',
                s.bgMode === m.id
                  ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                  : 'border-gray-200 dark:border-[#333] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#252525]'
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {(s.bgMode === 'color' || s.bgMode === 'gradient') && (
          <div className="space-y-2.5">
            <ColorRow label={s.bgMode === 'gradient' ? 'Цвет 1' : 'Цвет фона'} value={s.bgColor} fallback={DEFAULT_APPEARANCE.bgColor} onChange={(v) => appearance.update({ bgColor: v || DEFAULT_APPEARANCE.bgColor })} />
            {s.bgMode === 'gradient' && (
              <>
                <ColorRow label="Цвет 2" value={s.bgColor2} fallback={DEFAULT_APPEARANCE.bgColor2} onChange={(v) => appearance.update({ bgColor2: v || DEFAULT_APPEARANCE.bgColor2 })} />
                <SliderRow label="Угол градиента" value={s.bgAngle} min={0} max={360} unit="°" onChange={(v) => appearance.update({ bgAngle: v })} />
              </>
            )}
          </div>
        )}

        {s.bgMode === 'image' && (
          <div className="space-y-2.5">
            <p className={cn(hint, 'truncate')}>{s.bgImageName ? s.bgImageName : 'Картинка не выбрана'}</p>
            <SliderRow label="Затемнение" value={s.bgDim} min={0} max={80} unit="%" onChange={(v) => appearance.update({ bgDim: v })} />
            <div className="flex gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className={cn(smallBtn, 'flex-1')}>
                <Upload className="w-3.5 h-3.5" />
                Выбрать другую
              </button>
              <button type="button" onClick={() => void appearance.clearBackgroundImage()} className={cn(smallBtn, 'flex-1')}>
                <Trash2 className="w-3.5 h-3.5" />
                Убрать
              </button>
            </div>
          </div>
        )}

        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickImage} />
        {error && <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>}
        <p className="text-[11px] text-gray-400 dark:text-gray-500">
          Картинка до 6 МБ. Фон и цвета хранятся на этом устройстве и видны только вам.
        </p>
      </div>

      {/* Жидкое стекло */}
      <div className={card}>
        <div className="flex items-center justify-between">
          <p className={cn(subTitle, 'flex items-center gap-2')}>
            <Droplets className="w-4 h-4 text-gray-400" />
            Жидкое стекло
          </p>
          <button type="button" onClick={() => appearance.reset('glass')} className={smallBtn}>
            <RotateCcw className="w-3 h-3" />
            Сбросить
          </button>
        </div>
        <p className={hint}>
          {s.glassCustom
            ? 'Свои параметры. Действуют на окно настроек, шапку чата и поле ввода.'
            : 'Сейчас стандартное стекло темы. Подвиньте любой ползунок, чтобы настроить своё.'}
        </p>
        <ColorRow label="Цвет стекла" value={s.glassCustom ? s.glassTint : null} fallback={s.glassTint} onChange={(v) => (v ? setGlass({ glassTint: v }) : appearance.reset('glass'))} />
        <SliderRow label="Прозрачность (плотность цвета)" value={s.glassOpacity} min={0} max={100} unit="%" onChange={(v) => setGlass({ glassOpacity: v })} />
        <SliderRow label="Размытие" value={s.glassBlur} min={0} max={60} unit=" px" onChange={(v) => setGlass({ glassBlur: v })} />
        <SliderRow label="Насыщенность" value={s.glassSaturation} min={100} max={250} unit="%" onChange={(v) => setGlass({ glassSaturation: v })} />
        <SliderRow label="Яркость кромки" value={s.glassEdge} min={0} max={100} unit="%" onChange={(v) => setGlass({ glassEdge: v })} />
      </div>

      {/* Контекстное меню сообщения */}
      <div className={card}>
        <div className="flex items-center justify-between">
          <p className={cn(subTitle, 'flex items-center gap-2')}>
            <MousePointerClick className="w-4 h-4 text-gray-400" />
            Меню сообщения
          </p>
          <button type="button" onClick={() => appearance.reset('menu')} className={smallBtn}>
            <RotateCcw className="w-3 h-3" />
            Сбросить
          </button>
        </div>
        <p className={hint}>Открывается правым кликом по сообщению или кнопкой «⋯» рядом с ним (долгое нажатие на сенсорном экране).</p>

        <div className="chat-surface relative h-44 overflow-hidden rounded-2xl border border-gray-200 dark:border-[#333] bg-[#fafafa] dark:bg-[#080808]">
          <div className="msg-theirs absolute left-3 top-3 px-3 py-2 rounded-2xl rounded-tl-none text-xs shadow-sm bg-white dark:bg-[#1e1e1e] border border-gray-100 dark:border-[#333] text-gray-800 dark:text-gray-200">
            Сообщение, к которому открыто меню
          </div>
          <div className="msg-mine absolute right-3 bottom-3 px-3 py-2 rounded-2xl rounded-tr-none text-xs shadow-md bg-[#1a1a1a] dark:bg-[#e5e5e0] text-white dark:text-black">
            Ещё одно сообщение для размытия
          </div>
          <ContextMenuPanel key={previewKey} items={PREVIEW_ITEMS} anim={s.menuAnim} className="absolute left-10 top-10 w-52" />
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {MENU_ANIMS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => {
                appearance.update({ menuAnim: a.id });
                setPreviewKey((k) => k + 1);
              }}
              className={cn(
                'py-1.5 rounded-xl text-[11px] font-medium border transition-all',
                s.menuAnim === a.id
                  ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                  : 'border-gray-200 dark:border-[#333] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#252525]'
              )}
            >
              {a.label}
            </button>
          ))}
          <button type="button" onClick={() => setPreviewKey((k) => k + 1)} className={cn(smallBtn, 'px-0')} title="Показать анимацию ещё раз">
            <Play className="w-3.5 h-3.5" />
          </button>
        </div>

        <p className={hint}>
          {s.menuCustom ? 'Свои параметры стекла для меню.' : 'Сейчас стандартное стекло темы. Подвиньте любой ползунок, чтобы настроить своё.'}
        </p>
        <ColorRow label="Цвет стекла" value={s.menuCustom ? s.menuTint : null} fallback={s.menuTint} onChange={(v) => (v ? setMenu({ menuTint: v }) : appearance.reset('menu'))} />
        <SliderRow label="Прозрачность (плотность цвета)" value={s.menuOpacity} min={0} max={100} unit="%" onChange={(v) => setMenu({ menuOpacity: v })} />
        <SliderRow label="Размытие" value={s.menuBlur} min={0} max={60} unit=" px" onChange={(v) => setMenu({ menuBlur: v })} />
        <SliderRow label="Насыщенность" value={s.menuSaturation} min={100} max={250} unit="%" onChange={(v) => setMenu({ menuSaturation: v })} />
        <SliderRow label="Яркость кромки" value={s.menuEdge} min={0} max={100} unit="%" onChange={(v) => setMenu({ menuEdge: v })} />
        <SliderRow label="Скругление углов" value={s.menuRadius} min={6} max={30} unit=" px" onChange={(v) => setMenu({ menuRadius: v })} />
      </div>

      <button type="button" onClick={() => appearance.reset('all')} className={cn(smallBtn, 'w-full')}>
        <RotateCcw className="w-3.5 h-3.5" />
        Сбросить весь внешний вид
      </button>
    </div>
  );
}
