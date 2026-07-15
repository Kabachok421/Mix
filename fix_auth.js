import fs from 'fs';
let code = fs.readFileSync('src/hooks/useAuth.tsx', 'utf8');

const lines = code.split('\n');
const start = 44; // getDoc(userRef).then...
const end = 74;   // }).catch(err => { ...

const replacement = `          getDoc(userRef).then(async docSnap => {
            if (!docSnap.exists()) {
              const newFriendCode = Math.random().toString(36).substring(2, 10).toUpperCase();
              await setDoc(userRef, {
                uid: user.uid,
                email: user.email || null,
                displayName: user.displayName || 'Anonymous',
                photoURL: user.photoURL || '',
                lastSeen: serverTimestamp(),
                status: 'online',
                username: '',
                friendCode: newFriendCode
              });
            } else {
               const data = docSnap.data();
               const updates: any = { status: 'online', lastSeen: serverTimestamp() };
               if (!data.friendCode) {
                 updates.friendCode = Math.random().toString(36).substring(2, 10).toUpperCase();
               }
               await setDoc(userRef, updates, { merge: true });
            }
          }).catch(err => {
            console.error("Failed to sync user details:", err);
          });`;

code = lines.slice(0, 44).join('\n') + '\n' + replacement + '\n' + lines.slice(75).join('\n');
fs.writeFileSync('src/hooks/useAuth.tsx', code);
