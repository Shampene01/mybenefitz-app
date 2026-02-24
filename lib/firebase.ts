import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth } from 'firebase/auth';
import type { Persistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "REDACTED_API_KEY",
  authDomain: "my-benefits-portal-463t8v.firebaseapp.com",
  projectId: "my-benefits-portal-463t8v",
  storageBucket: "my-benefits-portal-463t8v.firebasestorage.app",
  messagingSenderId: "867203198671",
  appId: "1:867203198671:web:7c603df903ea298c34d1ba"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let _auth;
try {
  const { getReactNativePersistence } = require('firebase/auth/react-native') as {
    getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
  };
  _auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  _auth = getAuth(app);
}
export const auth = _auth;
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'africa-south1');
export default app;
