import fs from 'fs';
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

const regexUserRow = /<div className="flex items-center justify-between">\s*<div className="flex items-center gap-3">/g;
const replacementUserRow = `<div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 flex-1 min-w-0">`;

code = code.replace(regexUserRow, replacementUserRow);

const regexActions = /<div className="flex flex-col items-end gap-2">/g;
const replacementActions = `<div className="flex flex-col items-end gap-2 shrink-0">`;

code = code.replace(regexActions, replacementActions);

// Also let's fix the banning user actions which might overflow
const regexBanning = /<div className="mt-4 pt-4 border-t border-gray-200 dark:border-\[#333\] flex items-center gap-2">/g;
const replacementBanning = `<div className="mt-4 pt-4 border-t border-gray-200 dark:border-[#333] flex flex-wrap items-center gap-2">`;
code = code.replace(regexBanning, replacementBanning);

// For new username input
const regexEditing = /<input\s*type="text"\s*value=\{newUsername\}\s*onChange=\{\(e\) => setNewUsername\(e\.target\.value\)\}\s*placeholder="Новый никнейм"\s*className="flex-1 bg-white dark:bg-black border border-gray-200 dark:border-\[#444\] rounded-lg px-3 py-1\.5 text-sm outline-none focus:ring-2 focus:ring-\[#5A5A40\]\/30 dark:text-white"\s*\/>/;
const replacementEditing = `<input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Новый никнейм"
                  className="flex-1 min-w-0 bg-white dark:bg-black border border-gray-200 dark:border-[#444] rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#5A5A40]/30 dark:text-white"
                />`;
code = code.replace(regexEditing, replacementEditing);

fs.writeFileSync('src/components/AdminPanel.tsx', code);
