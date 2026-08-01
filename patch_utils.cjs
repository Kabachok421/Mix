const fs = require('fs');
let code = fs.readFileSync('src/lib/utils.ts', 'utf8');
code = code.replace(
  'export function generateThumbnail(file: File, maxWidth: number = 400, maxHeight: number = 400)',
  'export function generateThumbnail(file: File, maxWidth: number = 200, maxHeight: number = 200)'
);
code = code.replace(
  "resolve(canvas.toDataURL('image/jpeg', 0.7)); // 0.7 quality to keep size small",
  "resolve(canvas.toDataURL('image/jpeg', 0.5)); // 0.5 quality to keep size very small"
);
fs.writeFileSync('src/lib/utils.ts', code);
