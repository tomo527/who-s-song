import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { firebaseConfigError, getAuthInstance } from './config';

const authReadyPromises = new WeakMap<object, Promise<string | null>>();

export const loginAnonymously = async (): Promise<string> => {
  if (firebaseConfigError) {
    throw new Error(firebaseConfigError);
  }

  const auth = getAuthInstance();
  if (auth.currentUser) {
    return auth.currentUser.uid;
  }

  const userCredential = await signInAnonymously(auth);
  return userCredential.user.uid;
};

export const waitForAuthReady = async (): Promise<string | null> => {
  if (firebaseConfigError) {
    return null;
  }

  const auth = getAuthInstance();
  if (auth.currentUser) {
    return auth.currentUser.uid;
  }

  const existingPromise = authReadyPromises.get(auth);
  if (existingPromise) {
    return existingPromise;
  }

  const promise = new Promise<string | null>((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user?.uid ?? null);
    });
  });

  authReadyPromises.set(auth, promise);
  const uid = await promise;
  authReadyPromises.delete(auth);
  return uid;
};

export const getCurrentUserId = (): string | null => {
  if (firebaseConfigError) {
    return null;
  }

  return getAuthInstance().currentUser?.uid ?? null;
};
