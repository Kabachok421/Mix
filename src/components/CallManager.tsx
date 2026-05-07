import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { callService } from '../services/callService';
import { Call } from '../types';
import { Phone, PhoneOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CallScreen } from './CallScreen';

export function CallManager() {
  const { user } = useAuth();
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [activeCall, setActiveCall] = useState<{ id: string; isCaller: boolean } | null>(null);
  
  useEffect(() => {
    if (!user) return;
    const unsubscribe = callService.subscribeToIncomingCalls(user.uid, (call) => {
      setIncomingCall(call);
    });

    const handleStartCall = (e: Event) => {
      const customEvent = e as CustomEvent;
      setActiveCall({ id: customEvent.detail.callId, isCaller: customEvent.detail.isCaller });
    };

    window.addEventListener('START_CALL', handleStartCall);

    return () => {
      unsubscribe();
      window.removeEventListener('START_CALL', handleStartCall);
    };
  }, [user]);

  if (!user) return null;

  return (
    <>
      <AnimatePresence>
        {incomingCall && !activeCall && (
          <IncomingCallDialog call={incomingCall} onClose={() => setIncomingCall(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeCall && (
          <CallScreen 
            callId={activeCall.id} 
            isCaller={activeCall.isCaller} 
            onClose={() => setActiveCall(null)} 
          />
        )}
      </AnimatePresence>
    </>
  );
}

function IncomingCallDialog({ call, onClose }: { call: Call; onClose: () => void }) {
  const handleAccept = async () => {
    await callService.updateCallStatus(call.id, 'accepted');
    window.dispatchEvent(new CustomEvent('START_CALL', { detail: { callId: call.id, isCaller: false } }));
    onClose();
  };

  const handleReject = async () => {
    await callService.updateCallStatus(call.id, 'rejected');
    onClose();
  };

  return (
    <motion.div 
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -100, opacity: 0 }}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-[#1a1a1a] p-4 rounded-2xl shadow-2xl flex items-center gap-4 text-white"
    >
      <div className="flex-1">
        <h3 className="font-semibold text-sm">Входящий видеозвонок</h3>
      </div>
      <div className="flex gap-2">
        <button onClick={handleReject} className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center">
          <PhoneOff className="w-5 h-5 text-white" />
        </button>
        <button onClick={handleAccept} className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center shadow-[0_0_15px_rgba(34,197,94,0.5)] animate-pulse">
          <Phone className="w-5 h-5 text-white" />
        </button>
      </div>
    </motion.div>
  );
}
