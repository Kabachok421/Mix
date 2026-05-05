import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider, db } from '../lib/firebase';
import { doc, setDoc, serverTimestamp, getDoc, onSnapshot } from 'firebase/firestore';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Global fallback to ensure app doesn't hang infinitely if something blocks firebase init
  useEffect(() => {
    const fallbackTimeoutId = setTimeout(() => {
      setLoading(false);
    }, 4000); // 4s absolute max loader time
    return () => clearTimeout(fallbackTimeoutId);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        
        try {
          // Sync minimal user details if not exists
          const userRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(userRef);
          
          if (!docSnap.exists()) {
             await setDoc(userRef, {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName || 'Anonymous',
              photoURL: user.photoURL || '',
              lastSeen: serverTimestamp(),
              status: 'online',
              username: ''
            });
          } else {
             await setDoc(userRef, {
               lastSeen: serverTimestamp(),
               status: 'online'
             }, { merge: true });
          }
        } catch (error: any) {
             console.error("Firestore error in useAuth:", error);
             if (error?.message?.includes('offline') || error?.code === 'unavailable') {
                 // Do not break the app completely if possible, but inform
                 console.warn("User is offline or browser blocked connection.");
             }
        }
      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    // Fallback: don't spin forever if offline
    const timeoutId = setTimeout(() => {
       setLoading(false);
    }, 2000);

    // Subscribe to profile changes
    const userRef = doc(db, 'users', user.uid);
    const unsubscribeProfile = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        setProfile({ uid: doc.id, ...doc.data() } as UserProfile);
      } else {
        setProfile(null);
      }
      setLoading(false); // stop loading immediately when we get any data
      clearTimeout(timeoutId);
    }, (error) => {
      console.error("Profile snapshot error:", error);
      setLoading(false);
      clearTimeout(timeoutId);
    });

    return () => {
      unsubscribeProfile();
      clearTimeout(timeoutId);
    };
  }, [user?.uid]);

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login error:', error);
      throw error; // Rethrow to let the UI handle it
    }
  };

  const logout = async () => {
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, { status: 'offline', lastSeen: serverTimestamp() }, { merge: true });
    }
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
