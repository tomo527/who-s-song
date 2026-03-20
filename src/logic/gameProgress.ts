import { MINIMUM_GAME_TURNS } from '../constants/game';

export const getGameEndTurn = (
  playerCount: number,
  minimumTurns = MINIMUM_GAME_TURNS,
): number => {
  if (playerCount <= 0) {
    return minimumTurns;
  }

  const cycleLength = Math.max(playerCount, 1);
  return Math.ceil(minimumTurns / cycleLength) * cycleLength;
};

export const shouldFinishGameAfterRound = (
  roundNumber: number,
  playerCount: number,
  minimumTurns = MINIMUM_GAME_TURNS,
): boolean => roundNumber >= getGameEndTurn(playerCount, minimumTurns);
