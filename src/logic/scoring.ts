import type { Guess, Player, RoomSettings, Submission } from '../types';

export const calculateScores = (
  players: Player[],
  submissions: Submission[],
  guesses: Guess[],
  scoring: RoomSettings['scoring'],
  bonusWinnerSubmissionId?: string,
): Record<string, number> => {
  const scoreMap: Record<string, number> = {};

  for (const player of players) {
    scoreMap[player.id] = 0;
  }

  for (const guess of guesses) {
    for (const answer of guess.answers) {
      const targetSubmission = submissions.find((submission) => submission.id === answer.submissionId);
      if (targetSubmission && targetSubmission.playerId === answer.guessedPlayerId) {
        scoreMap[guess.playerId] = (scoreMap[guess.playerId] || 0) + scoring.correctGuess;
      }
    }
  }

  // 互換維持のため設定キー noOneGuessedMine は残す。
  // 現ルールでは「親役に自分らしい選曲として正しく見抜かれた提出曲」に加点する。
  for (const submission of submissions) {
    const ownerId = submission.playerId;
    const guessedByParent = guesses.some((guess) =>
      guess.answers.some(
        (answer) =>
          answer.submissionId === submission.id && answer.guessedPlayerId === ownerId,
      ),
    );

    if (guessedByParent) {
      scoreMap[ownerId] = (scoreMap[ownerId] || 0) + scoring.noOneGuessedMine;
    }
  }

  if (bonusWinnerSubmissionId) {
    const winnerSubmission = submissions.find((submission) => submission.id === bonusWinnerSubmissionId);
    if (winnerSubmission) {
      scoreMap[winnerSubmission.playerId] =
        (scoreMap[winnerSubmission.playerId] || 0) + scoring.bestSubmissionBonus;
    }
  }

  return scoreMap;
};
