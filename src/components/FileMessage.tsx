import React from 'react';
import { File, Download, Image as ImageIcon } from 'lucide-react';

interface FileMessageProps {
  type: 'image' | 'file';
  url: string;
  fileName?: string;
  fileSize?: number;
  isMe: boolean;
}

export function FileMessage({ type, url, fileName, fileSize, isMe }: FileMessageProps) {
  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (type === 'image') {
    return (
      <div className="max-w-full rounded-lg overflow-hidden cursor-pointer" onClick={() => window.open(url, '_blank')}>
        <img src={url} alt={fileName || 'Image'} className="max-h-60 object-contain w-full hover:opacity-95 transition-opacity" />
      </div>
    );
  }

  return (
    <a 
      href={url} 
      target="_blank" 
      rel="noopener noreferrer"
      className={`flex items-center gap-3 p-2 rounded-xl transition-colors ${
        isMe ? 'hover:bg-white/10' : 'hover:bg-gray-100 dark:hover:bg-white/5'
      }`}
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
        isMe ? 'bg-white/20' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-500'
      }`}>
        <File className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium truncate ${isMe ? 'text-white' : 'text-gray-800 dark:text-gray-200'}`}>
          {fileName || 'Файл'}
        </div>
        <div className={`text-[10px] ${isMe ? 'text-white/70' : 'text-gray-400'}`}>
          {formatSize(fileSize)}
        </div>
      </div>
      <Download className={`w-4 h-4 ${isMe ? 'text-white/70' : 'text-gray-400'}`} />
    </a>
  );
}
