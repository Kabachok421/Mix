import React, { useEffect, useRef, useState } from 'react';
import { callService } from '../services/callService';
import { Call } from '../types';
import { Video, Phone, PhoneOff, MonitorUp, Mic, MicOff, VideoOff, Expand, Shrink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';

export function CallScreen({ callId, isCaller, onClose }: { callId: string; isCaller: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [callState, setCallState] = useState<Call | null>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    // WebRTC Setup
    const servers = {
      iceServers: [
        {
          urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
        },
      ],
      iceCandidatePoolSize: 10,
    };
    pc.current = new RTCPeerConnection(servers);

    let lStream: MediaStream;
    let rStream = new MediaStream();
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = rStream;
    setRemoteStream(rStream);

    const initCall = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Ваш браузер блокирует доступ к медиаустройствам внутри iframe. Пожалуйста, откройте приложение в новой вкладке (кнопка в правом верхнем углу).");
        }
        lStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(lStream);
        if (localVideoRef.current) localVideoRef.current.srcObject = lStream;

        lStream.getTracks().forEach((track) => {
          if (pc.current) pc.current.addTrack(track, lStream);
        });

        pc.current.ontrack = (event) => {
          event.streams[0].getTracks().forEach((track) => {
            rStream.addTrack(track);
          });
        };

        if (isCaller) {
          pc.current.onicecandidate = (event) => {
            if (event.candidate) {
              callService.addCandidate(callId, 'caller', event.candidate.toJSON());
            }
          };

          const offer = await pc.current.createOffer();
          await pc.current.setLocalDescription(offer);
          await callService.updateOffer(callId, { type: offer.type, sdp: offer.sdp });
        } else {
          pc.current.onicecandidate = (event) => {
            if (event.candidate) {
              callService.addCandidate(callId, 'receiver', event.candidate.toJSON());
            }
          };
        }
      } catch (e) {
        console.warn("Error accessing media devices", e);
        // @ts-ignore
        alert(`Не удалось получить доступ к камере или микрофону (${e.name || e.message || e}). Убедитесь, что вы предоставили разрешения, или откройте приложение в новой вкладке.`);
        endCall();
      }
    };

    initCall();

    const unsubscribe = callService.subscribeToCall(callId, async (callDoc) => {
      setCallState(callDoc);
      if (callDoc.status === 'ended') {
        endCall();
      }

      if (!isCaller && callDoc.offer && !pc.current?.currentRemoteDescription) {
        const offerDescription = new RTCSessionDescription(callDoc.offer);
        await pc.current?.setRemoteDescription(offerDescription);

        const answer = await pc.current?.createAnswer();
        await pc.current?.setLocalDescription(answer);
        await callService.updateAnswer(callId, { type: answer?.type, sdp: answer?.sdp });
      }

      if (isCaller && callDoc.answer && !pc.current?.currentRemoteDescription) {
        const answerDescription = new RTCSessionDescription(callDoc.answer);
        await pc.current?.setRemoteDescription(answerDescription);
      }
    });

    const role = isCaller ? 'receiver' : 'caller';
    const unsubCandidates = callService.subscribeToCandidates(callId, role, (candidate) => {
      const iceCandidate = new RTCIceCandidate(candidate);
      pc.current?.addIceCandidate(iceCandidate);
    });

    return () => {
      unsubscribe();
      unsubCandidates();
      pc.current?.close();
      lStream?.getTracks().forEach(t => t.stop());
    };
  }, [callId, isCaller]);

  const endCall = () => {
    callService.endCall(callId);
    localStream?.getTracks().forEach(t => t.stop());
    onClose();
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(t => t.enabled = !t.enabled);
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(t => t.enabled = !t.enabled);
      setIsVideoOff(!isVideoOff);
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        
        screenTrack.onended = () => {
          stopScreenShare();
        };

        const sender = pc.current?.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(screenTrack);
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        setIsScreenSharing(true);
      } catch (e) {
        console.warn("Screen sharing failed", e);
        alert("Не удалось получить доступ к трансляции экрана. Убедитесь, что вы предоставили разрешения, или откройте приложение в новой вкладке.");
      }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      const sender = pc.current?.getSenders().find(s => s.track?.kind === 'video');
      if (sender) {
        sender.replaceTrack(videoTrack);
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
      }
      setIsScreenSharing(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`fixed ${isFullscreen ? 'inset-0' : 'bottom-4 right-4 w-[360px] h-[480px] rounded-2xl'} bg-[#0a0a0a] z-50 overflow-hidden shadow-2xl border border-[#222] flex flex-col`}
    >
      <div className="relative flex-1 bg-black">
        <video 
          ref={remoteVideoRef} 
          autoPlay 
          playsInline 
          className="w-full h-full object-cover"
        />
        
        <div className="absolute top-4 right-4 w-24 h-36 bg-[#1a1a1a] rounded-xl overflow-hidden border-2 border-[#333] shadow-lg">
          <video 
            ref={localVideoRef} 
            autoPlay 
            playsInline 
            muted 
            className={`w-full h-full object-cover ${isScreenSharing ? '' : '-scale-x-100'}`}
          />
        </div>

        {callState?.status === 'calling' && isCaller && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <p className="text-white font-medium animate-pulse">Звонок...</p>
          </div>
        )}
      </div>

      <div className="h-20 bg-[#111] flex items-center justify-center gap-4 px-4 w-full">
        <button onClick={toggleMute} className={`p-3 rounded-full ${isMuted ? 'bg-red-500/20 text-red-500' : 'bg-[#333] text-white'} hover:bg-opacity-80 transition-colors`}>
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>
        <button onClick={toggleVideo} className={`p-3 rounded-full ${isVideoOff ? 'bg-red-500/20 text-red-500' : 'bg-[#333] text-white'} hover:bg-opacity-80 transition-colors`}>
          {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
        </button>
        <button onClick={toggleScreenShare} className={`p-3 rounded-full ${isScreenSharing ? 'bg-blue-500 text-white' : 'bg-[#333] text-white'} hover:bg-opacity-80 transition-colors`}>
          <MonitorUp className="w-5 h-5" />
        </button>
        <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-3 rounded-full bg-[#333] text-white hover:bg-opacity-80 transition-colors">
          {isFullscreen ? <Shrink className="w-5 h-5" /> : <Expand className="w-5 h-5" />}
        </button>
        <button onClick={endCall} className="p-3 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors">
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );
}
