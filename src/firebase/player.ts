import {
  collection,
  doc,
  getDoc,
  getDocs,
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
  const snapshot = await getDoc(playerRef);
  const existingPlayer = snapshot.exists() ? (snapshot.data() as Partial<Player>) : null;
  const joinedAt =
    existingPlayer && typeof existingPlayer.joinedAt === 'number'
      ? existingPlayer.joinedAt
      : Date.now();

  await setDoc(
    playerRef,
    {
      name,
      score: typeof existingPlayer?.score === 'number' ? existingPlayer.score : 0,
      isHost: Boolean(existingPlayer?.isHost) || isHost,
      isActive: true,
      joinedAt,
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

    callback(
      players
        .filter((player) => player.isActive !== false)
        .sort(
        (left, right) =>
          (left.joinedAt ?? 0) - (right.joinedAt ?? 0) || left.name.localeCompare(right.name, 'ja'),
        ),
    );
  });
};

export const getPlayerCount = async (roomId: string): Promise<number> => {
  const db = getDb();
  const playersRef = collection(db, 'rooms', roomId, 'players');
  const snapshot = await getDocs(playersRef);
  return snapshot.docs.filter((playerDoc) => {
    const player = playerDoc.data() as Partial<Player>;
    return player.isActive !== false;
  }).length;
};

export const updateHeartbeat = async (roomId: string, playerId: string): Promise<void> => {
  const db = getDb();
  const playerRef = doc(db, 'rooms', roomId, 'players', playerId);

  await updateDoc(playerRef, {
    lastSeenAt: serverTimestamp(),
  });
};

export const deactivatePlayer = async (roomId: string, playerId: string): Promise<void> => {
  const db = getDb();
  const playerRef = doc(db, 'rooms', roomId, 'players', playerId);

  await updateDoc(playerRef, {
    isActive: false,
    lastSeenAt: serverTimestamp(),
  });
};
