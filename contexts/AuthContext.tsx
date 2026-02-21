import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User,
  UserCredential,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

const LINK_PROFILE_API_URL = 'https://app.mybenefitz.co.za/api/link-profile';

interface LinkProfileResult {
  linked: boolean;
  profile: Record<string, unknown>;
  alreadyLinked?: boolean;
  whatsAppProfileId?: string;
}

async function callLinkProfileAPI(
  idToken: string,
  body: Record<string, string>,
): Promise<LinkProfileResult | null> {
  try {
    const res = await fetch(LINK_PROFILE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.warn('[AuthContext] link-profile API returned', res.status);
      return null;
    }
    return (await res.json()) as LinkProfileResult;
  } catch (err) {
    console.warn('[AuthContext] link-profile API call failed:', err);
    return null;
  }
}

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

interface IdentityVerification {
  status: 'not_verified' | 'pending_verification' | 'home_affairs_verified';
  method?: 'said_verification' | 'realtime_idv';
  verifiedAt?: string;
  verifiedFirstNames?: string;
  verifiedLastName?: string;
  verifiedDateOfBirth?: string;
  verifiedGender?: string;
  verifiedCitizenship?: string;
  verifiedAge?: number;
  dateIssued?: string;
  lockedFields?: string[];
  requestedAt?: string;
  failureReason?: string;
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

  // --- Identity Verification ---
  identityVerification?: IdentityVerification;

  // --- Account Flags ---
  accountFlagged?: boolean;
  accountFlaggedReason?: string;
  accountFlaggedAt?: string;

  createdAt?: string;
  updatedAt?: string;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  emailVerified: boolean;
  isProfileComplete: boolean;
  isHomeAffairsVerified: boolean;
  isAccountFlagged: boolean;
  signIn: (email: string, password: string) => Promise<UserCredential>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  reloadUser: () => Promise<void>;
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
        // Try the new 'profiles' collection first
        const profileDoc = await getDoc(doc(db, 'profiles', user.uid));
        let profile: UserProfile | null = profileDoc.exists()
          ? (profileDoc.data() as UserProfile)
          : null;

        if (!profile) {
          // Fallback: read from legacy 'users' collection and migrate
          const legacyDoc = await getDoc(doc(db, 'users', user.uid));
          if (legacyDoc.exists()) {
            const legacyData = legacyDoc.data();
            const now = new Date().toISOString();
            const migratedProfile: UserProfile = {
              uid: user.uid,
              authUid: user.uid,
              email: legacyData.email || user.email || '',
              firstName: legacyData.firstName || '',
              lastName: legacyData.lastName || '',
              fullName: legacyData.fullName || legacyData.displayName || '',
              displayName: legacyData.displayName || `${legacyData.firstName || ''} ${legacyData.lastName || ''}`.trim(),
              phoneNumber: legacyData.phoneNumber,
              whatsappNumber: legacyData.whatsappNumber,
              idNumber: legacyData.idNumber,
              photoURL: legacyData.photoURL,
              linkStatus: 'app_only',
              channels: ['app'],
              primaryChannel: 'app',
              source: legacyData.source || 'mobile_app',
              role: legacyData.role || 'user',
              onboarded: legacyData.onboarded,
              address: legacyData.address,
              income: legacyData.income,
              fica: legacyData.fica,
              preferences: legacyData.preferences,
              affiliate: legacyData.affiliate,
              createdAt: legacyData.createdAt || now,
              updatedAt: now,
            };
            await setDoc(doc(db, 'profiles', user.uid), migratedProfile);
            profile = migratedProfile;
            console.log(`[AuthContext] Migrated legacy user ${user.uid} from users → profiles`);
          }
        }

        // If profile is app_only and email is verified, try server-side linking
        if (profile && profile.linkStatus === 'app_only' && user.emailVerified && user.email) {
          try {
            const idToken = await user.getIdToken(true);
            const linkResult = await callLinkProfileAPI(idToken, {
              displayName: profile.displayName || '',
              firstName: profile.firstName || '',
              lastName: profile.lastName || '',
              source: 'mobile_app',
            });
            if (linkResult?.linked) {
              profile = linkResult.profile as unknown as UserProfile;
              console.log('[AuthContext] Server-side linking succeeded');
            }
          } catch (err) {
            console.warn('[AuthContext] Server-side linking failed:', err);
          }
        }

        setUserProfile(profile);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return credential;
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(user, { displayName });

    const [firstName, ...rest] = displayName.split(' ');
    const lastName = rest.join(' ') || '';

    // Server-side check-and-link: the API uses Admin SDK to query
    // profiles by email (bypasses Firestore isOwner rule).
    // If a whatsapp_only profile exists → merges; otherwise → creates app_only.
    const idToken = await user.getIdToken();
    const linkResult = await callLinkProfileAPI(idToken, {
      displayName,
      firstName,
      lastName,
      source: 'mobile_app',
    });

    if (linkResult?.profile) {
      const profile = linkResult.profile as unknown as UserProfile;
      setUserProfile(profile);
      console.log(
        linkResult.linked
          ? `[AuthContext] Linked app user ${user.uid} to existing WhatsApp profile`
          : `[AuthContext] Created new app_only profile for ${user.uid}`,
      );
    }

    // Send email verification
    try {
      await sendEmailVerification(user);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code || '';
      if (code !== 'auth/too-many-requests') {
        console.warn('[AuthContext] Verification email fallback failed:', err);
      }
    }
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

  const resendVerificationEmail = async () => {
    if (!auth.currentUser) throw new Error('No user signed in');
    if (auth.currentUser.emailVerified) throw new Error('Email already verified');
    try {
      await sendEmailVerification(auth.currentUser);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code || '';
      if (code === 'auth/too-many-requests') {
        throw new Error('Too many requests. Please wait a few minutes before trying again.');
      }
      throw err;
    }
  };

  const reloadUser = async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    setUser({ ...auth.currentUser } as User);
  };

  const isProfileComplete = !!(
    userProfile?.firstName &&
    userProfile?.lastName &&
    userProfile?.idNumber &&
    userProfile?.phoneNumber &&
    userProfile?.address?.street &&
    userProfile?.address?.suburb &&
    userProfile?.address?.city &&
    userProfile?.address?.province &&
    userProfile?.income?.employerName &&
    userProfile?.income?.grossSalary
  );
  const isHomeAffairsVerified =
    userProfile?.identityVerification?.status === 'home_affairs_verified';
  const isAccountFlagged = !!userProfile?.accountFlagged;

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        emailVerified: user?.emailVerified ?? false,
        isProfileComplete,
        isHomeAffairsVerified,
        isAccountFlagged,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updateUserProfile,
        resendVerificationEmail,
        reloadUser,
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
