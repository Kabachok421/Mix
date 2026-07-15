import fs from 'fs';
let code = fs.readFileSync('src/hooks/useAuth.tsx', 'utf8');

if (!code.includes('friendCode:')) {
  // Find the place where user is synced
  code = code.replace(
    /if \(!docSnap\.exists\(\)\) \{([\s\S]*?)\}/,
    `if (!docSnap.exists()) {
              const newFriendCode = Math.random().toString(36).substring(2, 10).toUpperCase();
              $1
            } else {
               const data = docSnap.data();
               const updates: any = { status: 'online', lastSeen: serverTimestamp() };
               if (!data.friendCode) {
                 updates.friendCode = Math.random().toString(36).substring(2, 10).toUpperCase();
               }
               await setDoc(userRef, updates, { merge: true });
            }`
  );
  
  // Also add friendCode to the new user creation
  code = code.replace(
    /username: ''\s*\}/,
    `username: '',
                friendCode: newFriendCode
              }`
  );
  
  fs.writeFileSync('src/hooks/useAuth.tsx', code);
}
