import type { RoomSettings } from '../types';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
export const DEFAULT_ROUNDS_COUNT = 3;

export const DEFAULT_SCORING: RoomSettings['scoring'] = {
  correctGuess: 2,
  noOneGuessedMine: 2,
  bestSubmissionBonus: 2,
};
