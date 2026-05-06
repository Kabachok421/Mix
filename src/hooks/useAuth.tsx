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

  // Global fallback to show offline warning and prevent absolute hang
  useEffect(() => {
    const fallbackTimeoutId = setTimeout(() => {
      if (loading) {
        setIsOffline(true);
        // Force stop loading after a longer delay so user is not stuck forever
        setTimeout(() => setLoading(false), 3000);
      }
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
        setProfile(null); 
      }
      setLoading(false);
      setIsOffline(false);
    }, (error) => {
      console.error("Profile snapshot error:", error);
      setIsOffline(true);
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setDoc(userRef, { status: 'online', lastSeen: serverTimestamp() }, { merge: true }).catch(console.error);
      } else {
        setDoc(userRef, { status: 'offline', lastSeen: serverTimestamp() }, { merge: true }).catch(console.error);
      }
    };

    let pingInterval: NodeJS.Timeout;
    const startPing = () => {
      pingInterval = setInterval(() => {
        if (document.visibilityState === 'visible') {
          setDoc(userRef, { status: 'online', lastSeen: serverTimestamp() }, { merge: true }).catch(console.error);
        }
      }, 2 * 60 * 1000); // Every 2 minutes
    };
    startPing();

    const handleBeforeUnload = () => {
      // In beforeunload, beacon or synchronous fetch is better, but this usually works enough for a simple setup.
      setDoc(userRef, { status: 'offline', lastSeen: serverTimestamp() }, { merge: true }).catch(console.error);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Ensure status is updated if we become active
    if (document.visibilityState === 'visible') {
      handleVisibilityChange();
    }

    return () => {
      unsubscribeProfile();
      clearInterval(pingInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      handleBeforeUnload();
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
