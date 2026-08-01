import fs from 'fs';
let code = fs.readFileSync('src/components/SetupProfile.tsx', 'utf8');

const regex1 = /<div\s+ref=\{smallHiddenSliderRef\}[\s\S]*?<\/div>/;
const regex2 = /<div\s+ref=\{fullHiddenSliderRef\}[\s\S]*?<\/div>/;

const replacementSmall = `<button
                type="button"
                onClick={() => setIsHidden(!isHidden)}
                className={cn(
                  "relative w-full h-12 rounded-full p-1 transition-colors duration-500 flex items-center cursor-pointer",
                  isHidden ? "bg-[#1a1a1a] dark:bg-white" : "bg-gray-200 dark:bg-[#333]"
                )}
              >
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-4 z-0">
                   <motion.span 
                     key={isHidden ? 'hidden' : 'visible'}
                     initial={{ opacity: 0, scale: 0.9 }}
                     animate={{ opacity: 1, scale: 1 }}
                     transition={{ duration: 0.3 }}
                     className={cn(
                       "text-xs font-medium absolute",
                       isHidden ? "text-white dark:text-black" : "text-gray-500 dark:text-gray-400"
                     )}
                   >
                     {isHidden ? "Профиль скрыт" : "Профиль открыт"}
                   </motion.span>
                 </div>
                 
                 <motion.div
                   layout
                   transition={{ type: "spring", stiffness: 500, damping: 30 }}
                   className={cn(
                     "h-10 w-10 rounded-full shadow-md flex items-center justify-center z-10",
                     isHidden ? "bg-[#333] dark:bg-black ml-auto" : "bg-white dark:bg-black ml-0"
                   )}
                 >
                   <motion.div
                     initial={false}
                     animate={{ rotate: isHidden ? 360 : 0, scale: isHidden ? 1.1 : 1 }}
                     transition={{ duration: 0.4 }}
                   >
                     {isHidden ? <ShieldAlert className="w-4 h-4 text-orange-500" /> : <Eye className="w-4 h-4 text-gray-500" />}
                   </motion.div>
                 </motion.div>
              </button>`;

const replacementFull = `<button
                type="button"
                onClick={() => setIsHidden(!isHidden)}
                className={cn(
                  "relative w-full h-14 rounded-full p-1.5 transition-colors duration-500 flex items-center cursor-pointer",
                  isHidden ? "bg-[#1a1a1a] dark:bg-white" : "bg-gray-200 dark:bg-[#333]"
                )}
              >
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-4 z-0">
                   <motion.span 
                     key={isHidden ? 'hidden' : 'visible'}
                     initial={{ opacity: 0, scale: 0.9 }}
                     animate={{ opacity: 1, scale: 1 }}
                     transition={{ duration: 0.3 }}
                     className={cn(
                       "text-sm font-medium absolute",
                       isHidden ? "text-white dark:text-black" : "text-gray-500 dark:text-gray-400"
                     )}
                   >
                     {isHidden ? "Профиль скрыт" : "Профиль открыт"}
                   </motion.span>
                 </div>
                 
                 <motion.div
                   layout
                   transition={{ type: "spring", stiffness: 500, damping: 30 }}
                   className={cn(
                     "h-11 w-11 rounded-full shadow-md flex items-center justify-center z-10",
                     isHidden ? "bg-[#333] dark:bg-black ml-auto" : "bg-white dark:bg-black ml-0"
                   )}
                 >
                   <motion.div
                     initial={false}
                     animate={{ rotate: isHidden ? 360 : 0, scale: isHidden ? 1.1 : 1 }}
                     transition={{ duration: 0.4 }}
                   >
                     {isHidden ? <ShieldAlert className="w-5 h-5 text-orange-500" /> : <Eye className="w-5 h-5 text-gray-500" />}
                   </motion.div>
                 </motion.div>
              </button>`;

code = code.replace(regex1, replacementSmall);
code = code.replace(regex2, replacementFull);

fs.writeFileSync('src/components/SetupProfile.tsx', code);
