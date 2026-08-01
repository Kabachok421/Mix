import fs from 'fs';
let code = fs.readFileSync('src/components/UserSearch.tsx', 'utf8');

// add useEffect import
code = code.replace(/import React, \{ useState \} from 'react';/, "import React, { useState, useEffect, useRef } from 'react';");

// add Check import
code = code.replace(/import \{ Search, UserPlus, X \} from 'lucide-react';/, "import { Search, UserPlus, X, Check } from 'lucide-react';");
code = code.replace(/import \{ Chat \} from '\.\.\/types';/, "");
code = code.replace(/import \{ UserProfile \} from '\.\.\/types';/, "import { UserProfile, Chat } from '../types';");

// add chats fetching inside UserSearch
const myChatsRegex = /const \[loading, setLoading\] = useState\(false\);/;
const myChatsState = `const [loading, setLoading] = useState(false);
  const [myChats, setMyChats] = useState<Chat[]>([]);
  const [showResults, setShowResults] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = chatService.subscribeToChats(user.uid, (chats) => {
      setMyChats(chats);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
`;
code = code.replace(myChatsRegex, myChatsState);

// update handleSearch
const handleSearchRegex = /setResults\(users \|\| \[\]\);/;
code = code.replace(handleSearchRegex, "setResults(users || []);\n      setShowResults(true);");

// update clear button
const clearBtnRegex = /onClick=\{\(\) => \{ setSearchTerm\(''\); setResults\(\[\]\); \}\}/;
code = code.replace(clearBtnRegex, "onClick={() => { setSearchTerm(''); setShowResults(false); setTimeout(() => setResults([]), 500); }}");

// update input onChange
const onChangeRegex = /onChange=\{\(e\) => setSearchTerm\(e\.target\.value\)\}/;
code = code.replace(onChangeRegex, "onChange={(e) => { setSearchTerm(e.target.value); if (e.target.value.trim().length > 0) setShowResults(true); else setShowResults(false); }}");

// add focus handler
const inputRegex = /className="w-full bg-gray-100/;
code = code.replace(inputRegex, "onFocus={() => { if (results.length > 0) setShowResults(true); }}\n          className=\"w-full bg-gray-100");

// replace container div to use ref
code = code.replace(/<div className="p-4 border-b border-gray-100 dark:border-\[#222\]">/, '<div ref={searchContainerRef} className="p-4 border-b border-gray-100 dark:border-[#222]">');

// change animation rendering
const renderRegex = /\{results\.length > 0 && \([\s\S]*?<\/AnimatePresence>/;
const newRender = `{showResults && results.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, transition: { staggerChildren: 0.05, staggerDirection: -1, delay: 0.2 } }}
            className="mt-4 bg-white dark:bg-[#1a1a1a] rounded-2xl border border-[#e5e5e0] dark:border-[#333] shadow-2xl overflow-hidden absolute z-50 left-4 right-4"
          >
            {results.map((u, index) => {
              const isFriend = myChats.some(chat => chat.participantIds.includes(u.uid));
              return (
              <motion.button
                key={u.uid}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0, transition: { delay: index * 0.05 } }}
                exit={{ opacity: 0, x: 50, transition: { duration: 0.3 } }}
                onClick={() => handleStartChat(u.uid)}
                className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-[#222] transition-colors border-b last:border-0 border-gray-50 dark:border-[#222]"
              >
                <div className="flex items-center gap-3">
                  <Avatar src={u.photoURL} className="w-8 h-8" />
                  <div className="text-left">
                    <div className="text-sm font-medium dark:text-white"><UserName user={u} /></div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">@{u.username || 'unknown'}</div>
                  </div>
                </div>
                {isFriend ? (
                  <div className="p-1 rounded-full bg-green-500/10 text-green-500">
                    <Check className="w-4 h-4" />
                  </div>
                ) : (
                  <UserPlus className="w-4 h-4 text-[#5A5A40] dark:text-[#A0A080]" />
                )}
              </motion.button>
            )})}
          </motion.div>
        )}
      </AnimatePresence>`;
code = code.replace(renderRegex, newRender);

fs.writeFileSync('src/components/UserSearch.tsx', code);
