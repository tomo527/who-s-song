import { signInAnonymously } from "firebase/auth";
import { auth } from "./config";

/**
 * Firebase 匿名認証を実行し、ユーザーIDを返します。
 */
export const loginAnonymously = async (): Promise<string> => {
  try {
    const userCredential = await signInAnonymously(auth);
    return userCredential.user.uid;
  } catch (error) {
    console.error("Anonymous auth failed:", error);
    throw error;
  }
};

/**
 * 現在ログインしているユーザーのUIDを取得します。
 */
export const getCurrentUserId = (): string | null => {
  return auth.currentUser?.uid || null;
};
