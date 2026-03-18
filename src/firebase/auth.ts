import { signInAnonymously } from 'firebase/auth';
import { auth, firebaseConfigError } from './config';

export const loginAnonymously = async (): Promise<string> => {
  if (firebaseConfigError) {
    throw new Error(firebaseConfigError);
  }

  try {
    const userCredential = await signInAnonymously(auth);
    return userCredential.user.uid;
  } catch (error) {
    console.error('Anonymous auth failed:', error);
    throw error;
  }
};

export const getCurrentUserId = (): string | null => {
  return auth.currentUser?.uid || null;
};
