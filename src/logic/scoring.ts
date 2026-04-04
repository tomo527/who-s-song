import type { Guess, Player, RoomMode, RoomSettings, Submission } from '../types';
import { isGuessCorrectForSubmission } from './guessEvaluation';

export const calculateScores = (
  players: Player[],
  submissions: Submission[],
  guesses: Guess[],
  scoring: RoomSettings['scoring'],
  mode: RoomMode = 'standard',
): Record<string, number> => {
  const scoreMap: Record<string, number> = {};

  for (const player of players) {
    scoreMap[player.id] = 0;
  }

  if (mode === 'duo') {
    for (const guess of guesses) {
      const targetSubmission = submissions.find(
        (submission) => submission.roundId === guess.roundId && submission.playerId !== guess.playerId,
      );

      if (!targetSubmission || guess.isTextAnswerCorrect !== true) {
        continue;
      }

      scoreMap[guess.playerId] = (scoreMap[guess.playerId] || 0) + scoring.correctGuess;
      scoreMap[targetSubmission.playerId] =
        (scoreMap[targetSubmission.playerId] || 0) + scoring.noOneGuessedMine;
    }

    return scoreMap;
  }

  for (const guess of guesses) {
    for (const answer of guess.answers) {
      const targetSubmission = submissions.find((submission) => submission.id === answer.submissionId);
      if (targetSubmission && isGuessCorrectForSubmission(targetSubmission, answer.guessedPlayerId, submissions)) {
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
        (answer) => answer.submissionId === submission.id
          && isGuessCorrectForSubmission(submission, answer.guessedPlayerId, submissions),
      ),
    );

    if (guessedByParent) {
      scoreMap[ownerId] = (scoreMap[ownerId] || 0) + scoring.noOneGuessedMine;
    }
  }

  return scoreMap;
};
