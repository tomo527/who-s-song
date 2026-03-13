import { 
  collection, 
  doc, 
  addDoc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  where,
  getDocs,
  runTransaction,
  serverTimestamp 
} from "firebase/firestore";
import { db } from "./config";
import type { Round, Submission, Guess, RoundPhase, Player, Room } from "../types";
import { calculateScores } from "../logic/scoring";

/**
 * ラウンドを新規作成します（ホストのみ）。
 */
export const createRound = async (roomId: string, theme: string, roundNumber: number): Promise<string> => {
  const roundsRef = collection(db, "rooms", roomId, "rounds");
  const roundDoc = await addDoc(roundsRef, {
    theme,
    phase: 'submitting',
    startedAt: serverTimestamp(),
  });
  
  // ルームの現在のラウンドIDとラウンド番号を更新
  const roomRef = doc(db, "rooms", roomId);
  await updateDoc(roomRef, {
    currentRoundId: roundDoc.id,
    currentRoundNumber: roundNumber
  });
  
  return roundDoc.id;
};

/**
 * ラウンドのフェーズを変更します（ホストのみ）。
 */
export const updateRoundPhase = async (roomId: string, roundId: string, phase: RoundPhase): Promise<void> => {
  const roundRef = doc(db, "rooms", roomId, "rounds", roundId);
  await updateDoc(roundRef, { phase });
};

/**
 * ラウンドのボーナス当選曲（ベスト提出）を更新します（ホストのみ）。
 */
export const updateRoundBonus = async (roomId: string, roundId: string, submissionId: string): Promise<void> => {
  const roundRef = doc(db, "rooms", roomId, "rounds", roundId);
  await updateDoc(roundRef, { bonusWinnerSubmissionId: submissionId });
};

/**
 * 曲を匿名で提出します。
 */
export const submitSong = async (roomId: string, roundId: string, playerId: string, songName: string, comment?: string): Promise<void> => {
  const submissionsRef = collection(db, "rooms", roomId, "submissions");
  
  // 重複チェック
  const q = query(submissionsRef, where("roundId", "==", roundId), where("playerId", "==", playerId));
  const snap = await getDocs(q);
  if (!snap.empty) return;

  await addDoc(submissionsRef, {
    roundId,
    playerId,
    songName,
    comment: comment || "",
    createdAt: serverTimestamp(),
  });
};

/**
 * 推理（予想）を登録します。
 */
export const submitGuess = async (roomId: string, roundId: string, playerId: string, answers: Guess['answers']): Promise<void> => {
  const guessId = `${playerId}_${roundId}`;
  const guessRef = doc(db, "rooms", roomId, "guesses", guessId);
  await setDoc(guessRef, {
    roundId,
    playerId,
    answers,
    submittedAt: serverTimestamp(),
  });
};

/**
 * 現在のラウンド情報を購読します。
 */
export const subscribeRound = (roomId: string, roundId: string, callback: (round: Round | null) => void) => {
  const roundRef = doc(db, "rooms", roomId, "rounds", roundId);
  return onSnapshot(roundRef, (doc) => {
    if (doc.exists()) {
      callback({ id: doc.id, ...doc.data() } as Round);
    } else {
      callback(null);
    }
  });
};

/**
 * 提出された曲一覧を購読します。
 */
export const subscribeSubmissions = (roomId: string, roundId: string, callback: (submissions: Submission[]) => void) => {
  const submissionsRef = collection(db, "rooms", roomId, "submissions");
  const q = query(submissionsRef, where("roundId", "==", roundId));
  
  return onSnapshot(q, (snapshot) => {
    const submissions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Submission));
    callback(submissions);
  });
};

/**
 * 特定のプレイヤーの現在のラウンドに対する予想を購読します。
 */
export const subscribePlayerGuess = (roomId: string, roundId: string, playerId: string, callback: (guess: Guess | null) => void) => {
  const guessId = `${playerId}_${roundId}`;
  const guessRef = doc(db, "rooms", roomId, "guesses", guessId);
  
  return onSnapshot(guessRef, (doc) => {
    if (doc.exists()) {
      callback({ id: doc.id, ...doc.data() } as Guess);
    } else {
      callback(null);
    }
  });
};

/**
 * スコア計算を実行し、Firestore に反映します（二重実行防止機能付き）。
 */
export const finalizeRoundScores = async (room: Room, round: Round, players: Player[]): Promise<void> => {
  const roundRef = doc(db, "rooms", room.id, "rounds", round.id);

  await runTransaction(db, async (transaction) => {
    const roundDoc = await transaction.get(roundRef);
    if (!roundDoc.exists()) throw new Error("Round not found");
    
    const roundData = roundDoc.data() as Round;
    if (roundData.scoreFinalized) {
      console.warn("Scores already finalized for this round.");
      return;
    }

    // 必要なデータを取得（submissions, guesses）
    const subsRef = collection(db, "rooms", room.id, "submissions");
    const submissionsSnap = await getDocs(query(subsRef, where("roundId", "==", round.id)));
    const submissions = submissionsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Submission));

    const guessesRef = collection(db, "rooms", room.id, "guesses");
    const guessesSnap = await getDocs(query(guessesRef, where("roundId", "==", round.id)));
    const guesses = guessesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Guess));

    // スコア計算
    const scoreMap = calculateScores(
      players,
      submissions,
      guesses,
      room.settings.scoring,
      round.bonusWinnerSubmissionId
    );

    // プレイヤーのスコアを更新
    for (const player of players) {
      const playerRef = doc(db, "rooms", room.id, "players", player.id);
      const currentScore = player.score;
      const additionalScore = scoreMap[player.id] || 0;
      transaction.update(playerRef, { score: currentScore + additionalScore });
    }

    // ラウンドを確定済みに更新
    transaction.update(roundRef, {
      scoreFinalized: true,
      finalizedAt: Date.now(),
      finalizedBy: room.hostId
    });
  });
};

/**
 * 次のラウンドへ進むか、ゲームを終了します。
 */
export const advanceGame = async (room: Room, nextTheme: string): Promise<void> => {
  const isLastRound = room.currentRoundNumber >= room.settings.roundsCount;
  const roomRef = doc(db, "rooms", room.id);

  if (isLastRound) {
    // ゲーム終了
    await updateDoc(roomRef, { status: 'finished' });
  } else {
    // 次のラウンド作成
    await createRound(room.id, nextTheme, room.currentRoundNumber + 1);
  }
};
