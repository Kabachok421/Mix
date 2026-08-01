import fs from 'fs';

let rules = fs.readFileSync('firestore.rules', 'utf8');

const helpersIndex = rules.indexOf('// --- Helpers ---');
const helpersEndIndex = rules.indexOf('// --- Validations ---');

let helpers = rules.substring(helpersIndex, helpersEndIndex);
helpers += `    function isAdmin() {
      return isSignedIn() && (
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.get('isAdmin', false) == true ||
        request.auth.token.email == 'kko593764@gmail.com'
      );
    }\n    `;

rules = rules.substring(0, helpersIndex) + helpers + rules.substring(helpersEndIndex);

const isValidUserRegex = /function isValidUser\(data\) \{[\s\S]*?return data\.keys\(\)\.hasAll\(\['uid', 'displayName'\]\)[\s\S]*?&& \(data\.get\('status', 'offline'\) in \['online', 'offline'\]\);\s*\}/;

const newIsValidUser = `function isValidUser(data) {
      return data.keys().hasAll(['uid', 'displayName'])
        && data.uid == request.auth.uid
        && (data.get('email', '') == null || data.get('email', '') is string)
        && data.displayName is string && data.displayName.size() < 100
        && (data.get('photoURL', '') == null || data.get('photoURL', '') is string)
        && (data.get('username', '') == null || data.get('username', '') is string)
        && (data.get('usernameUpdatedAt', null) == null || data.get('usernameUpdatedAt', null) is timestamp)
        && (data.get('hideName', null) == null || data.get('hideName', null) is bool)
        && (data.get('customName', '') == null || data.get('customName', '') is string)
        && (data.get('isHidden', null) == null || data.get('isHidden', null) is bool)
        && (data.get('friendCode', '') == null || data.get('friendCode', '') is string)
        && (data.get('status', 'offline') in ['online', 'offline'])
        && (data.get('bannedUntil', null) == null || data.get('bannedUntil', null) is timestamp)
        && (data.get('isAdmin', false) == null || data.get('isAdmin', false) is bool);
    }`;

rules = rules.replace(isValidUserRegex, newIsValidUser);

// Replacing the match block manually
const userMatchStart = rules.indexOf('match /users/{userId} {');
const chatsMatchStart = rules.indexOf('match /chats/{chatId} {');

const newUserMatch = `match /users/{userId} {
      allow read: if isSignedIn(); // Allow discovery
      allow create: if isOwner(userId) && isValidUser(incoming());
      allow update: if isAdmin() || (
        isOwner(userId) && isValidUser(incoming())
        && incoming().diff(existing()).affectedKeys().hasOnly(['displayName', 'photoURL', 'lastSeen', 'status', 'username', 'email', 'usernameUpdatedAt', 'hideName', 'customName', 'isHidden', 'friendCode'])
        && (
          !incoming().diff(existing()).affectedKeys().hasAny(['username']) 
           || existing().get('username', '') == ''
        )
      );
    }
    `;

rules = rules.substring(0, userMatchStart) + newUserMatch + rules.substring(chatsMatchStart);

fs.writeFileSync('firestore.rules', rules);
