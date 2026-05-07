import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { AudioWaveform } from './AudioWaveform';
import { format } from 'date-fns';

interface VoiceMessageProps {
  url: string;
  duration?: number;
  isMe: boolean;
}

export function VoiceMessage({ url, duration, isMe }: VoiceMessageProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setProgress((audio.currentTime / audio.duration) * 100);
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3 py-1">
      <audio ref={audioRef} src={url} />
      
      <button
        onClick={togglePlay}
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
          isMe 
            ? 'bg-white/20 hover:bg-white/30 text-white' 
            : 'bg-blue-500 hover:bg-blue-600 text-white'
        }`}
      >
        {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
      </button>

      <div className="flex flex-col flex-1 min-w-[120px]">
        <AudioWaveform isPlaying={isPlaying} progress={progress} />
        <div className={`text-[10px] mt-1 ${isMe ? 'text-white/70' : 'text-gray-400'}`}>
          {isPlaying ? formatTime(currentTime) : (duration ? formatTime(duration) : '0:00')}
        </div>
      </div>
    </div>
  );
}
