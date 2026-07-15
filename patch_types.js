import fs from 'fs';
let code = fs.readFileSync('src/types.ts', 'utf8');

if (!code.includes('isHidden?: boolean')) {
  code = code.replace(
    /customName\?: string;/g,
    `customName?: string;\n  isHidden?: boolean;\n  friendCode?: string;`
  );
  fs.writeFileSync('src/types.ts', code);
}
