import type { Submission } from '../types';

const normalizeSongName = (songName: string): string => songName.trim();

export const getEquivalentSubmissions = (
  submission: Pick<Submission, 'songName'>,
  submissions: Submission[],
): Submission[] => {
  const normalizedSongName = normalizeSongName(submission.songName);
  return submissions.filter((candidate) => normalizeSongName(candidate.songName) === normalizedSongName);
};

export const isGuessCorrectForSubmission = (
  submission: Submission,
  guessedPlayerId: string | undefined,
  submissions: Submission[],
): boolean => {
  if (!guessedPlayerId) {
    return false;
  }

  return getEquivalentSubmissions(submission, submissions).some(
    (candidate) => candidate.playerId === guessedPlayerId,
  );
};

export const isDuplicateSubmissionGroup = (
  submission: Submission,
  submissions: Submission[],
): boolean => getEquivalentSubmissions(submission, submissions).length > 1;

export const getNormalizedGuessedPlayerIdForSubmission = (
  submission: Submission,
  guessedPlayerId: string | undefined,
  submissions: Submission[],
): string | undefined => {
  if (!guessedPlayerId) {
    return undefined;
  }

  return isGuessCorrectForSubmission(submission, guessedPlayerId, submissions)
    ? submission.playerId
    : guessedPlayerId;
};
