import { useState, useRef, useCallback } from 'react';

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Ваш браузер блокирует доступ к микрофону внутри iframe. Пожалуйста, откройте приложение в новой вкладке (кнопка справа вверху).");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.warn('Error accessing microphone:', err);
      // @ts-ignore
      alert(`Микрофон недоступен: ${err.name || err.message || err}. Убедитесь, что вы разрешили доступ к микрофону, или откройте приложение в новой вкладке.`);
    }
  }, []);

  const stopRecording = useCallback((): Promise<{ blob: Blob, duration: number } | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        resolve(null);
        return;
      }

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const finalDuration = duration;
        
        // Stop all tracks in the stream
        mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
        
        setIsRecording(false);
        setDuration(0);
        if (timerRef.current) clearInterval(timerRef.current);
        
        resolve({ blob: audioBlob, duration: finalDuration });
      };

      mediaRecorderRef.current.stop();
    });
  }, [duration]);

  const cancelRecording = useCallback(() => {
    if (!mediaRecorderRef.current) return;
    
    mediaRecorderRef.current.onstop = null; // Ignore chunks
    mediaRecorderRef.current.stop();
    mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    
    setIsRecording(false);
    setDuration(0);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  return { isRecording, duration, startRecording, stopRecording, cancelRecording };
}
