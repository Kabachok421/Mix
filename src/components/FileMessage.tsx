import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { File, Download, Image as ImageIcon, X, FileText, Archive, Code, Music, Film } from 'lucide-react';
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

  const getFileDetails = (name?: string) => {
    if (!name) return { IconComponent: File, colorClass: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' };
    const ext = name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf':
        return { IconComponent: FileText, colorClass: 'text-rose-500 bg-rose-50 dark:bg-rose-900/20' };
      case 'doc':
      case 'docx':
      case 'txt':
      case 'rtf':
        return { IconComponent: FileText, colorClass: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' };
      case 'zip':
      case 'rar':
      case '7z':
      case 'tar':
      case 'gz':
        return { IconComponent: Archive, colorClass: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' };
      case 'js':
      case 'ts':
      case 'tsx':
      case 'jsx':
      case 'json':
      case 'html':
      case 'css':
      case 'py':
        return { IconComponent: Code, colorClass: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' };
      case 'mp3':
      case 'wav':
      case 'ogg':
      case 'm4a':
      case 'flac':
        return { IconComponent: Music, colorClass: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20' };
      case 'mp4':
      case 'webm':
      case 'mov':
      case 'avi':
      case 'mkv':
        return { IconComponent: Film, colorClass: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' };
      default:
        return { IconComponent: File, colorClass: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' };
    }
  };

  const [hasImageError, setHasImageError] = useState(false);

  if (type === 'image') {
    const isVideo = fileName?.match(/\.(mp4|webm|mov|ogg)$/i);
    if (isVideo) {
      return (
        <div className="max-w-full rounded-lg overflow-hidden bg-black/5 dark:bg-white/5">
          <video src={url} controls className="max-h-72 w-full rounded-lg object-contain" />
          {fileName && (
            <div className={`p-1.5 text-xs flex justify-between items-center ${isMe ? 'text-white/80' : 'text-gray-600 dark:text-gray-300'}`}>
              <span className="truncate max-w-[200px]">{fileName}</span>
              <span>{formatSize(fileSize)}</span>
            </div>
          )}
        </div>
      );
    }

    const imageSrc = url || thumbnail;

    if (hasImageError || !imageSrc) {
      const downloadUrl = url?.startsWith('/api/files/') ? `${url}?download=true` : url;
      return (
        <a 
          href={downloadUrl || '#'} 
          download={fileName || 'image.jpg'} 
          target="_blank" 
          rel="noopener noreferrer"
          className={`flex items-center gap-3 p-2 rounded-xl transition-colors ${
            isMe ? 'hover:bg-white/10' : 'hover:bg-gray-100 dark:hover:bg-white/5'
          }`}
        >
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
            isMe ? 'bg-white/20' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-500'
          }`}>
            <ImageIcon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className={`text-sm font-medium truncate ${isMe ? 'text-white' : 'text-gray-800 dark:text-gray-200'}`}>
              {fileName || 'Изображение'}
            </div>
            <div className={`text-[10px] ${isMe ? 'text-white/70' : 'text-gray-400'}`}>
              {formatSize(fileSize)}
            </div>
          </div>
          <Download className={`w-4 h-4 shrink-0 ${isMe ? 'text-white/70' : 'text-gray-400'}`} />
        </a>
      );
    }

    return (
      <>
        <div className="max-w-full rounded-lg overflow-hidden cursor-pointer" onClick={() => setIsFullscreen(true)}>
          <img 
            src={imageSrc} 
            alt={fileName || 'Image'} 
            onError={() => setHasImageError(true)}
            className="max-h-60 object-contain w-full hover:opacity-95 transition-opacity bg-black/10 dark:bg-white/5 rounded-lg" 
          />
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
                
                <a 
                  href={url?.startsWith('/api/files/') ? `${url}?download=true&downloadName=${encodeURIComponent(fileName || 'image.jpg')}` : (url || '#')} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  download={fileName || 'image.jpg'}
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

  const downloadUrl = url?.startsWith('/api/files/') 
    ? `${url}?download=true&downloadName=${encodeURIComponent(fileName || 'file')}` 
    : url;

  const { IconComponent, colorClass } = getFileDetails(fileName);

  return (
    <a 
      href={downloadUrl || '#'} 
      download={fileName || 'file'}
      target="_blank" 
      rel="noopener noreferrer"
      className={`flex items-center gap-3 p-2.5 rounded-2xl transition-colors ${
        isMe ? 'hover:bg-white/10' : 'hover:bg-gray-100 dark:hover:bg-white/5'
      }`}
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
        isMe ? 'bg-white/20 text-white' : colorClass
      }`}>
        <IconComponent className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-semibold truncate ${isMe ? 'text-white' : 'text-gray-900 dark:text-gray-100'}`}>
          {fileName || 'Файл'}
        </div>
        <div className={`text-[11px] ${isMe ? 'text-white/75' : 'text-gray-400'}`}>
          {formatSize(fileSize)}
        </div>
      </div>
      <Download className={`w-4 h-4 shrink-0 ${isMe ? 'text-white/70' : 'text-gray-400'}`} />
    </a>
  );
}
