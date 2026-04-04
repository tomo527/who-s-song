import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  type FieldValue,
  where,
} from 'firebase/firestore';
import { getDb } from './config';
import type { Room, RoomMode, RoomSettings } from '../types';

export const generateRoomCode = (): string => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

export const createRoom = async (
  hostId: string,
  settings: RoomSettings,
  mode: RoomMode = 'standard',
): Promise<Room> => {
  const db = getDb();
  const roomId = doc(collection(db, 'rooms')).id;
  const roomCode = generateRoomCode();

  const roomData: Omit<Room, 'id' | 'createdAt'> & { createdAt: FieldValue } = {
    mode,
    roomCode,
    hostId,
    currentRoundId: '',
    currentRoundNumber: 0,
    currentGameId: 1,
    status: 'waiting',
    settings,
    createdAt: serverTimestamp(),
  };

  await setDoc(doc(db, 'rooms', roomId), roomData);

  return { id: roomId, ...roomData, createdAt: Date.now() };
};

export const findRoomByCode = async (roomCode: string): Promise<Room | null> => {
  const db = getDb();
  const roomsRef = collection(db, 'rooms');
  const roomQuery = query(roomsRef, where('roomCode', '==', roomCode.toUpperCase()));
  const querySnapshot = await getDocs(roomQuery);

  if (querySnapshot.empty) {
    return null;
  }

  const roomDoc = querySnapshot.docs[0];
  return { id: roomDoc.id, ...roomDoc.data() } as Room;
};
