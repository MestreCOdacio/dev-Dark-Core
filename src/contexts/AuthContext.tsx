import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: { uid: string } | null;
  profile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
  loginLegacy: (id: string) => void;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ uid: string } | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loginLegacy = (id: string) => {
    localStorage.setItem('shadowdark_userid', id);
    setUser({ uid: id });
    setLoading(false);
  };

  useEffect(() => {
    // 1. Initial check for legacy ID in localStorage
    const legacyId = localStorage.getItem('shadowdark_userid');
    if (legacyId) {
      setUser({ uid: legacyId });
    }

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
      } else {
        const currentLegacyId = localStorage.getItem('shadowdark_userid');
        if (currentLegacyId) {
          setUser({ uid: currentLegacyId });
        } else {
          setUser(null);
          setLoading(false);
        }
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // 2. Separate effect for profile subscription
  useEffect(() => {
    if (!user?.uid) {
      setProfile(null);
      return;
    }

    const docRef = doc(db, 'users', user.uid);
    const unsubscribeProfile = onSnapshot(docRef, async (docSnap) => {
      try {
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        } else {
            // If no profile exists yet, create one
            const newProfile: UserProfile = {
              id: user.uid,
              nickname: (user as any).displayName || (user.uid === 'MESTRE' ? 'Mestre do Jogo' : 'Explorador'),
              createdAt: new Date().toISOString(),
              role: user.uid === 'MESTRE' ? 'Mestre' : 'Jogador'
            };
            await setDoc(docRef, newProfile);
            setProfile(newProfile);
        }
      } catch (err) {
        console.error("Error in profile snapshot handler:", err);
      } finally {
        setLoading(false);
      }
    }, (error) => {
      console.error("Profile fetch error:", error);
      setLoading(false);
    });

    return () => unsubscribeProfile();
  }, [user?.uid]);

  const logout = async () => {
    localStorage.removeItem('shadowdark_userid');
    await signOut(auth);
    setUser(null);
    setProfile(null);
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;
    const docRef = doc(db, 'users', user.uid);
    await setDoc(docRef, { ...profile, ...updates, id: user.uid }, { merge: true });
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, logout, loginLegacy, updateProfile }}>
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
