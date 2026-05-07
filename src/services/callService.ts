import {
  collection,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  deleteDoc,
  getDocs
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Call } from '../types';

export const callService = {
  createCall: async (participantIds: string[], callerId: string) => {
    const callsRef = collection(db, 'calls');
    const docRef = await addDoc(callsRef, {
      participantIds,
      callerId,
      status: 'calling',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  },

  updateCallStatus: async (callId: string, status: Call['status']) => {
    const callRef = doc(db, 'calls', callId);
    await updateDoc(callRef, {
      status,
      updatedAt: serverTimestamp()
    });
  },

  updateOffer: async (callId: string, offer: any) => {
    const callRef = doc(db, 'calls', callId);
    await updateDoc(callRef, {
      offer,
      updatedAt: serverTimestamp()
    });
  },

  updateAnswer: async (callId: string, answer: any) => {
    const callRef = doc(db, 'calls', callId);
    await updateDoc(callRef, {
      answer,
      updatedAt: serverTimestamp()
    });
  },

  addCandidate: async (callId: string, role: 'caller' | 'receiver', candidate: any) => {
    const collectionName = role === 'caller' ? 'callerCandidates' : 'receiverCandidates';
    const candidatesRef = collection(db, 'calls', callId, collectionName);
    await addDoc(candidatesRef, candidate);
  },

  subscribeToIncomingCalls: (userId: string, callback: (call: Call | null) => void) => {
    const q = query(
      collection(db, 'calls'),
      where('participantIds', 'array-contains', userId),
      where('status', 'in', ['calling', 'ringing'])
    );

    return onSnapshot(q, (snapshot) => {
      // Find a call where the user is NOT the caller
      const callDoc = snapshot.docs.find(doc => doc.data().callerId !== userId);
      if (callDoc) {
        callback({ id: callDoc.id, ...callDoc.data() } as Call);
      } else {
        callback(null);
      }
    });
  },

  subscribeToCall: (callId: string, callback: (call: Call) => void) => {
    const callRef = doc(db, 'calls', callId);
    return onSnapshot(callRef, (doc) => {
      if (doc.exists()) {
        callback({ id: doc.id, ...doc.data() } as Call);
      }
    });
  },

  subscribeToCandidates: (callId: string, role: 'caller' | 'receiver', callback: (candidate: any) => void) => {
    const collectionName = role === 'caller' ? 'callerCandidates' : 'receiverCandidates';
    const candidatesRef = collection(db, 'calls', callId, collectionName);
    
    return onSnapshot(candidatesRef, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          callback(change.doc.data());
        }
      });
    });
  },
  
  endCall: async (callId: string) => {
    try {
      await callService.updateCallStatus(callId, 'ended');
      // Note: Typically you might want to clean up documents or ICE candidates here, 
      // but keeping it simple for the demo.
    } catch (e) {
      console.error('Error ending call', e);
    }
  }
};
