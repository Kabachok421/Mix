import React from 'react';
import { motion } from 'motion/react';

interface AudioWaveformProps {
  isPlaying: boolean;
  progress: number;
}

export function AudioWaveform({ isPlaying, progress }: AudioWaveformProps) {
  // Generate random heights for the bars to simulate a waveform
  const bars = [4, 7, 10, 8, 12, 15, 10, 8, 6, 8, 11, 14, 18, 15, 10, 7, 5, 8, 12, 10, 8, 6, 4];

  return (
    <div className="flex items-center gap-0.5 h-6">
      {bars.map((height, i) => {
        const barProgress = (i / bars.length) * 100;
        const isActive = progress >= barProgress;

        return (
          <motion.div
            key={i}
            initial={{ height: `${height}px` }}
            animate={isPlaying ? {
              height: [`${height}px`, `${height * 1.5}px`, `${height}px`]
            } : {
              height: `${height}px`
            }}
            transition={isPlaying ? {
              duration: 0.5 + Math.random() * 0.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.1
            } : {}}
            className={`w-[2px] rounded-full transition-colors duration-300 ${
              isActive ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          />
        );
      })}
    </div>
  );
}
