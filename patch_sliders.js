import fs from 'fs';
let code = fs.readFileSync('src/components/SetupProfile.tsx', 'utf8');

// Fix for small slider
code = code.replace(
  /className=\{cn\(\s*"relative h-12 w-full rounded-2xl p-1\.5 overflow-hidden transition-colors duration-500 shadow-inner",\s*hideName \? "bg-\[#1a1a1a\] dark:bg-white" : "bg-gray-100 dark:bg-\[#222\]"\s*\)\}\s*>/,
  `className={cn(
                "relative h-12 w-full rounded-2xl p-1.5 overflow-hidden transition-colors duration-500 shadow-inner flex items-center",
                hideName ? "bg-[#1a1a1a] dark:bg-white justify-end" : "bg-gray-100 dark:bg-[#222] justify-start"
              )}
            >`
);

code = code.replace(
  /layout\s*drag="x"\s*dragConstraints=\{\{ left: 0, right: 0 \}\}\s*dragElastic=\{0\.4\}\s*onDragEnd=\{\(e, info\) => \{[\s\S]*?\}\}\s*className=\{cn\(\s*"h-full w-12 rounded-\[10px\] bg-white dark:bg-black shadow flex items-center justify-center cursor-grab active:cursor-grabbing z-10 relative pointer-events-auto",\s*hideName \? "ml-auto" : "ml-0"\s*\)\}/,
  `layout
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
                 className="h-full w-12 rounded-[10px] bg-white dark:bg-black shadow flex items-center justify-center cursor-grab active:cursor-grabbing z-10 relative pointer-events-auto"`
);

// Fix for full slider
code = code.replace(
  /className=\{cn\(\s*"relative h-14 w-full rounded-2xl p-1\.5 overflow-hidden transition-colors duration-500 shadow-inner",\s*hideName \? "bg-\[#1a1a1a\] dark:bg-white" : "bg-gray-100 dark:bg-\[#222\]"\s*\)\}\s*>/,
  `className={cn(
                "relative h-14 w-full rounded-2xl p-1.5 overflow-hidden transition-colors duration-500 shadow-inner flex items-center",
                hideName ? "bg-[#1a1a1a] dark:bg-white justify-end" : "bg-gray-100 dark:bg-[#222] justify-start"
              )}
            >`
);

code = code.replace(
  /layout\s*drag="x"\s*dragConstraints=\{\{ left: 0, right: 0 \}\}\s*dragElastic=\{0\.4\}\s*onDragEnd=\{\(e, info\) => \{[\s\S]*?\}\}\s*className=\{cn\(\s*"h-full w-14 rounded-xl bg-white dark:bg-black shadow-md flex items-center justify-center cursor-grab active:cursor-grabbing z-10 relative pointer-events-auto",\s*hideName \? "ml-auto" : "ml-0"\s*\)\}/,
  `layout
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
                 className="h-full w-14 rounded-xl bg-white dark:bg-black shadow-md flex items-center justify-center cursor-grab active:cursor-grabbing z-10 relative pointer-events-auto"`
);

fs.writeFileSync('src/components/SetupProfile.tsx', code);
