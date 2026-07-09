const fs = require('fs');
let rules = fs.readFileSync('firestore.rules', 'utf8');
rules = rules.replace(
  'match /chats/{chatId}/transfers/{transferId} {\n      allow read, write: if isSignedIn() && get(/databases/$(database)/documents/chats/$(chatId)).data.participantIds.hasAny([request.auth.uid]);\n    }',
  'match /chats/{chatId}/transfers/{transferId} {\n      allow read, write: if isSignedIn();\n    }'
);
fs.writeFileSync('firestore.rules', rules);
