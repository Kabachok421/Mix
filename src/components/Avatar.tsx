import React, { useState } from 'react';
import { User } from 'lucide-react';
import { cn } from '../lib/utils';

export function Avatar({ src, alt, className }: { src: string | null | undefined, alt?: string, className?: string }) {
  const [error, setError] = useState(false);

  if (!src || error) {
    return (
      <div className={cn("rounded-full bg-gray-200 dark:bg-[#333] flex items-center justify-center text-gray-500 dark:text-gray-400 font-bold", className)}>
        <User className="w-1/2 h-1/2 opacity-50" />
      </div>
    );
  }

  return (
    <img 
      src={src} 
      alt={alt || ""} 
      className={cn("rounded-full object-cover", className)}
      onError={() => setError(true)}
      referrerPolicy="no-referrer"
    />
  );
}
