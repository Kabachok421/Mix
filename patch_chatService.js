import fs from 'fs';
let code = fs.readFileSync('src/services/chatService.ts', 'utf8');

const replacement = `  updateUserAdmin: async (userId: string, data: Partial<UserProfile>) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, data);
    } catch (error) {
      handleFirestoreError(error, 'update', 'users');
    }
  },
  // Subscribe to user profile (status, lastSeen, etc)`;

code = code.replace(/  \/\/ Subscribe to user profile \(status, lastSeen, etc\)/, replacement);
fs.writeFileSync('src/services/chatService.ts', code);
