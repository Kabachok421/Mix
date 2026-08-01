import fs from 'fs';
let code = fs.readFileSync('src/components/ChatWindow.tsx', 'utf8');

code = code.replace(/import \{ Send, Smile, Paperclip, MoreVertical, MessageSquare, Trash2, ChevronLeft, Mic, X, Image as ImageIcon, File as FileIcon, Loader2, Video \} from 'lucide-react';/, "import { Send, Smile, Paperclip, MoreVertical, MessageSquare, Trash2, ChevronLeft, Mic, X, Image as ImageIcon, File as FileIcon, Loader2, Video, Cloud, Share2 } from 'lucide-react';");

const oldMenu = `<motion.div
                      initial={{ opacity: 0, scale: 0.9, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 10 }}
                      transition={{ type: "spring", damping: 25, stiffness: 300 }}
                      className="absolute bottom-full mb-3 right-0 w-48 bg-gray-900 dark:bg-[#1a1a1a] rounded-2xl shadow-2xl border border-gray-800 dark:border-[#333] overflow-hidden z-40 origin-bottom-right"
                    >
                      <button 
                        type="button"
                        onClick={() => { imageInputRef.current?.click(); setShowAttachmentMenu(false); }}
                        className="w-full text-left px-4 py-3 text-sm text-white flex items-center gap-3 hover:bg-gray-800 dark:hover:bg-[#222] transition-colors"
                      >
                        <ImageIcon className="w-5 h-5 text-blue-400" />
                        <span className="font-medium">Фото или Видео</span>
                      </button>
                      <button 
                        type="button"
                        onClick={() => { fileInputRef.current?.click(); setShowAttachmentMenu(false); }}
                        className="w-full text-left px-4 py-3 text-sm text-white flex items-center gap-3 hover:bg-gray-800 dark:hover:bg-[#222] transition-colors"
                      >
                        <FileIcon className="w-5 h-5 text-purple-400" />
                        <span className="font-medium">Файл</span>
                      </button>
                    </motion.div>`;

const newMenu = `<motion.div
                      initial={{ opacity: 0, scale: 0.9, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 10 }}
                      transition={{ type: "spring", damping: 25, stiffness: 300 }}
                      className="absolute bottom-full mb-3 right-0 w-56 bg-gray-900 dark:bg-[#1a1a1a] rounded-2xl shadow-2xl border border-gray-800 dark:border-[#333] overflow-hidden z-40 origin-bottom-right"
                    >
                      <button 
                        type="button"
                        onClick={() => { imageInputRef.current?.click(); setShowAttachmentMenu(false); }}
                        className="w-full text-left px-4 py-3 text-sm text-white flex items-center gap-3 hover:bg-gray-800 dark:hover:bg-[#222] transition-colors border-b border-gray-800 dark:border-[#222]"
                      >
                        <ImageIcon className="w-5 h-5 text-blue-400" />
                        <span className="font-medium">Фото или Видео</span>
                      </button>
                      <button 
                        type="button"
                        onClick={() => { fileInputRef.current?.click(); setShowAttachmentMenu(false); }}
                        className="w-full text-left px-4 py-3 text-sm text-white flex items-center gap-3 hover:bg-gray-800 dark:hover:bg-[#222] transition-colors border-b border-gray-800 dark:border-[#222]"
                      >
                        <Cloud className="w-5 h-5 text-purple-400" />
                        <div className="flex flex-col">
                           <span className="font-medium">Файл (Облако)</span>
                           <span className="text-[10px] text-gray-400">Надежно через сервер</span>
                        </div>
                      </button>
                      <button 
                        type="button"
                        disabled={true}
                        className="w-full text-left px-4 py-3 text-sm text-white flex items-center gap-3 transition-colors opacity-50 cursor-not-allowed"
                      >
                        <Share2 className="w-5 h-5 text-green-400" />
                        <div className="flex flex-col">
                           <span className="font-medium">Файл (P2P)</span>
                           <span className="text-[10px] text-green-400/80">В разработке (будущие возможности)</span>
                        </div>
                      </button>
                    </motion.div>`;

code = code.replace(oldMenu, newMenu);
fs.writeFileSync('src/components/ChatWindow.tsx', code);
