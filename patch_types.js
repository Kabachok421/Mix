import fs from 'fs';
let code = fs.readFileSync('src/types.ts', 'utf8');

code = code.replace(/  friendCode\?: string;/, "  friendCode?: string;\n  bannedUntil?: Timestamp | null;");
fs.writeFileSync('src/types.ts', code);
