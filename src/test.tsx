import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function TestModal() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  return (
    <div>
      <button onClick={() => setIsFullscreen(true)}>Open Modal</button>
      {createPortal(
        <AnimatePresence>
          {isFullscreen && (
            <motion.div
              key="modal"
              initial={{ opacity: 0 }}
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
              
              <motion.img 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                src="https://via.placeholder.com/400" 
                alt="test" 
                className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl cursor-default"
                onClick={(e) => e.stopPropagation()}
              />
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
