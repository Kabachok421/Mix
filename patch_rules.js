const fs = require('fs');
let rules = fs.readFileSync('firestore.rules', 'utf8');

const transfersRule = `
    match /chats/{chatId}/transfers/{transferId} {
      allow read, write: if isSignedIn() && get(/databases/$(database)/documents/chats/$(chatId)).data.participantIds.hasAny([request.auth.uid]);
    }
`;

rules = rules.replace('match /chats/{chatId}/typing/{userId} {', transfersRule + '\n    match /chats/{chatId}/typing/{userId} {');
fs.writeFileSync('firestore.rules', rules);
