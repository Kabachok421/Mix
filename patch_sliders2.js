import fs from 'fs';
let code = fs.readFileSync('src/components/SetupProfile.tsx', 'utf8');

// We'll replace the full div block for both smallSliderRef and fullSliderRef

code = code.replace(
  /<div\s+ref=\{smallSliderRef\}[\s\S]*?<\/div>\s*<AnimatePresence>/,
  `<div 
              ref={smallSliderRef}
              className={cn(
                "relative h-12 w-full rounded-xl p-1 overflow-hidden transition-colors duration-500 flex items-center",
                hideName ? "bg-[#1a1a1a] dark:bg-white justify-end" : "bg-gray-100 dark:bg-[#333] justify-start"
              )}
            >
               <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-4">
                 <span className={cn("text-xs font-medium transition-colors duration-500", hideName ? "text-white dark:text-black" : "text-gray-500 dark:text-gray-400")}>
                   {hideName ? "Реальное имя скрыто" : "Потяните чтобы скрыть имя"}
                 </span>
               </div>
               
               <motion.div
                 layout
                 transition={{ type: "spring", stiffness: 400, damping: 30 }}
                 drag="x"
                 dragConstraints={{ left: 0, right: 0 }}
                 dragElastic={0.4}
                 onDragEnd={(e, info) => {
                   const width = smallSliderRef.current?.offsetWidth || 200;
                   if (info.offset.x > width * 0.4 && !hideName) {
                     setHideName(true);
                   } else if (info.offset.x < -width * 0.4 && hideName) {
                     setHideName(false);
                   }
                 }}
                 className="h-full w-12 rounded-[10px] bg-white dark:bg-black shadow flex items-center justify-center cursor-grab active:cursor-grabbing z-10 relative pointer-events-auto"
               >
                 <motion.div animate={{ rotate: hideName ? 180 : 0 }} className="flex items-center text-gray-800 dark:text-gray-200">
                    <GripVertical className="w-3 h-3 opacity-30" />
                    {hideName ? <EyeOff className="w-4 h-4 ml-[-2px]" /> : <Eye className="w-4 h-4 ml-[-2px]" />}
                 </motion.div>
               </motion.div>
            </div>

            <AnimatePresence>`
);

fs.writeFileSync('src/components/SetupProfile.tsx', code);
