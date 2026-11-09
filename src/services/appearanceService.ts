// Внешний вид: цвета сообщений, фон чата и параметры жидкого стекла.
// Всё хранится на этом устройстве (localStorage + IndexedDB для картинки), в Firestore ничего не пишется.
// Применяется через атрибуты и CSS-переменные на <html>, стили лежат в index.css.

import { useSyncExternalStore } from 'react';
import { bgStore } from '../lib/bgStore';

export type BgMode = 'default' | 'color' | 'gradient' | 'image';
export type MenuAnim = 'off' | 'soft' | 'spring';

export interface AppearanceSettings {
  // Цвета сообщений. null = стандартный цвет темы
  myBubble: string | null;
  myText: string | null;
  theirBubble: string | null;
  theirText: string | null;
  // Фон чата
  bgMode: BgMode;
  bgColor: string;
  bgColor2: string;
  bgAngle: number; // градусы, для градиента
  bgImageName: string | null;
  bgDim: number; // затемнение картинки, %
  // Жидкое стекло (шапка, поле ввода, окно настроек)
  glassCustom: boolean; // false = стандартное стекло темы
  glassTint: string;
  glassOpacity: number; // %
  glassBlur: number; // px
  glassSaturation: number; // %
  glassEdge: number; // яркость кромки, %
  // Контекстное меню сообщения (отдельное стекло и анимация)
  menuCustom: boolean; // false = стандартное стекло темы
  menuTint: string;
  menuOpacity: number; // %
  menuBlur: number; // px
  menuSaturation: number; // %
  menuEdge: number; // %
  menuRadius: number; // px
  menuAnim: MenuAnim;
}

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  myBubble: null,
  myText: null,
  theirBubble: null,
  theirText: null,
  bgMode: 'default',
  bgColor: '#0f172a',
  bgColor2: '#3b0764',
  bgAngle: 135,
  bgImageName: null,
  bgDim: 30,
  glassCustom: false,
  glassTint: '#ffffff',
  glassOpacity: 55,
  glassBlur: 22,
  glassSaturation: 180,
  glassEdge: 60,
  menuCustom: false,
  menuTint: '#ffffff',
  menuOpacity: 62,
  menuBlur: 24,
  menuSaturation: 180,
  menuEdge: 65,
  menuRadius: 18,
  menuAnim: 'spring',
};

export const MAX_BG_BYTES = 6 * 1024 * 1024;

const STORAGE_KEY = 'mix_appearance_v1';
const HEX = /^#[0-9a-f]{6}$/i;

const clamp = (n: unknown, min: number, max: number, fallback: number) => {
  const v = typeof n === 'number' && isFinite(n) ? n : fallback;
  return Math.min(max, Math.max(min, v));
};
const hexOr = (v: unknown, fallback: string) => (typeof v === 'string' && HEX.test(v) ? v : fallback);
const hexOrNull = (v: unknown) => (typeof v === 'string' && HEX.test(v) ? v : null);

// Защита от испорченного localStorage: принимаем только корректные значения
function sanitize(raw: any): AppearanceSettings {
  const d = DEFAULT_APPEARANCE;
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    myBubble: hexOrNull(r.myBubble),
    myText: hexOrNull(r.myText),
    theirBubble: hexOrNull(r.theirBubble),
    theirText: hexOrNull(r.theirText),
    bgMode: ['default', 'color', 'gradient', 'image'].includes(r.bgMode) ? r.bgMode : d.bgMode,
    bgColor: hexOr(r.bgColor, d.bgColor),
    bgColor2: hexOr(r.bgColor2, d.bgColor2),
    bgAngle: clamp(r.bgAngle, 0, 360, d.bgAngle),
    bgImageName: typeof r.bgImageName === 'string' ? r.bgImageName.slice(0, 60) : null,
    bgDim: clamp(r.bgDim, 0, 80, d.bgDim),
    glassCustom: r.glassCustom === true,
    glassTint: hexOr(r.glassTint, d.glassTint),
    glassOpacity: clamp(r.glassOpacity, 0, 100, d.glassOpacity),
    glassBlur: clamp(r.glassBlur, 0, 60, d.glassBlur),
    glassSaturation: clamp(r.glassSaturation, 100, 250, d.glassSaturation),
    glassEdge: clamp(r.glassEdge, 0, 100, d.glassEdge),
    menuCustom: r.menuCustom === true,
    menuTint: hexOr(r.menuTint, d.menuTint),
    menuOpacity: clamp(r.menuOpacity, 0, 100, d.menuOpacity),
    menuBlur: clamp(r.menuBlur, 0, 60, d.menuBlur),
    menuSaturation: clamp(r.menuSaturation, 100, 250, d.menuSaturation),
    menuEdge: clamp(r.menuEdge, 0, 100, d.menuEdge),
    menuRadius: clamp(r.menuRadius, 6, 30, d.menuRadius),
    menuAnim: ['off', 'soft', 'spring'].includes(r.menuAnim) ? r.menuAnim : d.menuAnim,
  };
}

