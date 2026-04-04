import type { Room, RoomMode, RoomSettings, TimeLimitSetting } from '../types';

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 8;
export const DUO_PLAYERS = 2;
export const MINIMUM_GAME_TURNS = 10;

export const DEFAULT_SCORING: RoomSettings['scoring'] = {
  correctGuess: 2,
  noOneGuessedMine: 2,
};

export const TIME_LIMIT_OPTIONS: Array<{ label: string; value: TimeLimitSetting }> = [
  { label: '2分', value: 120 },
  { label: '5分', value: 300 },
  { label: 'なし', value: null },
];

export const THEME_TIME_LIMIT_OPTIONS: Array<{ label: string; value: TimeLimitSetting }> = [
  { label: '1分', value: 60 },
  { label: '2分', value: 120 },
  { label: 'なし', value: null },
];

export const formatTimeLimit = (value: TimeLimitSetting | undefined): string => {
  if (value === 60) {
    return '1分';
  }

  if (value === 120) {
    return '2分';
  }

  if (value === 300) {
    return '5分';
  }

  return 'なし';
};

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  roundsCount: MINIMUM_GAME_TURNS,
  genre: '',
  themeTimeLimit: null,
  submitTimeLimit: null,
  guessTimeLimit: null,
  scoring: DEFAULT_SCORING,
};

export const getRoomMode = (room: Pick<Room, 'mode'> | null | undefined): RoomMode =>
  room?.mode === 'duo' ? 'duo' : 'standard';

export const getMinPlayersForMode = (mode: RoomMode): number =>
  mode === 'duo' ? DUO_PLAYERS : MIN_PLAYERS;

export const getMaxPlayersForMode = (mode: RoomMode): number =>
  mode === 'duo' ? DUO_PLAYERS : MAX_PLAYERS;
