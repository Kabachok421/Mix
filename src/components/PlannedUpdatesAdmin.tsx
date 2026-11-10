import React, { useEffect, useState } from 'react';
import { CalendarDays, Pencil, Trash2, Plus, X, Check, RefreshCw } from 'lucide-react';
import { plannedUpdates } from '../services/plannedUpdates';
import { PlannedUpdate, toKey, parseKey, descriptionItems } from '../lib/calendarUtils';

const dayFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
const inputCls =
  'w-full bg-white dark:bg-[#202020] border border-gray-200 dark:border-[#3a3a3a] rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#5A5A40]/30 dark:text-white';

// Админ-панель: даты следующих обновлений и описание того, что будет добавлено. Показывается всем в календаре.
export function PlannedUpdatesAdmin() {
  const [plans, setPlans] = useState<PlannedUpdate[]>([]);
  const [date, setDate] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => plannedUpdates.subscribe(setPlans, (e) => setError(`Не удалось загрузить календарь: ${e.message}`)), []);

  const reset = () => {
    setEditingId(null);
    setDate('');
    setTitle('');
    setDescription('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setSaving(true);
    try {
      if (editingId) await plannedUpdates.update(editingId, { date, title, description });
      else await plannedUpdates.add({ date, title, description });
      setNotice(editingId ? 'Изменения сохранены' : 'Обновление добавлено в календарь');
      reset();
    } catch (err: any) {
      setError(err?.message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (p: PlannedUpdate) => {
    setEditingId(p.id);
    setDate(p.date);
    setTitle(p.title);
    setDescription(p.description);
    setError('');
    setNotice('');
  };

  const remove = async (p: PlannedUpdate) => {
    if (!window.confirm(`Удалить из календаря «${p.title}»?`)) return;
    try {
      await plannedUpdates.remove(p.id);
      if (editingId === p.id) reset();
    } catch (err: any) {
      setError(err?.message || 'Не удалось удалить');
    }
  };

  const today = toKey(new Date());

  return (
    <div className="p-4 bg-gray-50/70 dark:bg-[#181818]/60 border border-gray-100 dark:border-[#2a2a2a] rounded-2xl space-y-4">
      <div className="flex items-center gap-2">
        <CalendarDays className="w-4 h-4 text-indigo-500" />
        <h4 className="text-sm font-semibold dark:text-white">Календарь следующих обновлений</h4>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Укажите дату и что будет добавлено. Пользователи увидят это в Настройки → Обновления.
      </p>

      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="sm:col-span-1">
            <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">Дата</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">Название обновления</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="Например: Баннеры профиля и календарь"
              required
              className={inputCls}
            />
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
            Что будет добавлено (каждый пункт с новой строки)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={4}
            placeholder={'Анимированные баннеры\nОтветы на сообщения\nНовое меню сообщений'}
            className={`${inputCls} resize-y`}
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-[#5A5A40] dark:bg-[#A0A080] text-white dark:text-gray-900 rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity flex items-center gap-1.5 disabled:opacity-60"
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : editingId ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            <span>{editingId ? 'Сохранить' : 'Добавить в календарь'}</span>
          </button>
          {editingId && (
            <button
              type="button"
              onClick={reset}
              className="px-3 py-2 rounded-xl text-xs font-medium border border-gray-200 dark:border-[#3a3a3a] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#252525] flex items-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" />
              Отмена
            </button>
          )}
        </div>
        {error && <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>}
        {notice && <p className="text-[11px] text-emerald-600 dark:text-emerald-400">{notice}</p>}
      </form>

      <div className="space-y-2">
        <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">В календаре: {plans.length}</p>
        {plans.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-gray-500">Пока ничего не запланировано.</p>
        ) : (
          plans.map((p) => (
            <div
              key={p.id}
              className="flex items-start justify-between gap-3 p-3 rounded-xl bg-white dark:bg-[#202020] border border-gray-100 dark:border-[#2e2e2e]"
            >
              <div className="min-w-0">
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  {dayFmt.format(parseKey(p.date))}
                  {p.date < today && <span className="ml-2 text-gray-400">прошло</span>}
                </p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{p.title}</p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                  {descriptionItems(p.description).length} {descriptionItems(p.description).length === 1 ? 'пункт' : 'пунктов'}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => startEdit(p)}
                  aria-label="Изменить"
                  className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-500"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(p)}
                  aria-label="Удалить"
                  className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
