import type { Guess, GuessAnswer, Player, RoomMode, Round, Submission } from '../types';
import { isGuessCorrectForSubmission } from './guessEvaluation';

type DirectionalRate = {
  otherPlayerId: string;
  otherPlayerName: string;
  correct: number;
  total: number;
  rate: number;
};

export type PlayerFinalStats = {
  playerId: string;
  playerName: string;
  score: number;
  overallHitRate: number;
  parentHitRate: number;
  identifiedRate: number;
  parentCorrect: number;
  parentTotal: number;
  identifiedCorrect: number;
  identifiedTotal: number;
  directionalRates: DirectionalRate[];
};

export type MutualUnderstandingStat = {
  pairKey: string;
  leftPlayerId: string;
  leftPlayerName: string;
  rightPlayerId: string;
  rightPlayerName: string;
  correct: number;
  total: number;
  rate: number;
};

export type FinalStatsSummary = {
  players: PlayerFinalStats[];
  mutualRates: MutualUnderstandingStat[];
};

const toRate = (correct: number, total: number): number =>
  total > 0 ? Math.round((correct / total) * 100) : 0;

const findAnswer = (answers: GuessAnswer[], submissionId: string): GuessAnswer | undefined =>
  answers.find((answer) => answer.submissionId === submissionId);

export const buildFinalStats = (
  players: Player[],
  rounds: Round[],
  submissions: Submission[],
  guesses: Guess[],
  mode: RoomMode = 'standard',
): FinalStatsSummary => {
  const submissionsByRound = new Map<string, Submission[]>();

  for (const submission of submissions) {
    const roundSubmissions = submissionsByRound.get(submission.roundId) ?? [];
    roundSubmissions.push(submission);
    submissionsByRound.set(submission.roundId, roundSubmissions);
  }

  const guessesByRound = new Map<string, Guess>();
  for (const guess of guesses) {
    guessesByRound.set(guess.roundId, guess);
  }

  const directionalCounts = new Map<string, { correct: number; total: number }>();
  const playerCounters = new Map(
    players.map((player) => [
      player.id,
      {
        parentCorrect: 0,
        parentTotal: 0,
        identifiedCorrect: 0,
        identifiedTotal: 0,
      },
    ]),
  );

  for (const round of rounds) {
    const roundSubmissions = submissionsByRound.get(round.id) ?? [];
    const guess = guessesByRound.get(round.id);
    const parentId = round.parentPlayerId;

    if (mode === 'duo') {
      const submission = roundSubmissions.find((candidate) => candidate.playerId !== parentId);
      if (!submission) {
        continue;
      }

      const guessedCorrectly = guess?.isTextAnswerCorrect === true;
      const parentCounter = playerCounters.get(parentId);
      const submissionCounter = playerCounters.get(submission.playerId);

      if (parentCounter) {
        parentCounter.parentTotal += 1;
        if (guessedCorrectly) {
          parentCounter.parentCorrect += 1;
        }
      }

      if (submissionCounter) {
        submissionCounter.identifiedTotal += 1;
        if (guessedCorrectly) {
          submissionCounter.identifiedCorrect += 1;
        }
      }

      const directionalKey = `${parentId}:${submission.playerId}`;
      const directionalCounter = directionalCounts.get(directionalKey) ?? { correct: 0, total: 0 };
      directionalCounter.total += 1;
      if (guessedCorrectly) {
        directionalCounter.correct += 1;
      }
      directionalCounts.set(directionalKey, directionalCounter);
      continue;
    }

    for (const submission of roundSubmissions) {
      const submissionOwner = submission.playerId;
      const answer = guess ? findAnswer(guess.answers, submission.id) : undefined;
      const guessedCorrectly = isGuessCorrectForSubmission(submission, answer?.guessedPlayerId, roundSubmissions);
      const parentCounter = playerCounters.get(parentId);
      const submissionCounter = playerCounters.get(submissionOwner);

      if (parentCounter) {
        parentCounter.parentTotal += 1;
        if (guessedCorrectly) {
          parentCounter.parentCorrect += 1;
        }
      }

      if (submissionCounter) {
        submissionCounter.identifiedTotal += 1;
        if (guessedCorrectly) {
          submissionCounter.identifiedCorrect += 1;
        }
      }

      const directionalKey = `${parentId}:${submissionOwner}`;
      const directionalCounter = directionalCounts.get(directionalKey) ?? { correct: 0, total: 0 };
      directionalCounter.total += 1;
      if (guessedCorrectly) {
        directionalCounter.correct += 1;
      }
      directionalCounts.set(directionalKey, directionalCounter);
    }
  }

  const playerStats: PlayerFinalStats[] = players.map((player) => {
    const counters = playerCounters.get(player.id) ?? {
      parentCorrect: 0,
      parentTotal: 0,
      identifiedCorrect: 0,
      identifiedTotal: 0,
    };
    const overallCorrect = counters.parentCorrect + counters.identifiedCorrect;
    const overallTotal = counters.parentTotal + counters.identifiedTotal;

    const directionalRates = players
      .filter((candidate) => candidate.id !== player.id)
      .map((candidate) => {
        const directionalCounter = directionalCounts.get(`${player.id}:${candidate.id}`) ?? { correct: 0, total: 0 };
        return {
          otherPlayerId: candidate.id,
          otherPlayerName: candidate.name,
          correct: directionalCounter.correct,
          total: directionalCounter.total,
          rate: toRate(directionalCounter.correct, directionalCounter.total),
        };
      });

    return {
      playerId: player.id,
      playerName: player.name,
      score: player.score,
      overallHitRate: toRate(overallCorrect, overallTotal),
      parentHitRate: toRate(counters.parentCorrect, counters.parentTotal),
      identifiedRate: toRate(counters.identifiedCorrect, counters.identifiedTotal),
      parentCorrect: counters.parentCorrect,
      parentTotal: counters.parentTotal,
      identifiedCorrect: counters.identifiedCorrect,
      identifiedTotal: counters.identifiedTotal,
      directionalRates,
    };
  });

  const mutualRates: MutualUnderstandingStat[] = [];
  for (let leftIndex = 0; leftIndex < players.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < players.length; rightIndex += 1) {
      const left = players[leftIndex];
      const right = players[rightIndex];
      const leftToRight = directionalCounts.get(`${left.id}:${right.id}`) ?? { correct: 0, total: 0 };
      const rightToLeft = directionalCounts.get(`${right.id}:${left.id}`) ?? { correct: 0, total: 0 };
      const correct = leftToRight.correct + rightToLeft.correct;
      const total = leftToRight.total + rightToLeft.total;

      mutualRates.push({
        pairKey: `${left.id}:${right.id}`,
        leftPlayerId: left.id,
        leftPlayerName: left.name,
        rightPlayerId: right.id,
        rightPlayerName: right.name,
        correct,
        total,
        rate: toRate(correct, total),
      });
    }
  }

  return {
    players: playerStats.sort((left, right) => right.score - left.score || left.playerName.localeCompare(right.playerName, 'ja')),
    mutualRates: mutualRates.sort((left, right) => right.rate - left.rate || left.pairKey.localeCompare(right.pairKey, 'ja')),
  };
};