function load(): AppearanceSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return sanitize(JSON.parse(raw));
  } catch {
    // испорченные данные: начинаем с настроек по умолчанию
  }
  return { ...DEFAULT_APPEARANCE };
}

function hexToRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

let state: AppearanceSettings = load();
let bgUrl: string | null = null;
const listeners = new Set<() => void>();

function apply() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const s = state;

  const bubble = (attr: string, variable: string, value: string | null) => {
    if (value) {
      root.setAttribute(attr, '');
      root.style.setProperty(variable, value);
    } else {
      root.removeAttribute(attr);
      root.style.removeProperty(variable);
    }
  };
  bubble('data-my-bubble', '--my-bubble', s.myBubble);
  bubble('data-my-text', '--my-text', s.myText);
  bubble('data-their-bubble', '--their-bubble', s.theirBubble);
  bubble('data-their-text', '--their-text', s.theirText);

  // Фон чата
  let bgColor: string | null = null;
  let bgImage = 'none';
  if (s.bgMode === 'color') {
    bgColor = s.bgColor;
  } else if (s.bgMode === 'gradient') {
    bgColor = s.bgColor;
    bgImage = `linear-gradient(${Math.round(s.bgAngle)}deg, ${s.bgColor}, ${s.bgColor2})`;
  } else if (s.bgMode === 'image' && bgUrl) {
    const dim = (s.bgDim / 100).toFixed(2);
    bgColor = '#000000';
    bgImage = `linear-gradient(rgba(0,0,0,${dim}), rgba(0,0,0,${dim})), url("${bgUrl}")`;
  }
  if (bgColor) {
    root.setAttribute('data-chat-bg', s.bgMode);
    root.style.setProperty('--chat-bg-color', bgColor);
    root.style.setProperty('--chat-bg-image', bgImage);
  } else {
    root.removeAttribute('data-chat-bg');
    root.style.removeProperty('--chat-bg-color');
    root.style.removeProperty('--chat-bg-image');
  }

  // Жидкое стекло
  if (s.glassCustom) {
    const a1 = s.glassOpacity / 100;
    root.setAttribute('data-glass-custom', '');
    root.style.setProperty('--glass-rgb', hexToRgb(s.glassTint));
    root.style.setProperty('--glass-a1', a1.toFixed(3));
    root.style.setProperty('--glass-a2', (a1 * 0.55).toFixed(3));
    root.style.setProperty('--glass-blur', `${s.glassBlur}px`);
    root.style.setProperty('--glass-sat', `${s.glassSaturation}%`);
    root.style.setProperty('--glass-edge', (s.glassEdge / 100).toFixed(3));
  } else {
    root.removeAttribute('data-glass-custom');
    for (const v of ['--glass-rgb', '--glass-a1', '--glass-a2', '--glass-blur', '--glass-sat', '--glass-edge']) {
      root.style.removeProperty(v);
    }
  }

  // Стекло контекстного меню
  const menuVars = ['--menu-rgb', '--menu-a1', '--menu-a2', '--menu-blur', '--menu-sat', '--menu-edge', '--menu-radius', '--menu-fg'];
  if (s.menuCustom) {
    const a1 = s.menuOpacity / 100;
    root.setAttribute('data-menu-custom', '');
    root.style.setProperty('--menu-rgb', hexToRgb(s.menuTint));
    root.style.setProperty('--menu-a1', a1.toFixed(3));
    root.style.setProperty('--menu-a2', (a1 * 0.62).toFixed(3));
    root.style.setProperty('--menu-blur', `${s.menuBlur}px`);
    root.style.setProperty('--menu-sat', `${s.menuSaturation}%`);
    root.style.setProperty('--menu-edge', (s.menuEdge / 100).toFixed(3));
    root.style.setProperty('--menu-radius', `${s.menuRadius}px`);
    // Цвет текста по яркости выбранного цвета стекла (если стекло достаточно плотное)
    if (a1 >= 0.35) {
      const n = parseInt(s.menuTint.slice(1), 16);
      const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
      root.setAttribute('data-menu-fg', '');
      root.style.setProperty('--menu-fg', lum > 0.55 ? '#1f2937' : '#f3f4f6');
    } else {
      root.removeAttribute('data-menu-fg');
      root.style.removeProperty('--menu-fg');
    }
  } else {
    root.removeAttribute('data-menu-custom');
    root.removeAttribute('data-menu-fg');
    for (const v of menuVars) root.style.removeProperty(v);
  }
}

