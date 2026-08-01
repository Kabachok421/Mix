import fs from 'fs';
let code = fs.readFileSync('src/components/SetupProfile.tsx', 'utf8');

const replacement1 = `<div className="mb-4">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-orange-500" />
                Скрытый профиль
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-3">
                Вас нельзя будет найти через обычный поиск. Только по коду друга.
              </p>
              
              <button
                type="button"
                onClick={() => setIsHidden(!isHidden)}
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
                   transition={{ type: "spring", stiffness: 500, damping: 35 }}
                   className="h-full w-12 rounded-[10px] bg-white dark:bg-black shadow flex items-center justify-center z-10"
                 >
                   <motion.div
                     initial={false}
                     animate={{ rotate: isHidden ? 180 : 0 }}
                     transition={{ duration: 0.4 }}
                   >
                     {isHidden ? <EyeOff className="w-4 h-4 text-gray-800 dark:text-gray-200" /> : <Eye className="w-4 h-4 text-gray-800 dark:text-gray-200" />}
                   </motion.div>
                 </motion.div>
              </button>
            </div>`;

code = code.replace(
  /<div className="flex items-center justify-between mb-2">[\s\S]*?<\/button>\s*<\/div>/g,
  replacement1
);

fs.writeFileSync('src/components/SetupProfile.tsx', code);
