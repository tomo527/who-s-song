import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  where,
} from 'firebase/firestore';
import { MIN_PLAYERS } from '../constants/game';
import { shouldFinishGameAfterRound } from '../logic/gameProgress';
import { calculateScores } from '../logic/scoring';
import type { Guess, Player, Round, RoundPhase, Room, Submission } from '../types';
import { getDb } from './config';

export const getCurrentGameId = (room: Pick<Room, 'currentGameId'>): number => room.currentGameId || 1;

export const createRound = async (
  roomId: string,
  theme: string,
  roundNumber: number,
  parentPlayerId: string,
  gameId: number,
): Promise<string> => {
  const db = getDb();
  const playersSnapshot = await getDocs(collection(db, 'rooms', roomId, 'players'));
  if (playersSnapshot.size < MIN_PLAYERS) {
    throw new Error(`${MIN_PLAYERS}人以上集まってから開始してください。`);
  }

  const roundsRef = collection(db, 'rooms', roomId, 'rounds');
  const roundDoc = await addDoc(roundsRef, {
    gameId,
    theme,
    phase: 'submitting',
    parentPlayerId,
    startedAt: serverTimestamp(),
    phaseStartedAt: serverTimestamp(),
  });

  await updateDoc(doc(db, 'rooms', roomId), {
    currentRoundId: roundDoc.id,
    currentRoundNumber: roundNumber,
  });

  return roundDoc.id;
};

export const updateRoundPhase = async (
  roomId: string,
  roundId: string,
  phase: RoundPhase,
): Promise<void> => {
  const db = getDb();
  const roundRef = doc(db, 'rooms', roomId, 'rounds', roundId);

  if (phase === 'guessing') {
    const roundSnapshot = await getDoc(roundRef);
    if (!roundSnapshot.exists()) {
      throw new Error('Round not found');
    }

    const round = { id: roundSnapshot.id, ...roundSnapshot.data() } as Round;
    if (round.phase !== 'submitting') {
      throw new Error('Round is not in submitting phase');
    }

    if (!round.theme.trim()) {
      throw new Error('Theme must be set before guessing starts');
    }

    const [playersSnapshot, submissionsSnapshot] = await Promise.all([
      getDocs(collection(db, 'rooms', roomId, 'players')),
      getDocs(query(collection(db, 'rooms', roomId, 'submissions'), where('roundId', '==', roundId))),
    ]);
    const requiredSubmissions = Math.max(playersSnapshot.size - 1, 0);

    if (submissionsSnapshot.size !== requiredSubmissions) {
      throw new Error('All non-parent submissions are required before guessing starts');
    }
  }

  await updateDoc(roundRef, {
    phase,
    phaseStartedAt: serverTimestamp(),
  });
};

export const updateRoundTheme = async (
  roomId: string,
  roundId: string,
  playerId: string,
  theme: string,
): Promise<void> => {
  const trimmedTheme = theme.trim();
  if (!trimmedTheme) {
    throw new Error('Theme is required');
  }

  const db = getDb();
  const roundRef = doc(db, 'rooms', roomId, 'rounds', roundId);
  const roundSnapshot = await getDoc(roundRef);

  if (!roundSnapshot.exists()) {
    throw new Error('Round not found');
  }

  const round = { id: roundSnapshot.id, ...roundSnapshot.data() } as Round;
  if (round.parentPlayerId !== playerId) {
    throw new Error('Only the parent can set the round theme');
  }

  if (round.phase !== 'submitting') {
    throw new Error('Theme can only be updated during the submitting phase');
  }

  await updateDoc(roundRef, {
    theme: trimmedTheme,
    phaseStartedAt: serverTimestamp(),
  });
};

export const submitSong = async (
  roomId: string,
  roundId: string,
  playerId: string,
  songName: string,
  comment?: string,
): Promise<void> => {
  const db = getDb();
  const roundRef = doc(db, 'rooms', roomId, 'rounds', roundId);
  const roundSnapshot = await getDoc(roundRef);

  if (!roundSnapshot.exists()) {
    throw new Error('Round not found');
  }

  const round = { id: roundSnapshot.id, ...roundSnapshot.data() } as Round;
  if (round.parentPlayerId === playerId) {
    throw new Error('親役はこのラウンドでは曲を提出しません。');
  }

  const submissionsRef = collection(db, 'rooms', roomId, 'submissions');
  const existingSubmissionQuery = query(
    submissionsRef,
    where('roundId', '==', roundId),
    where('playerId', '==', playerId),
  );
  const existingSubmissionSnapshot = await getDocs(existingSubmissionQuery);

  if (!existingSubmissionSnapshot.empty) {
    return;
  }

  await addDoc(submissionsRef, {
    gameId: round.gameId,
    roundId,
    playerId,
    songName,
    comment: comment || '',
    createdAt: serverTimestamp(),
  });
};

export const submitGuess = async (
  roomId: string,
  roundId: string,
  playerId: string,
  answers: Guess['answers'],
): Promise<void> => {
  const db = getDb();
  const roundRef = doc(db, 'rooms', roomId, 'rounds', roundId);
  const roundSnapshot = await getDoc(roundRef);

  if (!roundSnapshot.exists()) {
    throw new Error('Round not found');
  }

  const round = { id: roundSnapshot.id, ...roundSnapshot.data() } as Round;
  if (round.parentPlayerId !== playerId) {
    throw new Error('このラウンドで推理できるのは親役だけです。');
  }

  const guessId = `${playerId}_${roundId}`;

  await setDoc(doc(db, 'rooms', roomId, 'guesses', guessId), {
    gameId: round.gameId,
    roundId,
    playerId,
    answers,
    submittedAt: serverTimestamp(),
  });
};

