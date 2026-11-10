// Календарь будущих обновлений: коллекция planned_updates.
// Читают все вошедшие пользователи, пишет только администратор (см. firestore.rules).

import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { PlannedUpdate, isValidDateKey, toKey } from '../lib/calendarUtils';

export type PlannedUpdateInput = { date: string; title: string; description: string };

function validate(input: PlannedUpdateInput): PlannedUpdateInput {
  const date = input.date.trim();
  const title = input.title.trim();
  const description = input.description.trim();
  if (!isValidDateKey(date)) throw new Error('Укажите дату обновления');
  if (!title) throw new Error('Укажите название обновления');
  if (title.length > 120) throw new Error('Название длиннее 120 символов');
  if (description.length > 2000) throw new Error('Описание длиннее 2000 символов');
  return { date, title, description };
}

export const plannedUpdates = {
  // Подписка на обновления календаря. Берём записи начиная с трёх месяцев назад, чтобы не читать всю историю.
  subscribe(callback: (items: PlannedUpdate[]) => void, onError?: (e: Error) => void): () => void {
    const now = new Date();
    const from = toKey(new Date(now.getFullYear(), now.getMonth() - 3, 1));
    const q = query(collection(db, 'planned_updates'), where('date', '>=', from), orderBy('date', 'asc'));
    return onSnapshot(
      q,
      (snap) => {
        callback(
          snap.docs.map((d) => {
            const x = d.data();
            return { id: d.id, date: String(x.date || ''), title: String(x.title || ''), description: String(x.description || '') };
          })
        );
      },
      (err) => {
        console.warn('Planned updates listener error:', err);
        onError?.(err);
      }
    );
  },

  async add(input: PlannedUpdateInput): Promise<void> {
    const v = validate(input);
    await addDoc(collection(db, 'planned_updates'), {
      ...v,
      createdBy: auth.currentUser?.uid || 'admin',
      createdAt: serverTimestamp(),
    });
  },

  async update(id: string, input: PlannedUpdateInput): Promise<void> {
    const v = validate(input);
    await updateDoc(doc(db, 'planned_updates', id), { ...v, updatedAt: serverTimestamp() });
  },

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(db, 'planned_updates', id));
  },
};
