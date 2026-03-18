import { 
  collection, 
  doc, 
  type FieldValue,
  setDoc, 
  query, 
  where, 
  getDocs, 
  serverTimestamp 
} from "firebase/firestore";
import { db } from "./config";
import type { Room, RoomSettings } from "../types";

/**
 * 6桁のランダムなルームコードを生成します。
 */
export const generateRoomCode = (): string => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

/**
 * ルームを新規作成します。
 */
export const createRoom = async (hostId: string, settings: RoomSettings): Promise<Room> => {
  const roomId = doc(collection(db, "rooms")).id;
  const roomCode = generateRoomCode();
  
  const roomData: Omit<Room, 'id' | 'createdAt'> & { createdAt: FieldValue } = {
    roomCode,
    hostId,
    currentRoundId: "",
    currentRoundNumber: 0,
    status: 'waiting',
    settings,
    createdAt: serverTimestamp(),
  };

  await setDoc(doc(db, "rooms", roomId), roomData);
  
  // ルームコードからの逆引き用インデックス（オプション：ルーム数が増える場合は専用コレクションが必要だが、MVPでは直下検索）
  
  return { id: roomId, ...roomData, createdAt: Date.now() };
};

/**
 * ルームコードからルームIDを取得します。
 */
export const findRoomByCode = async (roomCode: string): Promise<string | null> => {
  const roomsRef = collection(db, "rooms");
  const q = query(roomsRef, where("roomCode", "==", roomCode.toUpperCase()));
  const querySnapshot = await getDocs(q);
  
  if (querySnapshot.empty) return null;
  return querySnapshot.docs[0].id;
};
