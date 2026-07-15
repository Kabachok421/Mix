import fs from 'fs';
let code = fs.readFileSync('src/hooks/useAuth.tsx', 'utf8');

code = code.replace(
  /const newFriendCode = Math.random\(\).toString\(36\).substring\(2, 10\).toUpperCase\(\);/g,
  "const newFriendCode = (Date.now().toString(36).substring(4) + Math.random().toString(36).substring(2, 6)).toUpperCase();"
);

code = code.replace(
  /updates\.friendCode = Math.random\(\).toString\(36\).substring\(2, 10\).toUpperCase\(\);/g,
  "updates.friendCode = (Date.now().toString(36).substring(4) + Math.random().toString(36).substring(2, 6)).toUpperCase();"
);

fs.writeFileSync('src/hooks/useAuth.tsx', code);
