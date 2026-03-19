export type GameStatus = 'waiting' | 'active' | 'finished';
export type RoundPhase = 'submitting' | 'guessing' | 'revealing';

export interface RoomSettings {
  roundsCount: number;
  theme?: string;
  scoring: {
    correctGuess: number;
    noOneGuessedMine: number;
    bestSubmissionBonus: number;
  };
}

export interface Room {
  id: string;
  roomCode: string;
  hostId: string;
  currentRoundId: string;
  currentRoundNumber: number; // 追加: 現在のラウンド番号 (1-indexed)
  status: GameStatus;
  settings: RoomSettings;
  createdAt: number;
}

export interface Player {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
  joinedAt?: number;
  lastSeenAt: number;
}

export interface Round {
  id: string;
  theme: string;
  phase: RoundPhase;
  parentPlayerId: string;
  startedAt: number;
  bonusWinnerSubmissionId?: string;
  scoreFinalized?: boolean; // 追加: スコア計算済みフラグ
  finalizedAt?: number;      // 追加: 確定日時
  finalizedBy?: string;      // 追加: 確定させたホストのID
}

export interface Submission {
  id: string;
  roundId: string;
  playerId: string; // 内部管理用
  songName: string;
  comment?: string;
}

export interface GuessAnswer {
  submissionId: string;
  guessedPlayerId: string;
}

export interface Guess {
  id: string; // playerId + roundId の組み合わせ
  roundId: string;
  playerId: string;
  answers: GuessAnswer[];
}
