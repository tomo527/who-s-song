import type { Player } from '../types';

export const getRotatingParent = (
  players: Player[],
  roundNumber: number,
): Player | null => {
  if (players.length === 0) {
    return null;
  }

  const index = (Math.max(roundNumber, 1) - 1) % players.length;
  return players[index] ?? null;
};

export const getSubmittingPlayers = (
  players: Player[],
  parentPlayerId?: string,
): Player[] => players.filter((player) => player.id !== parentPlayerId);
