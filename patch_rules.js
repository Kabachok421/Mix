import fs from 'fs';
let code = fs.readFileSync('firestore.rules', 'utf8');

code = code.replace(
  /&& \(data\.get\('customName', ''\) == null \|\| data\.get\('customName', ''\) is string\)/,
  `&& (data.get('customName', '') == null || data.get('customName', '') is string)
        && (data.get('isHidden', null) == null || data.get('isHidden', null) is bool)
        && (data.get('friendCode', '') == null || data.get('friendCode', '') is string)`
);

code = code.replace(
  /\.hasOnly\(\['displayName', 'photoURL', 'lastSeen', 'status', 'username', 'email', 'usernameUpdatedAt', 'hideName', 'customName'\]\)/,
  `.hasOnly(['displayName', 'photoURL', 'lastSeen', 'status', 'username', 'email', 'usernameUpdatedAt', 'hideName', 'customName', 'isHidden', 'friendCode'])`
);

fs.writeFileSync('firestore.rules', code);
