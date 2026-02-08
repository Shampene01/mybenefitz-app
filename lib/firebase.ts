import { initializeApp, getApps } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "REDACTED_API_KEY",
  authDomain: "my-benefits-portal-463t8v.firebaseapp.com",
  projectId: "my-benefits-portal-463t8v",
  storageBucket: "my-benefits-portal-463t8v.firebasestorage.app",
  messagingSenderId: "867203198671",
  appId: "1:867203198671:web:7c603df903ea298c34d1ba"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
