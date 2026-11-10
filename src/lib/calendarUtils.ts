// Помощники календаря обновлений. Даты хранятся строками «ГГГГ-ММ-ДД» (локальный день, без часовых поясов).

export interface PlannedUpdate {
  id: string;
  date: string; // ГГГГ-ММ-ДД
  title: string;
  description: string;
}

export interface CalendarDay {
  key: string;
  day: number;
  inMonth: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');

export const toKey = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function isValidDateKey(key: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d;
}

export function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Недели месяца, понедельник первый. Неполные недели добираются днями соседних месяцев.
export function buildMonthGrid(year: number, month: number): CalendarDay[][] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // 0 = понедельник
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7;
  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < totalCells; i += 7) {
    const week: CalendarDay[] = [];
    for (let j = 0; j < 7; j++) {
      const d = new Date(year, month, 1 - offset + i + j);
      week.push({ key: toKey(d), day: d.getDate(), inMonth: d.getMonth() === month });
    }
    weeks.push(week);
  }
  return weeks;
}

// Разница в днях между двумя датами (b - a), без влияния перехода на летнее время
export function daysBetween(aKey: string, bKey: string): number {
  const [ay, am, ad] = aKey.split('-').map(Number);
  const [by, bm, bd] = bKey.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

export function groupByDate(plans: PlannedUpdate[]): Record<string, PlannedUpdate[]> {
  const map: Record<string, PlannedUpdate[]> = {};
  for (const p of plans) (map[p.date] ||= []).push(p);
  return map;
}

// Ближайшее обновление: сегодняшнее или самое раннее из будущих
export function nextUpcoming(plans: PlannedUpdate[], todayKey: string): PlannedUpdate | null {
  const future = plans.filter((p) => p.date >= todayKey).sort((a, b) => (a.date === b.date ? a.title.localeCompare(b.title) : a.date < b.date ? -1 : 1));
  return future[0] ?? null;
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export function distanceLabel(days: number): string {
  if (days === 0) return 'сегодня';
  if (days === 1) return 'завтра';
  if (days === -1) return 'вчера';
  if (days > 1) return `через ${days} ${plural(days, 'день', 'дня', 'дней')}`;
  const n = -days;
  return `${n} ${plural(n, 'день', 'дня', 'дней')} назад`;
}

// «Что будет добавлено»: каждая строка отдельный пункт, маркеры в начале строки убираем
export function descriptionItems(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-•*–—]|\d+[.)])\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 30);
}
