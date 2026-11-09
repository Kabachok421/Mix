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
              const newFriendCode = (Date.now().toString(36).substring(4) + Math.random().toString(36).substring(2, 6)).toUpperCase();
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
                 updates.friendCode = (Date.now().toString(36).substring(4) + Math.random().toString(36).substring(2, 6)).toUpperCase();
               }
               await setDoc(userRef, updates, { merge: true });
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

    // --- Статус «в сети» с минимумом записей в Firestore ---
    // Лимит бесплатного плана: 20 000 записей в сутки на весь проект, поэтому:
    //  - «в сети» пишем не чаще раза в 4 минуты (раньше каждые 45 секунд);
    //  - пока нет действий мыши и клавиатуры 30 минут, запись прекращается (Mix в трее ночью ничего не пишет);
    //  - сворачивание вкладки не пишет сразу: ждём минуту, вдруг пользователь вернётся;
    //  - «не в сети» пишем один раз при выходе и только если до этого писали «в сети».
    const HEARTBEAT_MS = 4 * 60 * 1000;
    const IDLE_MS = 30 * 60 * 1000;
    const MIN_GAP_MS = 60 * 1000;
    const HIDDEN_GRACE_MS = 60 * 1000;

    let lastStatus: 'online' | 'offline' | null = null;
    let lastWrite = 0;
    let lastActivity = Date.now();
    let hiddenTimer: ReturnType<typeof setTimeout> | null = null;

    const writePresence = (status: 'online' | 'offline') => {
      const now = Date.now();
      if (status === 'offline' && lastStatus !== 'online') return; // нечего менять
      if (status === 'online' && lastStatus === 'online' && now - lastWrite < MIN_GAP_MS) return; // слишком часто
      lastStatus = status;
      lastWrite = now;
      setDoc(userRef, { status, lastSeen: serverTimestamp() }, { merge: true }).catch(console.error);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (hiddenTimer) {
          clearTimeout(hiddenTimer);
          hiddenTimer = null;
        }
        lastActivity = Date.now();
        writePresence('online');
      } else if (!hiddenTimer) {
        hiddenTimer = setTimeout(() => {
          hiddenTimer = null;
          if (document.visibilityState !== 'visible') writePresence('offline');
        }, HIDDEN_GRACE_MS);
      }
    };

    // Любое действие пользователя: запоминаем время и, если пауза была долгой, сразу отмечаемся «в сети»
    const handleActivity = () => {
      const now = Date.now();
      lastActivity = now;
      if (document.visibilityState === 'visible' && now - lastWrite > HEARTBEAT_MS) writePresence('online');
    };

    const pingInterval = setInterval(() => {
      if (document.visibilityState === 'visible' && Date.now() - lastActivity < IDLE_MS) {
        writePresence('online');
      }
    }, HEARTBEAT_MS);

    const handleBeforeUnload = () => writePresence('offline');

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    const activityEvents = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'mousemove'] as const;
    activityEvents.forEach((ev) => window.addEventListener(ev, handleActivity, { passive: true }));

    // Сразу после входа отмечаемся «в сети»
    if (document.visibilityState === 'visible') writePresence('online');

    return () => {
      unsubscribeProfile();
      clearInterval(pingInterval);
      if (hiddenTimer) clearTimeout(hiddenTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      activityEvents.forEach((ev) => window.removeEventListener(ev, handleActivity));
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
