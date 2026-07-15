import fs from 'fs';
let code = fs.readFileSync('src/components/SetupProfile.tsx', 'utf8');

// Add state
if (!code.includes('const [isHidden')) {
  code = code.replace(
    /const \[customName, setCustomName\] = useState\(profile\?\.customName \|\| ''\);/,
    `const [customName, setCustomName] = useState(profile?.customName || '');\n  const [isHidden, setIsHidden] = useState(profile?.isHidden || false);\n  const friendCode = profile?.friendCode || 'загрузка...';`
  );
  
  // Add to dataToUpdate
  code = code.replace(
    /customName: hideName \? customName\.trim\(\) : '',/,
    `customName: hideName ? customName.trim() : '',\n        isHidden,`
  );
  
  // Need to import Copy icon
  if (!code.includes('Copy')) {
    code = code.replace(/import \{ User, Camera, Save, EyeOff, Eye, GripVertical \} from 'lucide-react';/,
      `import { User, Camera, Save, EyeOff, Eye, GripVertical, Copy, ShieldAlert } from 'lucide-react';`
    );
  }
  
  // Add toggle to fullPage (actually fullPage false is what is rendered in Settings, but let's add it to both, or make a helper)
  // Let's add it before the submit button in both
  const toggleHtml = `
          <div className="bg-gray-50 dark:bg-[#1a1a1a] rounded-xl p-4 border border-gray-200 dark:border-[#333]">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-orange-500" />
                  Скрытый профиль
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Вас нельзя будет найти через обычный поиск. Только по коду друга.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsHidden(!isHidden)}
                className={\`w-12 h-6 rounded-full transition-colors relative \${isHidden ? 'bg-[#5A5A40] dark:bg-[#A0A080]' : 'bg-gray-300 dark:bg-gray-600'}\`}
              >
                <div className={\`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform \${isHidden ? 'left-7' : 'left-1'}\`} />
              </button>
            </div>
            
            {isHidden && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-[#333]">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Ваш код друга:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white dark:bg-black px-3 py-2 rounded-lg text-center font-mono font-bold tracking-widest border border-gray-200 dark:border-[#444] dark:text-white">
                    {friendCode}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(friendCode);
                      alert('Код скопирован!');
                    }}
                    className="p-2 bg-white dark:bg-black rounded-lg border border-gray-200 dark:border-[#444] text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    <Copy className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
`;

  // We have two forms: one for fullPage false, one for fullPage true.
  code = code.replace(
    /(<button\s+type="submit"\s+disabled=\{saving\}\s+className="w-full bg-\[#1a1a1a\] dark:bg-white text-white dark:text-black rounded-lg)/,
    toggleHtml + '\n          $1'
  );
  
  code = code.replace(
    /(<button\s+type="submit"\s+disabled=\{saving\}\s+className="w-full bg-\[#1a1a1a\] dark:bg-white text-white dark:text-black rounded-xl)/,
    toggleHtml + '\n          $1'
  );

  fs.writeFileSync('src/components/SetupProfile.tsx', code);
}
