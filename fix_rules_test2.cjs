const fs = require('fs');
let rules = fs.readFileSync('firestore.rules', 'utf8');
rules = rules.replace(
  "&& (data.type == 'text' || (data.get('url', '') is string && data.get('url', '').size() <= 1024))",
  "&& (data.type == 'text' || data.get('url', '') is string)"
);
fs.writeFileSync('firestore.rules', rules);
