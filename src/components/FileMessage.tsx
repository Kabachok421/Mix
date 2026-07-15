import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { File, Download, Image as ImageIcon, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FileMessageProps {
  type: 'image' | 'file';
  url: string;
  thumbnail?: string;
  fileName?: string;
  fileSize?: number;
  isMe: boolean;
}

export function FileMessage({ type, url, thumbnail, fileName, fileSize, isMe }: FileMessageProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (type === 'image') {
    const isGoFile = url?.includes('gofile.io');
    
    if (isGoFile && !thumbnail) {
      return (
        <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 underline hover:opacity-80">
          <ImageIcon className="w-4 h-4" />
          <span>{fileName || 'Фотография (GoFile)'}</span>
        </a>
      );
    }

    const imageSrc = isGoFile ? thumbnail : (url || thumbnail);

    return (
      <>
        <div className="max-w-full rounded-lg overflow-hidden cursor-pointer" onClick={() => setIsFullscreen(true)}>
          <img src={imageSrc} alt={fileName || 'Image'} className="max-h-60 object-contain w-full hover:opacity-95 transition-opacity bg-black/10 dark:bg-white/5" />
        </div>

        {createPortal(
          <AnimatePresence>
            {isFullscreen && (
              <motion.div key="modal" initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsFullscreen(false)}
                className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm cursor-zoom-out"
              >
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsFullscreen(false); }}
                  className="absolute top-4 right-4 p-2 text-white/50 hover:text-white bg-black/20 hover:bg-black/40 rounded-full transition-colors z-[201]"
                >
                  <X className="w-6 h-6" />
                </button>
                
                {imageSrc ? (
                  <motion.img 
                    initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  src={imageSrc} 
                  alt={fileName || 'Image fullscreen'} 
                  className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl cursor-default"
                  onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <div className="text-white p-4 bg-black/50 rounded-lg">Изображение недоступно</div>
                )}
                
                <a href={url || '#'} target="_blank" rel="noopener noreferrer" download={fileName || 'download'}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute bottom-6 right-6 flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-colors z-[201]"
                >
                  <Download className="w-4 h-4" />
                  <span className="text-sm font-medium">Скачать</span>
                </a>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
      </>
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
