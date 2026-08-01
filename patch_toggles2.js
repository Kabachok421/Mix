import fs from 'fs';
let code = fs.readFileSync('src/components/SetupProfile.tsx', 'utf8');

const regex3 = /<div\s+ref=\{smallSliderRef\}[\s\S]*?<\/div>\s*<AnimatePresence>/;
const regex4 = /<div\s+ref=\{fullSliderRef\}[\s\S]*?<\/div>\s*<AnimatePresence>/;

const replacementSmallName = `<button
                type="button"
                onClick={() => setHideName(!hideName)}
                className={cn(
                  "relative w-full h-12 rounded-full p-1 transition-colors duration-500 flex items-center cursor-pointer",
                  hideName ? "bg-[#1a1a1a] dark:bg-white" : "bg-gray-200 dark:bg-[#333]"
                )}
              >
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-4 z-0">
                   <motion.span 
                     key={hideName ? 'hidden' : 'visible'}
                     initial={{ opacity: 0, scale: 0.9 }}
                     animate={{ opacity: 1, scale: 1 }}
                     transition={{ duration: 0.3 }}
                     className={cn(
                       "text-xs font-medium absolute",
                       hideName ? "text-white dark:text-black" : "text-gray-500 dark:text-gray-400"
                     )}
                   >
                     {hideName ? "Реальное имя скрыто" : "Отображать реальное имя"}
                   </motion.span>
                 </div>
                 
                 <motion.div
                   layout
                   transition={{ type: "spring", stiffness: 500, damping: 30 }}
                   className={cn(
                     "h-10 w-10 rounded-full shadow-md flex items-center justify-center z-10",
                     hideName ? "bg-[#333] dark:bg-black ml-auto" : "bg-white dark:bg-black ml-0"
                   )}
                 >
                   <motion.div
                     initial={false}
                     animate={{ rotate: hideName ? 360 : 0, scale: hideName ? 1.1 : 1 }}
                     transition={{ duration: 0.4 }}
                   >
                     {hideName ? <EyeOff className="w-4 h-4 text-white" /> : <Eye className="w-4 h-4 text-gray-500" />}
                   </motion.div>
                 </motion.div>
              </button>

              <AnimatePresence>`;

const replacementFullName = `<button
                type="button"
                onClick={() => setHideName(!hideName)}
                className={cn(
                  "relative w-full h-14 rounded-full p-1.5 transition-colors duration-500 flex items-center cursor-pointer",
                  hideName ? "bg-[#1a1a1a] dark:bg-white" : "bg-gray-200 dark:bg-[#333]"
                )}
              >
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-4 z-0">
                   <motion.span 
                     key={hideName ? 'hidden' : 'visible'}
                     initial={{ opacity: 0, scale: 0.9 }}
                     animate={{ opacity: 1, scale: 1 }}
                     transition={{ duration: 0.3 }}
                     className={cn(
                       "text-sm font-medium absolute",
                       hideName ? "text-white dark:text-black" : "text-gray-500 dark:text-gray-400"
                     )}
                   >
                     {hideName ? "Реальное имя скрыто" : "Отображать реальное имя"}
                   </motion.span>
                 </div>
                 
                 <motion.div
                   layout
                   transition={{ type: "spring", stiffness: 500, damping: 30 }}
                   className={cn(
                     "h-11 w-11 rounded-full shadow-md flex items-center justify-center z-10",
                     hideName ? "bg-[#333] dark:bg-black ml-auto" : "bg-white dark:bg-black ml-0"
                   )}
                 >
                   <motion.div
                     initial={false}
                     animate={{ rotate: hideName ? 360 : 0, scale: hideName ? 1.1 : 1 }}
                     transition={{ duration: 0.4 }}
                   >
                     {hideName ? <EyeOff className="w-5 h-5 text-white" /> : <Eye className="w-5 h-5 text-gray-500" />}
                   </motion.div>
                 </motion.div>
              </button>

              <AnimatePresence>`;

code = code.replace(regex3, replacementSmallName);
code = code.replace(regex4, replacementFullName);

fs.writeFileSync('src/components/SetupProfile.tsx', code);
