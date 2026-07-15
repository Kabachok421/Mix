import fs from 'fs';
let code = fs.readFileSync('src/components/FileMessage.tsx', 'utf8');

code = code.replace(
  /<motion\.div\s+initial=\{\{ opacity: 0 \}\}/,
  '<motion.div key="modal" initial={{ opacity: 0 }}'
);

code = code.replace(
  /<a \s*href=\{url \|\| \'#\'\}\s*target="_blank"\s*rel="noopener noreferrer"/,
  '<a href={url || \'#\'} target="_blank" rel="noopener noreferrer" download={fileName || \'download\'}'
);

fs.writeFileSync('src/components/FileMessage.tsx', code);
