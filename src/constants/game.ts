import type { RoomSettings } from '../types';

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 8;
export const MINIMUM_GAME_TURNS = 10;

export const DEFAULT_SCORING: RoomSettings['scoring'] = {
  correctGuess: 2,
  noOneGuessedMine: 2,
};

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  roundsCount: MINIMUM_GAME_TURNS,
  genre: '',
  scoring: DEFAULT_SCORING,
};
