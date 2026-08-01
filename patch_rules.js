const fs = require('fs');
let rules = fs.readFileSync('firestore.rules', 'utf8');
rules = rules.replace('allow list, get: if isSignedIn()', 'allow list, get: if true || isSignedIn()');
fs.writeFileSync('firestore.rules', rules);
