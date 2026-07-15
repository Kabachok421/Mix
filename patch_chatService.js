import fs from 'fs';
let code = fs.readFileSync('src/services/chatService.ts', 'utf8');

const replacement = `  searchUsers: async (searchTerm: string, currentUserId: string) => {
    try {
      const q = query(
        collection(db, 'users'),
        where('username', '>=', searchTerm),
        where('username', '<=', searchTerm + '\\uf8ff'),
        limit(10)
      );
      
      const snapshot = await getDocs(q);
      let users = snapshot.docs
        .map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile))
        .filter(u => u.uid !== currentUserId && !u.isHidden);

      // Also search by exact friend code
      const friendCodeQuery = query(
        collection(db, 'users'),
        where('friendCode', '==', searchTerm.trim().toUpperCase()),
        limit(1)
      );
      const friendCodeSnapshot = await getDocs(friendCodeQuery);
      friendCodeSnapshot.docs.forEach(doc => {
        const u = { uid: doc.id, ...doc.data() } as UserProfile;
        if (u.uid !== currentUserId) {
          if (!users.find(existing => existing.uid === u.uid)) {
            users.push(u);
          }
        }
      });

      return users;
    } catch (error) {
      handleFirestoreError(error, 'list', 'users');
    }
  },`;

code = code.replace(/searchUsers: async \([\s\S]*?handleFirestoreError\(error, 'list', 'users'\);\n    \}\n  \},/, replacement);
fs.writeFileSync('src/services/chatService.ts', code);
