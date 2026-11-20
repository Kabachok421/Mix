// Подключение движка прямой передачи к Firestore: документы chats/{чат}/transfers/{id} служат только для установки соединения.
import { collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { getIceServers } from '../lib/iceServers';
import { createP2PEngine, type SignalingBackend, type TransferDoc } from './p2pEngine';

const ref = (chatId: string, id: string) => doc(db, 'chats', chatId, 'transfers', id);

const toDoc = (id: string, d: any): TransferDoc => ({
  id,
  messageId: String(d.messageId || ''),
  senderId: String(d.senderId || ''),
  receiverId: String(d.receiverId || ''),
  offer: String(d.offer || ''),
  answer: typeof d.answer === 'string' ? d.answer : undefined,
  status: d.status,
  offset: typeof d.offset === 'number' ? d.offset : undefined,
  reason: typeof d.reason === 'string' ? d.reason : undefined,
  createdAtMs: d.createdAt?.toMillis ? d.createdAt.toMillis() : undefined,
});

const clean = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

const backend: SignalingBackend = {
  create: (chatId, id, data) => setDoc(ref(chatId, id), { ...clean(data), createdAt: serverTimestamp() }),
  answer: (chatId, id, patch) => updateDoc(ref(chatId, id), clean(patch)),
  remove: (chatId, id) => deleteDoc(ref(chatId, id)),
  watchDoc(chatId, id, cb) {
    return onSnapshot(
      ref(chatId, id),
      (snap) => cb(snap.exists() ? toDoc(snap.id, snap.data()) : null),
      (err) => console.warn('transfer watch error:', err)
    );
  },
  watchRequests(chatId, senderId, cb) {
    return onSnapshot(
      query(collection(db, 'chats', chatId, 'transfers'), where('senderId', '==', senderId)),
      (snap) => cb(snap.docs.map((d) => toDoc(d.id, d.data()))),
      (err) => console.warn('transfer requests watch error:', err)
    );
  },
};

export const p2p = createP2PEngine({
  backend,
  getUserId: () => auth.currentUser?.uid ?? null,
  getIceServers,
});