function emit() {
  listeners.forEach((l) => l());
}

function commit(next: AppearanceSettings) {
  state = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // хранилище недоступно: настройки действуют до закрытия
  }
  apply();
  emit();
}

function setBgUrl(blob: Blob | null) {
  if (bgUrl) URL.revokeObjectURL(bgUrl);
  bgUrl = blob ? URL.createObjectURL(blob) : null;
}

async function restoreBackgroundImage() {
  if (state.bgMode !== 'image') return;
  try {
    const blob = await bgStore.load();
    if (!blob) {
      commit({ ...state, bgMode: 'default', bgImageName: null });
      return;
    }
    setBgUrl(blob);
    apply();
    emit();
  } catch (e) {
    console.warn('Failed to restore chat background', e);
  }
}

export const appearance = {
  getSnapshot: (): AppearanceSettings => state,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  update(patch: Partial<AppearanceSettings>) {
    commit(sanitize({ ...state, ...patch }));
  },

  // Сброс блока настроек
  reset(section: 'messages' | 'background' | 'glass' | 'menu' | 'all') {
    const d = DEFAULT_APPEARANCE;
    let next = { ...state };
    if (section === 'messages' || section === 'all') {
      next = { ...next, myBubble: null, myText: null, theirBubble: null, theirText: null };
    }
    if (section === 'background' || section === 'all') {
      setBgUrl(null);
      void bgStore.clear().catch(() => {});
      next = { ...next, bgMode: 'default', bgColor: d.bgColor, bgColor2: d.bgColor2, bgAngle: d.bgAngle, bgImageName: null, bgDim: d.bgDim };
    }
    if (section === 'glass' || section === 'all') {
      next = { ...next, glassCustom: false, glassTint: d.glassTint, glassOpacity: d.glassOpacity, glassBlur: d.glassBlur, glassSaturation: d.glassSaturation, glassEdge: d.glassEdge };
    }
    if (section === 'menu' || section === 'all') {
      next = { ...next, menuCustom: false, menuTint: d.menuTint, menuOpacity: d.menuOpacity, menuBlur: d.menuBlur, menuSaturation: d.menuSaturation, menuEdge: d.menuEdge, menuRadius: d.menuRadius, menuAnim: d.menuAnim };
    }
    commit(next);
  },

  // Картинка фона. Бросает Error с понятным текстом.
  async setBackgroundImage(file: File): Promise<void> {
    if (!file.type.startsWith('image/')) throw new Error('Выберите картинку (JPG, PNG, WEBP, GIF)');
    if (file.size > MAX_BG_BYTES) throw new Error('Картинка больше 6 МБ');
    try {
      await bgStore.save(file);
    } catch {
      throw new Error('Не удалось сохранить картинку на этом устройстве');
    }
    setBgUrl(file);
    commit(sanitize({ ...state, bgMode: 'image', bgImageName: file.name }));
  },

  async clearBackgroundImage(): Promise<void> {
    setBgUrl(null);
    try {
      await bgStore.clear();
    } catch (e) {
      console.warn('Failed to clear chat background', e);
    }
    commit({ ...state, bgMode: 'default', bgImageName: null });
  },
};

export function useAppearance(): AppearanceSettings {
  return useSyncExternalStore(appearance.subscribe, appearance.getSnapshot, appearance.getSnapshot);
}

// Применяем сохранённое сразу при загрузке, до первой отрисовки
apply();
void restoreBackgroundImage();
