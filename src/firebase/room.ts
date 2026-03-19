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
import type { Room, RoomSettings } from '../types';

export const generateRoomCode = (): string => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

export const createRoom = async (hostId: string, settings: RoomSettings): Promise<Room> => {
  const db = getDb();
  const roomId = doc(collection(db, 'rooms')).id;
  const roomCode = generateRoomCode();

  const roomData: Omit<Room, 'id' | 'createdAt'> & { createdAt: FieldValue } = {
    roomCode,
    hostId,
    currentRoundId: '',
    currentRoundNumber: 0,
    status: 'waiting',
    settings,
    createdAt: serverTimestamp(),
  };

  await setDoc(doc(db, 'rooms', roomId), roomData);

  return { id: roomId, ...roomData, createdAt: Date.now() };
};

export const findRoomByCode = async (roomCode: string): Promise<string | null> => {
  const db = getDb();
  const roomsRef = collection(db, 'rooms');
  const roomQuery = query(roomsRef, where('roomCode', '==', roomCode.toUpperCase()));
  const querySnapshot = await getDocs(roomQuery);

  if (querySnapshot.empty) {
    return null;
  }

  return querySnapshot.docs[0].id;
};
