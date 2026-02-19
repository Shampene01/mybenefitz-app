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
import { doc, setDoc, getDoc, collection, query, where, getDocs, limit, arrayUnion, serverTimestamp } from 'firebase/firestore';
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
  // --- Core Identifiers ---
  uid: string;
  authUid?: string;
  waId?: string;
  idNumber?: string;

  // --- Personal Info ---
  firstName?: string;
  lastName?: string;
  fullName?: string;
  displayName: string;
  email: string;
  phoneNumber?: string;
  whatsappNumber?: string;
  photoURL?: string;

  // --- Unified Schema Fields ---
  linkStatus: 'whatsapp_only' | 'app_only' | 'linked';
  channels: ('whatsapp' | 'app')[];
  primaryChannel: 'whatsapp' | 'app';
  source: string;
  linkedAt?: string;
  linkedBy?: string;

  // --- Existing Fields ---
  role?: string;
  tenantId?: string;
  onboarded?: boolean;
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
        const profileDoc = await getDoc(doc(db, 'profiles', user.uid));
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
    const normalizedEmail = user.email!.trim().toLowerCase();
    const [firstName, ...rest] = displayName.split(' ');
    const lastName = rest.join(' ') || undefined;

    // Check if a WhatsApp-only profile already exists for this email
    let existingProfile: { id: string; data: Record<string, unknown> } | null = null;
    try {
      const profilesRef = collection(db, 'profiles');
      const q = query(
        profilesRef,
        where('email', '==', normalizedEmail),
        where('linkStatus', '==', 'whatsapp_only'),
        limit(1),
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        existingProfile = { id: snap.docs[0].id, data: snap.docs[0].data() as Record<string, unknown> };
      }
    } catch (err) {
      console.warn('[AuthContext] Could not check for existing profiles:', err);
    }

    let profile: UserProfile;

    if (existingProfile) {
      // LINK: Merge app credentials into existing WhatsApp profile
      const linkData = {
        authUid: user.uid,
        email: normalizedEmail,
        firstName,
        lastName,
        fullName: displayName,
        displayName,
        linkStatus: 'linked' as const,
        linkedAt: now,
        linkedBy: 'email',
        channels: arrayUnion('app'),
        role: 'user',
        updatedAt: now,
      };
      await setDoc(doc(db, 'profiles', existingProfile.id), linkData, { merge: true });

      // Also create a pointer doc at the auth UID so reads by UID still work
      if (existingProfile.id !== user.uid) {
        await setDoc(doc(db, 'profiles', user.uid), {
          ...existingProfile.data,
          ...linkData,
          channels: ['whatsapp', 'app'],
          createdAt: (existingProfile.data.createdAt as string) || now,
        });
      }

      profile = {
        uid: user.uid,
        authUid: user.uid,
        email: normalizedEmail,
        firstName,
        lastName,
        fullName: displayName,
        displayName,
        linkStatus: 'linked',
        channels: ['whatsapp', 'app'],
        primaryChannel: 'app',
        source: 'mobile_app',
        linkedAt: now,
        linkedBy: 'email',
        role: 'user',
        waId: (existingProfile.data.waId as string) || undefined,
        createdAt: (existingProfile.data.createdAt as string) || now,
        updatedAt: now,
      };
      console.log(`[AuthContext] Linked app user ${user.uid} to existing WhatsApp profile`);
    } else {
      // CREATE: New app-only profile
      profile = {
        uid: user.uid,
        authUid: user.uid,
        email: normalizedEmail,
        firstName,
        lastName,
        fullName: displayName,
        displayName,
        linkStatus: 'app_only',
        channels: ['app'],
        primaryChannel: 'app',
        source: 'mobile_app',
        role: 'user',
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(doc(db, 'profiles', user.uid), profile);
      console.log(`[AuthContext] Created new app-only profile for ${user.uid}`);
    }

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
    
    await setDoc(doc(db, 'profiles', user.uid), data, { merge: true });
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
