import fs from 'fs';
let code = fs.readFileSync('src/components/SetupProfile.tsx', 'utf8');

const regexIsUsernameLocked = /const isUsernameLocked = \(\(\) => \{[\s\S]*?\}\)\(\);/;
const replacementIsUsernameLocked = `const isUsernameLocked = !!profile?.username;`;

code = code.replace(regexIsUsernameLocked, replacementIsUsernameLocked);

const regexText1 = /\{isUsernameLocked && <p className="text-\[10px\] text-gray-400 mt-1">Изменение никнейма доступно 1 раз в 24 часа<\/p>\}/g;
const replacementText1 = `{isUsernameLocked && <p className="text-[10px] text-gray-400 mt-1">Изменение никнейма недоступно</p>}`;
code = code.replace(regexText1, replacementText1);

const regexText2 = /\{isUsernameLocked && <p className="text-xs text-gray-400 mt-1">Изменение никнейма доступно 1 раз в 24 часа<\/p>\}/g;
const replacementText2 = `{isUsernameLocked && <p className="text-xs text-gray-400 mt-1">Изменение никнейма недоступно</p>}`;
code = code.replace(regexText2, replacementText2);

fs.writeFileSync('src/components/SetupProfile.tsx', code);
