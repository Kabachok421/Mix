import fs from 'fs';
let code = fs.readFileSync('src/components/SetupProfile.tsx', 'utf8');

code = code.replace(
  /<div\s+ref=\{fullSliderRef\}[\s\S]*?<\/div>\s*<AnimatePresence>/,
  `<div 
              ref={fullSliderRef}
              className={cn(
                "relative h-14 w-full rounded-2xl p-1.5 overflow-hidden transition-colors duration-500 shadow-inner flex items-center",
                hideName ? "bg-[#1a1a1a] dark:bg-white justify-end" : "bg-gray-100 dark:bg-[#222] justify-start"
              )}
            >
               <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-4">
                 <span className={cn("text-sm font-medium transition-colors duration-500", hideName ? "text-[#f5f5f0] dark:text-[#1a1a1a]" : "text-gray-500 dark:text-gray-400")}>
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
                   const width = fullSliderRef.current?.offsetWidth || 200;
                   if (info.offset.x > width * 0.4 && !hideName) {
                     setHideName(true);
                   } else if (info.offset.x < -width * 0.4 && hideName) {
                     setHideName(false);
                   }
                 }}
                 className="h-full w-14 rounded-xl bg-white dark:bg-black shadow-md flex items-center justify-center cursor-grab active:cursor-grabbing z-10 relative pointer-events-auto"
               >
                 <motion.div animate={{ rotate: hideName ? 180 : 0 }} className="flex items-center text-gray-800 dark:text-gray-200">
                    <GripVertical className="w-4 h-4 opacity-30" />
                    {hideName ? <EyeOff className="w-5 h-5 ml-[-2px]" /> : <Eye className="w-5 h-5 ml-[-2px]" />}
                 </motion.div>
               </motion.div>
            </div>

            <AnimatePresence>`
);

fs.writeFileSync('src/components/SetupProfile.tsx', code);
