import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CalendarDays, ChevronLeft, ChevronRight, Rocket } from 'lucide-react';
import { plannedUpdates } from '../services/plannedUpdates';
import {
  PlannedUpdate,
  buildMonthGrid,
  daysBetween,
  descriptionItems,
  distanceLabel,
  groupByDate,
  nextUpcoming,
  parseKey,
  toKey,
} from '../lib/calendarUtils';
import { cn } from '../lib/utils';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const monthFmt = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' });
const dayFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });

const gridVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 24 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -24 }),
};

// Календарь запланированных обновлений: администратор указывает даты и что будет добавлено, все остальные читают
export function UpdateCalendar() {
  const todayKey = toKey(new Date());
  const [plans, setPlans] = useState<PlannedUpdate[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });
  const [dir, setDir] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);

  // Слушаем календарь только пока открыт раздел: записи администратора появляются без перезапуска
  useEffect(() => {
    const unsub = plannedUpdates.subscribe(
      (items) => {
        setPlans(items);
        setLoaded(true);
        setFailed(false);
      },
      () => {
        setFailed(true);
        setLoaded(true);
      }
    );
    return unsub;
  }, []);

  const byDate = useMemo(() => groupByDate(plans), [plans]);
  const next = useMemo(() => nextUpcoming(plans, todayKey), [plans, todayKey]);
  const weeks = useMemo(() => buildMonthGrid(view.year, view.month), [view]);

  const shiftMonth = (delta: number) => {
    setDir(delta);
    const d = new Date(view.year, view.month + delta, 1);
    setView({ year: d.getFullYear(), month: d.getMonth() });
  };

  const goTo = (key: string) => {
    const d = parseKey(key);
    const target = d.getFullYear() * 12 + d.getMonth();
    const current = view.year * 12 + view.month;
    if (target !== current) setDir(target > current ? 1 : -1);
    setView({ year: d.getFullYear(), month: d.getMonth() });
    setSelected(key);
  };

  const monthTitle = monthFmt.format(new Date(view.year, view.month, 1));
  const selectedPlans = selected ? byDate[selected] ?? [] : [];

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium dark:text-white flex items-center gap-2">
        <CalendarDays className="w-4 h-4 text-[#5A5A40] dark:text-[#A0A080]" />
        Календарь обновлений
      </h4>

      {/* Ближайшее обновление */}
      {loaded && !failed && (
        <button
          type="button"
          disabled={!next}
          onClick={() => next && goTo(next.date)}
          className="w-full text-left p-3 rounded-2xl border border-gray-200 dark:border-[#333] bg-gradient-to-br from-indigo-500/10 to-purple-500/10 hover:from-indigo-500/15 hover:to-purple-500/15 disabled:hover:from-indigo-500/10 disabled:hover:to-purple-500/10 transition-all flex items-start gap-3 disabled:cursor-default"
        >
          <Rocket className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
          {next ? (
            <div className="min-w-0">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Следующее обновление: {dayFmt.format(parseKey(next.date))} ({distanceLabel(daysBetween(todayKey, next.date))})
              </p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{next.title}</p>
            </div>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400">Дата следующего обновления пока не назначена.</p>
          )}
        </button>
      )}
      {failed && <p className="text-[11px] text-red-600 dark:text-red-400">Не удалось загрузить календарь обновлений.</p>}

      <div className="p-3 rounded-2xl border border-gray-200 dark:border-[#333] space-y-2">
        {/* Месяц */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label="Предыдущий месяц"
            className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium capitalize text-gray-900 dark:text-gray-100">{monthTitle}</span>
            <button
              type="button"
              onClick={() => goTo(todayKey)}
              className="text-[11px] px-2 py-0.5 rounded-full border border-gray-200 dark:border-[#333] text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/10"
            >
              Сегодня
            </button>
          </div>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label="Следующий месяц"
            className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 text-center">
          {WEEKDAYS.map((w) => (
            <span key={w} className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 py-1">
              {w}
            </span>
          ))}
        </div>

        {/* Сетка дней: при смене месяца плавно уезжает в сторону переключения */}
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={`${view.year}-${view.month}`}
            custom={dir}
            variants={gridVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="grid grid-cols-7 gap-y-1"
          >
            {weeks.flat().map((d) => {
              const items = byDate[d.key];
              const isToday = d.key === todayKey;
              const isSelected = d.key === selected;
              const isPast = d.key < todayKey;
              return (
                <motion.button
                  key={d.key}
                  type="button"
                  whileTap={{ scale: 0.88 }}
                  onClick={() => setSelected(isSelected ? null : d.key)}
                  className={cn(
                    'relative mx-auto w-9 h-9 rounded-full text-xs flex items-center justify-center transition-colors',
                    d.inMonth ? 'text-gray-800 dark:text-gray-100' : 'text-gray-300 dark:text-gray-600',
                    isToday && !isSelected && 'ring-1 ring-blue-500 text-blue-600 dark:text-blue-400 font-semibold',
                    isSelected
                      ? 'bg-gradient-to-br from-indigo-500 to-purple-500 text-white font-semibold'
                      : items
                        ? 'bg-indigo-500/10 font-medium hover:bg-indigo-500/20'
                        : 'hover:bg-black/5 dark:hover:bg-white/10'
                  )}
                >
                  {d.day}
                  {items && (
                    <span
                      className={cn(
                        'absolute bottom-1 w-1 h-1 rounded-full',
                        isSelected ? 'bg-white' : isPast ? 'bg-gray-400' : 'bg-indigo-500'
                      )}
                    />
                  )}
                </motion.button>
              );
            })}
          </motion.div>
        </AnimatePresence>

        {/* Что запланировано на выбранный день */}
        <AnimatePresence initial={false}>
          {selected && (
            <motion.div
              key={selected}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pt-3 mt-1 border-t border-black/5 dark:border-white/10 space-y-3">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {dayFmt.format(parseKey(selected))} · {distanceLabel(daysBetween(todayKey, selected))}
                </p>
                {selectedPlans.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-gray-500">На этот день обновлений не запланировано.</p>
                ) : (
                  selectedPlans.map((p) => {
                    const items = descriptionItems(p.description);
                    return (
                      <div key={p.id} className="space-y-1.5">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{p.title}</p>
                        {items.length > 0 ? (
                          <ul className="space-y-1">
                            {items.map((it, i) => (
                              <li key={i} className="flex gap-2 text-xs text-gray-600 dark:text-gray-300">
                                <span className="mt-1.5 w-1 h-1 rounded-full bg-indigo-500 shrink-0" />
                                <span className="min-w-0 break-words">{it}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-gray-400 dark:text-gray-500">Описание пока не добавлено.</p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