export const subscribeRound = (
  roomId: string,
  roundId: string,
  callback: (round: Round | null) => void,
) => {
  const db = getDb();

  return onSnapshot(doc(db, 'rooms', roomId, 'rounds', roundId), (roundDoc) => {
    callback(roundDoc.exists() ? ({ id: roundDoc.id, ...roundDoc.data() } as Round) : null);
  });
};

export const subscribeSubmissions = (
  roomId: string,
  roundId: string,
  callback: (submissions: Submission[]) => void,
) => {
  const db = getDb();
  const submissionsRef = collection(db, 'rooms', roomId, 'submissions');
  const roundSubmissionsQuery = query(submissionsRef, where('roundId', '==', roundId));

  return onSnapshot(roundSubmissionsQuery, (snapshot) => {
    const submissions = snapshot.docs.map(
      (submissionDoc) =>
        ({
          id: submissionDoc.id,
          ...submissionDoc.data(),
        }) as Submission,
    );

    callback(submissions);
  });
};

export const subscribePlayerGuess = (
  roomId: string,
  roundId: string,
  playerId: string,
  callback: (guess: Guess | null) => void,
) => {
  const db = getDb();
  const guessId = `${playerId}_${roundId}`;

  return onSnapshot(doc(db, 'rooms', roomId, 'guesses', guessId), (guessDoc) => {
    callback(guessDoc.exists() ? ({ id: guessDoc.id, ...guessDoc.data() } as Guess) : null);
  });
};

export const finalizeRoundScores = async (
  room: Room,
  round: Round,
  players: Player[],
  finalizedBy = room.hostId,
): Promise<void> => {
  const db = getDb();
  const roundRef = doc(db, 'rooms', room.id, 'rounds', round.id);
  const roundDoc = await getDoc(roundRef);
  if (!roundDoc.exists()) {
    throw new Error('Round not found');
  }

  const roundData = { id: roundDoc.id, ...roundDoc.data() } as Round;
  if (roundData.scoreFinalized) {
    return;
  }

  const submissionsRef = collection(db, 'rooms', room.id, 'submissions');
  const submissionsSnapshot = await getDocs(query(submissionsRef, where('roundId', '==', round.id)));
  const submissions = submissionsSnapshot.docs.map(
    (submissionDoc) => ({ id: submissionDoc.id, ...submissionDoc.data() }) as Submission,
  );

  const guessId = `${round.parentPlayerId}_${round.id}`;
  const guessSnapshot = await getDoc(doc(db, 'rooms', room.id, 'guesses', guessId));
  const guesses = guessSnapshot.exists()
    ? [({ id: guessSnapshot.id, ...guessSnapshot.data() }) as Guess]
    : [];

  const scoreMap = calculateScores(
    players,
    submissions,
    guesses,
    room.settings.scoring,
  );

  const batch = writeBatch(db);
  for (const player of players) {
    batch.update(doc(db, 'rooms', room.id, 'players', player.id), {
      score: player.score + (scoreMap[player.id] || 0),
    });
  }

  batch.update(roundRef, {
    scoreFinalized: true,
    finalizedAt: Date.now(),
    finalizedBy,
  });

  await batch.commit();
};

export const advanceGame = async (
  room: Room,
  theme: string,
  parentPlayerId: string,
  playerCount: number,
): Promise<void> => {
  const db = getDb();
  const gameId = getCurrentGameId(room);

  if (shouldFinishGameAfterRound(room.currentRoundNumber, playerCount, room.settings.roundsCount)) {
    await updateDoc(doc(db, 'rooms', room.id), { status: 'finished' });
    return;
  }

  await createRound(room.id, theme, room.currentRoundNumber + 1, parentPlayerId, gameId);
};

export const restartGame = async (
  room: Room,
  players: Player[],
): Promise<void> => {
  const db = getDb();
  const nextGameId = getCurrentGameId(room) + 1;
  const batch = writeBatch(db);

  batch.update(doc(db, 'rooms', room.id), {
    currentGameId: nextGameId,
    currentRoundId: '',
    currentRoundNumber: 0,
    status: 'waiting',
  });

  for (const player of players) {
    batch.update(doc(db, 'rooms', room.id, 'players', player.id), {
      score: 0,
    });
  }

  await batch.commit();
};

export const fetchFinishedGameData = async (
  roomId: string,
  gameId: number,
): Promise<{
  rounds: Round[];
  submissions: Submission[];
  guesses: Guess[];
}> => {
  const db = getDb();
  const [roundsSnapshot, submissionsSnapshot] = await Promise.all([
    getDocs(query(collection(db, 'rooms', roomId, 'rounds'), where('gameId', '==', gameId))),
    getDocs(query(collection(db, 'rooms', roomId, 'submissions'), where('gameId', '==', gameId))),
  ]);

  const rounds = roundsSnapshot.docs
    .map((roundDoc) => ({ id: roundDoc.id, ...roundDoc.data() }) as Round)
    .sort((left, right) => (left.startedAt ?? 0) - (right.startedAt ?? 0));
  const guessSnapshots = await Promise.all(
    rounds.map((round) => getDoc(doc(db, 'rooms', roomId, 'guesses', `${round.parentPlayerId}_${round.id}`))),
  );

  return {
    rounds,
    submissions: submissionsSnapshot.docs.map(
      (submissionDoc) => ({ id: submissionDoc.id, ...submissionDoc.data() }) as Submission,
    ),
    guesses: guessSnapshots
      .filter((guessSnapshot) => guessSnapshot.exists())
      .map(
        (guessSnapshot) => ({ id: guessSnapshot.id, ...guessSnapshot.data() }) as Guess,
      ),
  };
};
