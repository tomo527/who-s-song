export type GameStatus = 'waiting' | 'active' | 'finished';
export type RoundPhase = 'submitting' | 'guessing' | 'judging' | 'revealing';
export type TimeLimitSetting = 60 | 120 | 300 | null;
export type RoomMode = 'standard' | 'duo';

export interface RoomSettings {
  roundsCount: number;
  genre: string;
  themeTimeLimit: TimeLimitSetting;
  submitTimeLimit: TimeLimitSetting;
  guessTimeLimit: TimeLimitSetting;
  scoring: {
    correctGuess: number;
    noOneGuessedMine: number;
  };
}

export interface Room {
  id: string;
  mode?: RoomMode;
  roomCode: string;
  hostId: string;
  currentRoundId: string;
  currentRoundNumber: number;
  currentGameId: number;
  status: GameStatus;
  settings: RoomSettings;
  createdAt: number;
}

export interface Player {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
  isActive?: boolean;
  joinedAt?: number;
  lastSeenAt: number;
}

export interface Round {
  id: string;
  gameId: number;
  theme: string;
  phase: RoundPhase;
  parentPlayerId: string;
  textAnswer?: string;
  startedAt: number;
  phaseStartedAt?: number;
  scoreFinalized?: boolean;
  finalizedAt?: number;
  finalizedBy?: string;
}

export interface Submission {
  id: string;
  gameId: number;
  roundId: string;
  playerId: string;
  songName: string;
  comment?: string;
}

export interface GuessAnswer {
  submissionId: string;
  guessedPlayerId: string;
}

export interface Guess {
  id: string;
  gameId: number;
  roundId: string;
  playerId: string;
  answers: GuessAnswer[];
  textAnswer?: string;
  isTextAnswerCorrect?: boolean;
  judgedByPlayerId?: string;
}
