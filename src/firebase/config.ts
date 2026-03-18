import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const requiredEnvKeys = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

const missingEnvKeys = requiredEnvKeys.filter((key) => {
  const value = import.meta.env[key];
  return typeof value !== 'string' || value.trim().length === 0;
});

export const firebaseConfigError =
  missingEnvKeys.length > 0
    ? `Missing Firebase env vars: ${missingEnvKeys.join(', ')}`
    : null;

export const firebaseConfig = firebaseConfigError
  ? null
  : {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || undefined,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
      measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
    };

type FirebaseServices = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
};

let services: FirebaseServices | null = null;

if (firebaseConfig) {
  const app = initializeApp(firebaseConfig);
  services = {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
  };
}

export const getFirebaseServices = (): FirebaseServices => {
  if (!services) {
    throw new Error(firebaseConfigError ?? 'Firebase is not initialized.');
  }

  return services;
};

export const getDb = (): Firestore => getFirebaseServices().db;
export const getAuthInstance = (): Auth => getFirebaseServices().auth;

export const analyticsPromise: Promise<Analytics | null> =
  typeof window !== 'undefined' && services
    ? isSupported()
        .then((supported) => (supported ? getAnalytics(services.app) : null))
        .catch(() => null)
    : Promise.resolve(null);
