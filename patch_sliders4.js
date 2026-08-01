import fs from 'fs';
let code = fs.readFileSync('src/components/SetupProfile.tsx', 'utf8');

// We need to add refs for the hidden sliders
code = code.replace(
  /const smallSliderRef = useRef<HTMLDivElement>\(null\);\n\s*const fullSliderRef = useRef<HTMLDivElement>\(null\);/,
  `const smallSliderRef = useRef<HTMLDivElement>(null);\n  const fullSliderRef = useRef<HTMLDivElement>(null);\n  const smallHiddenSliderRef = useRef<HTMLDivElement>(null);\n  const fullHiddenSliderRef = useRef<HTMLDivElement>(null);`
);

const buttonRegex = /<button\s*type="button"\s*onClick=\{\(\) => setIsHidden\(!isHidden\)\}\s*className=\{cn\(\s*"relative w-full h-12 rounded-xl p-1 overflow-hidden transition-colors duration-500 flex items-center",\s*isHidden \? "bg-\[#1a1a1a\] dark:bg-white justify-end" : "bg-gray-100 dark:bg-\[#333\] justify-start"\s*\)\}\s*>\s*<div className="absolute inset-0 flex items-center justify-center pointer-events-none px-4">\s*<span className=\{cn\(\s*"text-xs font-medium transition-colors duration-500",\s*isHidden \? "text-white dark:text-black" : "text-gray-500 dark:text-gray-400"\s*\)\}>\s*\{isHidden \? "Профиль скрыт" : "Профиль открыт"\}\s*<\/span>\s*<\/div>\s*<motion\.div\s*layout\s*transition=\{\{ type: "spring", stiffness: 500, damping: 35 \}\}\s*className="h-full w-12 rounded-\[10px\] bg-white dark:bg-black shadow flex items-center justify-center z-10"\s*>\s*<motion\.div\s*initial=\{false\}\s*animate=\{\{ rotate: isHidden \? 180 : 0 \}\}\s*transition=\{\{ duration: 0\.4 \}\}\s*>\s*\{isHidden \? <EyeOff className="w-4 h-4 text-gray-800 dark:text-gray-200" \/> : <Eye className="w-4 h-4 text-gray-800 dark:text-gray-200" \/>\}\s*<\/motion\.div>\s*<\/motion\.div>\s*<\/button>/g;

const replacementSmall = `<div
                ref={smallHiddenSliderRef}
                className={cn(
                  "relative w-full h-12 rounded-xl p-1 overflow-hidden transition-colors duration-500 flex items-center",
                  isHidden ? "bg-[#1a1a1a] dark:bg-white justify-end" : "bg-gray-100 dark:bg-[#333] justify-start"
                )}
              >
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-4">
                   <span className={cn(
                     "text-xs font-medium transition-colors duration-500",
                     isHidden ? "text-white dark:text-black" : "text-gray-500 dark:text-gray-400"
                   )}>
                     {isHidden ? "Профиль скрыт" : "Профиль открыт"}
                   </span>
                 </div>
                 
                 <motion.div
                   layout
                   transition={{ type: "spring", stiffness: 400, damping: 30 }}
                   drag="x"
                   dragConstraints={{ left: 0, right: 0 }}
                   dragElastic={0.4}
                   dragSnapToOrigin={true}
                   animate={{ x: 0 }}
                   onDragEnd={(e, info) => {
                     const width = smallHiddenSliderRef.current?.offsetWidth || 200;
                     if (info.offset.x > width * 0.4 && !isHidden) {
                       setIsHidden(true);
                     } else if (info.offset.x < -width * 0.4 && isHidden) {
                       setIsHidden(false);
                     }
                   }}
                   className="h-full w-12 rounded-[10px] bg-white dark:bg-black shadow flex items-center justify-center cursor-grab active:cursor-grabbing z-10 relative pointer-events-auto"
                 >
                   <motion.div animate={{ rotate: isHidden ? 180 : 0 }} className="flex items-center text-gray-800 dark:text-gray-200">
                      <GripVertical className="w-3 h-3 opacity-30" />
                      {isHidden ? <ShieldAlert className="w-4 h-4 ml-[-2px] text-orange-500" /> : <ShieldAlert className="w-4 h-4 ml-[-2px]" />}
                   </motion.div>
                 </motion.div>
              </div>`;

const replacementFull = `<div
                ref={fullHiddenSliderRef}
                className={cn(
                  "relative w-full h-14 rounded-2xl p-1.5 overflow-hidden transition-colors duration-500 shadow-inner flex items-center",
                  isHidden ? "bg-[#1a1a1a] dark:bg-white justify-end" : "bg-gray-100 dark:bg-[#222] justify-start"
                )}
              >
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-4">
                   <span className={cn(
                     "text-sm font-medium transition-colors duration-500",
                     isHidden ? "text-[#f5f5f0] dark:text-[#1a1a1a]" : "text-gray-500 dark:text-gray-400"
                   )}>
                     {isHidden ? "Профиль скрыт" : "Профиль открыт"}
                   </span>
                 </div>
                 
                 <motion.div
                   layout
                   transition={{ type: "spring", stiffness: 400, damping: 30 }}
                   drag="x"
                   dragConstraints={{ left: 0, right: 0 }}
                   dragElastic={0.4}
                   dragSnapToOrigin={true}
                   animate={{ x: 0 }}
                   onDragEnd={(e, info) => {
                     const width = fullHiddenSliderRef.current?.offsetWidth || 200;
                     if (info.offset.x > width * 0.4 && !isHidden) {
                       setIsHidden(true);
                     } else if (info.offset.x < -width * 0.4 && isHidden) {
                       setIsHidden(false);
                     }
                   }}
                   className="h-full w-14 rounded-xl bg-white dark:bg-black shadow-md flex items-center justify-center cursor-grab active:cursor-grabbing z-10 relative pointer-events-auto"
                 >
                   <motion.div animate={{ rotate: isHidden ? 180 : 0 }} className="flex items-center text-gray-800 dark:text-gray-200">
                      <GripVertical className="w-4 h-4 opacity-30" />
                      {isHidden ? <ShieldAlert className="w-5 h-5 ml-[-2px] text-orange-500" /> : <ShieldAlert className="w-5 h-5 ml-[-2px]" />}
                   </motion.div>
                 </motion.div>
              </div>`;

let counter = 0;
code = code.replace(buttonRegex, () => {
  counter++;
  if (counter === 1) {
    return replacementSmall;
  } else {
    return replacementFull;
  }
});

console.log("Replaced", counter, "occurrences");
fs.writeFileSync('src/components/SetupProfile.tsx', code);
