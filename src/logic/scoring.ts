import type { Submission, Guess, Player, RoomSettings } from "../types";

/**
 * 採点ロジックを実行し、各プレイヤーのスコア増分を計算します。
 */
export const calculateScores = (
  players: Player[],
  submissions: Submission[],
  guesses: Guess[],
  scoring: RoomSettings['scoring'],
  bonusWinnerSubmissionId?: string
): Record<string, number> => {
  const scoreMap: Record<string, number> = {};

  // 全プレイヤーのスコア増分を初期化
  players.forEach(p => scoreMap[p.id] = 0);

  // 1. 推理的中ボーナス
  guesses.forEach(guess => {
    const playerWhoGuessed = guess.playerId;
    guess.answers.forEach(answer => {
      const targetSubmission = submissions.find(s => s.id === answer.submissionId);
      if (targetSubmission && targetSubmission.playerId === answer.guessedPlayerId) {
        // 正解
        scoreMap[playerWhoGuessed] = (scoreMap[playerWhoGuessed] || 0) + scoring.correctGuess;
      }
    });
  });

  // 2. 「自分の曲を誰にも当てられなかった」ボーナス
  submissions.forEach(submission => {
    const ownerId = submission.playerId;
    const isGuessedByAnyone = guesses.some(guess => 
      guess.playerId !== ownerId && // 自分自身による予想は除外
      guess.answers.some(a => a.submissionId === submission.id && a.guessedPlayerId === ownerId)
    );

    if (!isGuessedByAnyone) {
      scoreMap[ownerId] = (scoreMap[ownerId] || 0) + scoring.noOneGuessedMine;
    }
  });

  // 3. お題に合っている一番の曲ボーナス（主催者選出）
  if (bonusWinnerSubmissionId) {
    const winnerSubmission = submissions.find(s => s.id === bonusWinnerSubmissionId);
    if (winnerSubmission) {
      const winnerId = winnerSubmission.playerId;
      scoreMap[winnerId] = (scoreMap[winnerId] || 0) + scoring.bestSubmissionBonus;
    }
  }

  return scoreMap;
};
