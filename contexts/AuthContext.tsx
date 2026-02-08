import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

interface UserAddress {
  street?: string;
  unitNumber?: string;
  complexName?: string;
  suburb?: string;
  city?: string;
  province?: string;
  postalCode?: string;
}

interface UserIncome {
  employerName?: string;
  employerEmail?: string;
  grossSalary?: number | string;
  netSalary?: number | string;
}

interface UserFica {
  idDocument?: string;
  proofOfAddress?: string;
  bankConfirmation?: string;
  idDocumentUploadedAt?: string;
  proofOfAddressUploadedAt?: string;
  bankConfirmationUploadedAt?: string;
}

interface UserPreferences {
  showEarnings?: boolean;
  interest?: 'products' | 'affiliate' | 'both';
}

interface UserAffiliate {
  referralCode?: string;
  totalEarnings?: number;
  monthlyEarnings?: number;
  pendingEarnings?: number;
  referralCount?: number;
}

interface UserProfile {
  uid: string;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName: string;
  phoneNumber?: string;
  whatsappNumber?: string;
  idNumber?: string;
  photoURL?: string;
  tenantId?: string;
  role?: string;
  source?: string;
  address?: UserAddress;
  income?: UserIncome;
  fica?: UserFica;
  preferences?: UserPreferences;
  affiliate?: UserAffiliate;
  createdAt?: string;
  updatedAt?: string;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const profileDoc = await getDoc(doc(db, 'users', user.uid));
        if (profileDoc.exists()) {
          setUserProfile(profileDoc.data() as UserProfile);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(user, { displayName });
    
    const now = new Date().toISOString();
    const profile: UserProfile = {
      uid: user.uid,
      email: user.email!,
      displayName,
      role: 'user',
      source: 'self-registration',
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(doc(db, 'users', user.uid), profile);
    setUserProfile(profile);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUserProfile(null);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const updateUserProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    
    await setDoc(doc(db, 'users', user.uid), data, { merge: true });
    setUserProfile((prev) => prev ? { ...prev, ...data } : null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updateUserProfile,
      }}
    >
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
