import { signInAnonymously } from 'firebase/auth';
import { firebaseConfigError, getAuthInstance } from './config';

export const loginAnonymously = async (): Promise<string> => {
  if (firebaseConfigError) {
    throw new Error(firebaseConfigError);
  }

  const auth = getAuthInstance();
  const userCredential = await signInAnonymously(auth);
  return userCredential.user.uid;
};

export const getCurrentUserId = (): string | null => {
  if (firebaseConfigError) {
    return null;
  }

  return getAuthInstance().currentUser?.uid ?? null;
};
