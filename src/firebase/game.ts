import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { calculateScores } from '../logic/scoring';
import type { Guess, Player, Round, RoundPhase, Room, Submission } from '../types';
import { getDb } from './config';

export const createRound = async (
  roomId: string,
  theme: string,
  roundNumber: number,
): Promise<string> => {
  const db = getDb();
  const roundsRef = collection(db, 'rooms', roomId, 'rounds');
  const roundDoc = await addDoc(roundsRef, {
    theme,
    phase: 'submitting',
    startedAt: serverTimestamp(),
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
  await updateDoc(doc(db, 'rooms', roomId, 'rounds', roundId), { phase });
};

export const updateRoundBonus = async (
  roomId: string,
  roundId: string,
  submissionId: string,
): Promise<void> => {
  const db = getDb();
  await updateDoc(doc(db, 'rooms', roomId, 'rounds', roundId), {
    bonusWinnerSubmissionId: submissionId,
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
  const guessId = `${playerId}_${roundId}`;

  await setDoc(doc(db, 'rooms', roomId, 'guesses', guessId), {
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
): Promise<void> => {
  const db = getDb();
  const roundRef = doc(db, 'rooms', room.id, 'rounds', round.id);

  await runTransaction(db, async (transaction) => {
    const roundDoc = await transaction.get(roundRef);
    if (!roundDoc.exists()) {
      throw new Error('Round not found');
    }

    const roundData = roundDoc.data() as Round;
    if (roundData.scoreFinalized) {
      return;
    }

    const submissionsRef = collection(db, 'rooms', room.id, 'submissions');
    const submissionsSnapshot = await getDocs(query(submissionsRef, where('roundId', '==', round.id)));
    const submissions = submissionsSnapshot.docs.map(
      (submissionDoc) => ({ id: submissionDoc.id, ...submissionDoc.data() }) as Submission,
    );

    const guessesRef = collection(db, 'rooms', room.id, 'guesses');
    const guessesSnapshot = await getDocs(query(guessesRef, where('roundId', '==', round.id)));
    const guesses = guessesSnapshot.docs.map(
      (guessDoc) => ({ id: guessDoc.id, ...guessDoc.data() }) as Guess,
    );

    const scoreMap = calculateScores(
      players,
      submissions,
      guesses,
      room.settings.scoring,
      round.bonusWinnerSubmissionId,
    );

    for (const player of players) {
      transaction.update(doc(db, 'rooms', room.id, 'players', player.id), {
        score: player.score + (scoreMap[player.id] || 0),
      });
    }

    transaction.update(roundRef, {
      scoreFinalized: true,
      finalizedAt: Date.now(),
      finalizedBy: room.hostId,
    });
  });
};

export const advanceGame = async (room: Room, nextTheme: string): Promise<void> => {
  const db = getDb();

  if (room.currentRoundNumber >= room.settings.roundsCount) {
    await updateDoc(doc(db, 'rooms', room.id), { status: 'finished' });
    return;
  }

  await createRound(room.id, nextTheme, room.currentRoundNumber + 1);
};
