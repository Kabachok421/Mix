import { motion } from 'motion/react';

export default function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 p-3 px-4 bg-gray-100 dark:bg-[#222] rounded-[24px] rounded-tl-sm w-fit max-w-[85%] border border-gray-200 dark:border-[#333]">
      <motion.div
        className="w-2 h-2 rounded-full bg-[#5A5A40] dark:bg-[#A0A080]"
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0 }}
      />
      <motion.div
        className="w-2 h-2 rounded-full bg-[#5A5A40] dark:bg-[#A0A080]"
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
      />
      <motion.div
        className="w-2 h-2 rounded-full bg-[#5A5A40] dark:bg-[#A0A080]"
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
      />
    </div>
  );
}
