import { 
  doc, 
  setDoc, 
  onSnapshot, 
  collection, 
  updateDoc, 
  serverTimestamp 
} from "firebase/firestore";
import { db } from "./config";
import type { Player } from "../types";

/**
 * プレイヤー情報を Firestore に登録・更新します。
 */
export const upsertPlayer = async (roomId: string, playerId: string, name: string, isHost: boolean = false): Promise<void> => {
  const playerRef = doc(db, "rooms", roomId, "players", playerId);
  await setDoc(playerRef, {
    name,
    score: 0,
    isHost,
    lastSeenAt: serverTimestamp(),
  }, { merge: true });
};

/**
 * 参加者一覧をリアルタイムで購読します。
 */
export const subscribePlayers = (roomId: string, callback: (players: Player[]) => void) => {
  const playersRef = collection(db, "rooms", roomId, "players");
  return onSnapshot(playersRef, (snapshot) => {
    const players = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Player));
    callback(players);
  });
};

/**
 * プレイヤーの存在確認（生存報告）を更新します。
 */
export const updateHeartbeat = async (roomId: string, playerId: string): Promise<void> => {
  const playerRef = doc(db, "rooms", roomId, "players", playerId);
  await updateDoc(playerRef, {
    lastSeenAt: serverTimestamp(),
  });
};
