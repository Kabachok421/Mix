import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider, db } from '../lib/firebase';
import { doc, setDoc, serverTimestamp, getDoc, onSnapshot } from 'firebase/firestore';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isOffline: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

  // Global fallback to show offline warning
  useEffect(() => {
    const fallbackTimeoutId = setTimeout(() => {
      if (loading) setIsOffline(true);
    }, 4000); 
    return () => clearTimeout(fallbackTimeoutId);
  }, [loading]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        
        try {
          // Sync minimal user details if not exists
          const userRef = doc(db, 'users', user.uid);
          // We don't await getDoc here to block onSnapshot, we just let it fetch
          getDoc(userRef).then(async docSnap => {
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
          }).catch(err => {
            console.error("Failed to sync user details:", err);
          });

        } catch (error: any) {
             console.error("Firestore error in useAuth:", error);
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
    
    // Subscribe to profile changes
    const userRef = doc(db, 'users', user.uid);
    const unsubscribeProfile = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        setProfile({ uid: doc.id, ...doc.data() } as UserProfile);
      } else {
        setProfile(null); // Document doesn't exist yet, that's fine, we will handle it
      }
      setLoading(false); // only stop loading when profile is fetched successfully
      setIsOffline(false);
    }, (error) => {
      console.error("Profile snapshot error:", error);
      // We don't set loading to false on error because we don't want to show SetupProfile
      setIsOffline(true);
    });

    return () => {
      unsubscribeProfile();
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
    <AuthContext.Provider value={{ user, profile, loading, isOffline, login, logout }}>
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
