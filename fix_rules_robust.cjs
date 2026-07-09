const fs = require('fs');
let rules = fs.readFileSync('firestore.rules', 'utf8');

// Relax isValidMessage even more
rules = rules.replace(
  "&& (data.type == 'text' || data.get('url', '') is string)",
  "&& (data.type == 'text' || data.keys().hasAll(['url']))"
);

// Allow any update to chats as long as user is participant and updatedAt is set
rules = rules.replace(
  "incoming().diff(existing()).affectedKeys().hasAny(['lastMessage', 'lastMessageSenderId', 'updatedAt'])\n          && incoming().updatedAt == request.time",
  "incoming().updatedAt == request.time"
);

fs.writeFileSync('firestore.rules', rules);
