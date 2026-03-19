import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { getDb } from './config';
import type { Player } from '../types';

export const upsertPlayer = async (
  roomId: string,
  playerId: string,
  name: string,
  isHost = false,
): Promise<void> => {
  const db = getDb();
  const playerRef = doc(db, 'rooms', roomId, 'players', playerId);

  await setDoc(
    playerRef,
    {
      name,
      score: 0,
      isHost,
      lastSeenAt: serverTimestamp(),
    },
    { merge: true },
  );
};

export const subscribePlayers = (roomId: string, callback: (players: Player[]) => void) => {
  const db = getDb();
  const playersRef = collection(db, 'rooms', roomId, 'players');

  return onSnapshot(playersRef, (snapshot) => {
    const players = snapshot.docs.map(
      (playerDoc) =>
        ({
          id: playerDoc.id,
          ...playerDoc.data(),
        }) as Player,
    );

    callback(players);
  });
};

export const updateHeartbeat = async (roomId: string, playerId: string): Promise<void> => {
  const db = getDb();
  const playerRef = doc(db, 'rooms', roomId, 'players', playerId);

  await updateDoc(playerRef, {
    lastSeenAt: serverTimestamp(),
  });
};
