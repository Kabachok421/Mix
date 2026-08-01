import fs from 'fs';
let code = fs.readFileSync('src/components/SetupProfile.tsx', 'utf8');

const regexToRemove1 = /<\/button>\s*<motion\.div\s*layout\s*transition=\{\{ type: "spring", stiffness: 400, damping: 30 \}\}\s*drag="x"\s*dragConstraints=\{\{ left: 0, right: 0 \}\}\s*dragElastic=\{0\.4\}\s*dragSnapToOrigin=\{true\}\s*animate=\{\{ x: 0 \}\}\s*onDragEnd=\{\(e, info\) => \{[\s\S]*?className="h-full w-12 rounded-\[10px\] bg-white dark:bg-black shadow flex items-center justify-center cursor-grab active:cursor-grabbing z-10 relative pointer-events-auto"\s*>\s*<motion\.div animate=\{\{ rotate: isHidden \? 180 : 0 \}\} className="flex items-center text-gray-800 dark:text-gray-200">\s*<GripVertical className="w-3 h-3 opacity-30" \/>\s*\{isHidden \? <ShieldAlert className="w-4 h-4 ml-\[-2px\] text-orange-500" \/> : <ShieldAlert className="w-4 h-4 ml-\[-2px\]" \/>\}\s*<\/motion\.div>\s*<\/motion\.div>\s*<\/div>/g;

const regexToRemove2 = /<\/button>\s*<motion\.div\s*layout\s*transition=\{\{ type: "spring", stiffness: 400, damping: 30 \}\}\s*drag="x"\s*dragConstraints=\{\{ left: 0, right: 0 \}\}\s*dragElastic=\{0\.4\}\s*dragSnapToOrigin=\{true\}\s*animate=\{\{ x: 0 \}\}\s*onDragEnd=\{\(e, info\) => \{[\s\S]*?className="h-full w-14 rounded-xl bg-white dark:bg-black shadow-md flex items-center justify-center cursor-grab active:cursor-grabbing z-10 relative pointer-events-auto"\s*>\s*<motion\.div animate=\{\{ rotate: isHidden \? 180 : 0 \}\} className="flex items-center text-gray-800 dark:text-gray-200">\s*<GripVertical className="w-4 h-4 opacity-30" \/>\s*\{isHidden \? <ShieldAlert className="w-5 h-5 ml-\[-2px\] text-orange-500" \/> : <ShieldAlert className="w-5 h-5 ml-\[-2px\]" \/>\}\s*<\/motion\.div>\s*<\/motion\.div>\s*<\/div>/g;

code = code.replace(regexToRemove1, '</button>');
code = code.replace(regexToRemove2, '</button>');

fs.writeFileSync('src/components/SetupProfile.tsx', code);
