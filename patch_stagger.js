import fs from 'fs';
let code = fs.readFileSync('src/components/UserSearch.tsx', 'utf8');

code = code.replace(
  /exit=\{\{ opacity: 0, scale: 0\.95, transition: \{ staggerChildren: 0\.05, staggerDirection: -1, delay: 0\.2 \} \}\}/,
  'exit={{ opacity: 0, scale: 0.95, transition: { delay: results.length * 0.05 + 0.1 } }}'
);

code = code.replace(
  /exit=\{\{ opacity: 0, x: 50, transition: \{ duration: 0\.3 \} \}\}/g,
  'exit={{ opacity: 0, x: 50, transition: { duration: 0.3, delay: index * 0.05 } }}'
);

fs.writeFileSync('src/components/UserSearch.tsx', code);
