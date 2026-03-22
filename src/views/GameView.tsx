import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { Layout } from '../components/Layout';
import { getRandomPrompt } from '../constants/prompts';
import {
  subscribePlayerGuess,
  subscribeSubmissions,
  submitGuess,
  submitSong,
  updateRoundPhase,
  updateRoundTheme,
} from '../firebase/game';
import { getSubmittingPlayers } from '../logic/parentRotation';
import type { GuessAnswer, Player, Round, Submission, TimeLimitSetting } from '../types';

interface GameViewProps {
  roomId: string;
  roundId: string;
  playerId: string;
  isHost: boolean;
  roomGenre: string;
  themeTimeLimit: TimeLimitSetting;
  submitTimeLimit: TimeLimitSetting;
  guessTimeLimit: TimeLimitSetting;
  round: Round | null;
  players: Player[];
}

type FirestoreTimestampLike = {
  toMillis: () => number;
};

const panelClass = 'rounded-[2rem] border-2 border-slate-600/40 bg-white p-5 text-slate-900';
const flatCardClass = 'border-2 border-slate-600/40 bg-slate-100 shadow-none hover:border-slate-600/40 hover:bg-slate-100';
const primaryCardClass = 'border-2 border-primary-400 bg-primary-50 shadow-none hover:border-primary-400 hover:bg-primary-50';
const accentCardClass = 'border-2 border-accent-500 bg-accent-50 shadow-none hover:border-accent-500 hover:bg-accent-50';
const successCardClass = 'border-2 border-emerald-400 bg-emerald-50 shadow-none hover:border-emerald-400 hover:bg-emerald-50';

const toMillis = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return value;
  }

  if (
    value
    && typeof value === 'object'
    && 'toMillis' in value
    && typeof (value as FirestoreTimestampLike).toMillis === 'function'
  ) {
    return (value as FirestoreTimestampLike).toMillis();
  }

  return null;
};

const formatCountdown = (remainingSeconds: number): string => {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export const GameView: React.FC<GameViewProps> = ({
  roomId,
  roundId,
  playerId,
  roomGenre,
  themeTimeLimit,
  submitTimeLimit,
  guessTimeLimit,
  round,
  players,
}) => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [draftTheme, setDraftTheme] = useState(() => getRandomPrompt());
  const [songName, setSongName] = useState('');
  const [comment, setComment] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isGuessSubmitted, setIsGuessSubmitted] = useState(false);
  const [guesses, setGuesses] = useState<GuessAnswer[]>([]);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setDraftTheme(round?.theme?.trim() ? round.theme : getRandomPrompt());
  }, [roundId, round?.theme]);

  useEffect(() => {
    setSongName('');
    setComment('');
    setIsSubmitted(false);
    setIsGuessSubmitted(false);
    setGuesses([]);

    const unsubscribeSubmissions = subscribeSubmissions(roomId, roundId, (nextSubmissions) => {
      setSubmissions(nextSubmissions);

      const mySubmission = nextSubmissions.find((submission) => submission.playerId === playerId);
      if (mySubmission) {
        setIsSubmitted(true);
        setSongName(mySubmission.songName);
        setComment(mySubmission.comment || '');
      }
    });

    return () => {
      unsubscribeSubmissions();
    };
  }, [playerId, roomId, roundId]);

  useEffect(() => {
    if (round?.parentPlayerId !== playerId || round.phase !== 'guessing') {
      return;
    }

    return subscribePlayerGuess(roomId, roundId, playerId, (guess) => {
      if (guess?.answers) {
        setGuesses(guess.answers);
        setIsGuessSubmitted(true);
      }
    });
  }, [playerId, roomId, roundId, round?.parentPlayerId, round?.phase]);

  const isParent = round?.parentPlayerId === playerId;
  const submittingPlayers = useMemo(
    () => getSubmittingPlayers(players, round?.parentPlayerId),
    [players, round?.parentPlayerId],
  );
  const guessCandidates = submittingPlayers;
  const allRequiredSubmissionsIn = submissions.length === submittingPlayers.length;
  const isThemeReady = Boolean(round?.theme?.trim());
  const parentPlayer = players.find((player) => player.id === round?.parentPlayerId);
  const countdownConfig = useMemo(() => {
    if (!round) {
      return null;
    }

    if (round.phase === 'submitting') {
      const themeStartedAtMs = toMillis((round as Round & { phaseStartedAt?: unknown }).phaseStartedAt ?? round.startedAt);
      if (themeStartedAtMs == null) {
        return null;
      }

      if (!isThemeReady) {
        return themeTimeLimit == null
          ? null
          : { label: '親お題選択時間', startedAtMs: themeStartedAtMs, durationSeconds: themeTimeLimit };
      }

      if (submitTimeLimit == null) {
        return null;
      }

      const startedAtMs = toMillis((round as Round & { phaseStartedAt?: unknown }).phaseStartedAt ?? round.startedAt);
      return startedAtMs == null
        ? null
        : { label: '提出時間の目安', startedAtMs, durationSeconds: submitTimeLimit };
    }

    if (round.phase === 'guessing') {
      if (guessTimeLimit == null) {
        return null;
      }

      const startedAtMs = toMillis((round as Round & { phaseStartedAt?: unknown }).phaseStartedAt ?? round.startedAt);
      return startedAtMs == null
        ? null
        : { label: '親推理時間の目安', startedAtMs, durationSeconds: guessTimeLimit };
    }

    return null;
  }, [guessTimeLimit, isThemeReady, round, submitTimeLimit, themeTimeLimit]);
  const countdownState = useMemo(() => {
    if (!countdownConfig) {
      return null;
    }

    const elapsedSeconds = Math.max(0, Math.floor((now - countdownConfig.startedAtMs) / 1000));
    const remainingSeconds = Math.max(countdownConfig.durationSeconds - elapsedSeconds, 0);

    return {
      label: countdownConfig.label,
      remainingSeconds,
      expired: elapsedSeconds >= countdownConfig.durationSeconds,
    };
  }, [countdownConfig, now]);

  useEffect(() => {
    if (!countdownConfig) {
      return;
    }

    setNow(Date.now());
    const timerId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [countdownConfig]);

  const handleSubmitSong = async () => {
    if (!songName.trim() || isParent) {
      return;
    }

    setLoading(true);
    try {
      await submitSong(roomId, roundId, playerId, songName.trim(), comment.trim());
      setIsSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmTheme = async () => {
    if (!isParent || round?.phase !== 'submitting' || !draftTheme.trim()) {
      return;
    }

    setLoading(true);
    try {
      await updateRoundTheme(roomId, roundId, playerId, draftTheme.trim());
    } finally {
      setLoading(false);
    }
  };

  const handleAssignGuess = (submissionId: string, guessedPlayerId: string) => {
    setGuesses((previousGuesses) => {
      const filtered = previousGuesses.filter((guess) => guess.submissionId !== submissionId);
      const currentGuess = previousGuesses.find((guess) => guess.submissionId === submissionId);

      if (currentGuess?.guessedPlayerId === guessedPlayerId) {
        return filtered;
      }

      return [...filtered, { submissionId, guessedPlayerId }];
    });
  };

  const handleSubmitGuesses = async () => {
    if (!isParent || guesses.length < submissions.length) {
      return;
    }

    setLoading(true);
    try {
      await submitGuess(roomId, roundId, playerId, guesses);
      setIsGuessSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  if (!round) {
    return (
      <Layout title="ゲーム">
        <Card className="py-10 text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-2xl border-2 border-slate-300 bg-slate-100" />
          <h2 className="text-xl font-semibold text-slate-900">ラウンド情報を読み込み中です</h2>
          <p className="mt-2 text-sm text-slate-600">画面を最新状態に合わせています。</p>
        </Card>
      </Layout>
    );
  }

  if (round.phase === 'submitting') {
    if (!isThemeReady) {
      return (
        <Layout title="お題を決める">
          <div className={panelClass}>
            <div className="space-y-5">
              <Card className={flatCardClass}>
                <div className="space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Theme Setup</p>
                  <h3 className="text-2xl font-semibold text-slate-900">このターンのお題を決めます</h3>
                  <p className="text-sm leading-6 text-slate-600">
                    ジャンルは <span className="font-semibold text-slate-900">{roomGenre || '未設定'}</span> です。
                    親が今回のお題を決めると、提出フェーズが始まります。
                  </p>
                  {countdownState && (
                    <CountdownNotice
                      label={countdownState.label}
                      remainingSeconds={countdownState.remainingSeconds}
                      expired={countdownState.expired}
                    />
                  )}
                </div>
              </Card>

              {isParent ? (
                <Card className={accentCardClass}>
                  <div className="space-y-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent-500">Game Master Controls</p>
                      <h4 className="mt-2 text-xl font-semibold text-slate-900">
                        {parentPlayer?.name || '親'} がこのターンのお題を決めます
                      </h4>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        ランダム候補を見ながら自由入力でも決められます。確定後に提出画面へ進みます。
                      </p>
                    </div>
                      <Button
                        type="button"
                        variant="secondary"
                        fullWidth
                        onClick={() => setDraftTheme(() => getRandomPrompt())}
                      >
                        ランダムなお題を表示
                      </Button>
                    <Input
                      tone="light"
                      label="今回のお題"
                      placeholder="例: ドライブで聴きたい曲"
                      value={draftTheme}
                      onChange={(event) => setDraftTheme(event.target.value)}
                      helperText="ここで決めたお題が、このターン全員の提出条件になります。"
                    />
                    <Button
                      size="xl"
                      fullWidth
                      isLoading={loading}
                      disabled={!draftTheme.trim()}
                      onClick={handleConfirmTheme}
                    >
                      お題を確定して提出を始める
                    </Button>
                  </div>
                </Card>
              ) : (
                <Card className={flatCardClass}>
                  <div className="space-y-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Waiting</p>
                    <h4 className="text-xl font-semibold text-slate-900">親がお題を決めるまで待機中です</h4>
                    <p className="text-sm leading-6 text-slate-600">
                      {parentPlayer
                        ? `${parentPlayer.name} さんがお題を設定すると、この画面が提出フォームに切り替わります。`
                        : '親情報を読み込み中です。'}
                    </p>
                    {countdownState && (
                      <CountdownNotice
                        label={countdownState.label}
                        remainingSeconds={countdownState.remainingSeconds}
                        expired={countdownState.expired}
                      />
                    )}
                  </div>
                </Card>
              )}
            </div>
          </div>
        </Layout>
      );
    }

    return (
      <Layout title="曲を提出">
        <div className="space-y-8">
          <Card className={`${primaryCardClass} space-y-4`}>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary-600">
              Submit Phase
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                ジャンル {roomGenre || '未設定'}
              </p>
              <p className="text-sm font-medium text-slate-600">今回のお題</p>
              <h3 className="mt-2 text-3xl font-semibold leading-tight text-slate-950">{round.theme}</h3>
            </div>
            <p className="max-w-xl text-sm leading-6 text-slate-600">
              親以外の全員が、このお題に合う曲を匿名で提出します。
            </p>
            {countdownState && (
              <CountdownNotice
                label={countdownState.label}
                remainingSeconds={countdownState.remainingSeconds}
                expired={countdownState.expired}
              />
            )}
          </Card>

          {isParent ? (
            <Card className={`${accentCardClass} space-y-5`}>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent-500">Game Master Role</p>
                <h4 className="mt-2 text-xl font-semibold text-slate-900">
                  {parentPlayer?.name || '親'} は提出せず、みんなの曲がそろうのを待ちます
                </h4>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  全員の提出がそろったら、推理フェーズへ進みます。
                </p>
              </div>
              <div className="rounded-2xl border-2 border-accent-300 bg-white px-4 py-4">
                <p className="text-sm font-medium text-slate-600">提出状況</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {submissions.length} / {submittingPlayers.length} 人が提出済み
                </p>
              </div>
              {allRequiredSubmissionsIn && (
                <Button
                  size="lg"
                  fullWidth
                  onClick={() => void updateRoundPhase(roomId, roundId, 'guessing')}
                >
                  推理フェーズを始める
                </Button>
              )}
            </Card>
          ) : !isSubmitted ? (
            <>
              <Card className={flatCardClass}>
                <div className="space-y-5">
                  <div className="space-y-1">
                    <h4 className="text-xl font-semibold text-slate-900">匿名で曲を提出</h4>
                    <p className="text-sm leading-6 text-slate-600">
                      曲名と、必要なら短いひとことを添えて提出します。
                    </p>
                  </div>
                  <Input
                    tone="light"
                    label="曲名"
                    placeholder="例: 夜に駆ける"
                    value={songName}
                    onChange={(event) => setSongName(event.target.value)}
                  />
                  <Input
                    tone="light"
                    label="ひとこと"
                    placeholder="任意。結果画面で表示されます"
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                  />
                  <Button size="lg" fullWidth isLoading={loading} onClick={handleSubmitSong}>
                    この曲で提出する
                  </Button>
                </div>
              </Card>

              <SubmissionProgressCard
                players={players}
                parentPlayerId={round.parentPlayerId}
                submissions={submissions}
                requiredCount={submittingPlayers.length}
              />
            </>
          ) : (
            <>
              <Card className={`${successCardClass} py-10 text-center`}>
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[2rem] border-2 border-emerald-400 bg-white text-emerald-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </div>
                <h4 className="mt-6 text-2xl font-semibold text-slate-900">提出できました</h4>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  親が推理フェーズを始めるまで、このまま待機してください。
                </p>
              </Card>

              <SubmissionProgressCard
                players={players}
                parentPlayerId={round.parentPlayerId}
                submissions={submissions}
                requiredCount={submittingPlayers.length}
              />
            </>
          )}
        </div>
      </Layout>
    );
  }

  if (round.phase === 'guessing') {
    if (!isParent) {
      return (
        <Layout title="推理タイム">
          <Card className={`${flatCardClass} py-12 text-center`}>
            <h3 className="text-2xl font-semibold text-slate-900">親が推理中です</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {parentPlayer?.name || '親'} が提出曲の持ち主を考えています。結果表示までお待ちください。
            </p>
            {countdownState && (
              <div className="mt-4">
                <CountdownNotice
                  label={countdownState.label}
                  remainingSeconds={countdownState.remainingSeconds}
                  expired={countdownState.expired}
                />
              </div>
            )}
          </Card>
        </Layout>
      );
    }

    return (
      <Layout title="推理タイム">
        <div className="space-y-6">
          <Card className={`${accentCardClass} py-6`}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent-500">Guess Phase</p>
            <p className="mt-2 text-xs text-slate-500">ジャンル {roomGenre || '未設定'}</p>
            <h3 className="mt-3 text-2xl font-semibold text-slate-950">{round.theme}</h3>
            <p className="mt-2 text-sm text-slate-600">
              誰の曲かを1つずつ割り当ててください。同じ人を複数の曲に重ねて選ぶことはできません。
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              確定前なら何度でも選び直せます。同じ名前をもう一度押すと、その選択を解除できます。
            </p>
            {countdownState && (
              <div className="mt-3">
                <CountdownNotice
                  label={countdownState.label}
                  remainingSeconds={countdownState.remainingSeconds}
                  expired={countdownState.expired}
                />
              </div>
            )}
          </Card>

          <div className="space-y-1 text-center">
            <h3 className="text-xl font-semibold tracking-tight text-slate-900">誰の曲かを選んでください</h3>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
              それぞれの曲に1人ずつ割り当てます
            </p>
          </div>

          {isGuessSubmitted ? (
            <Card className={`${successCardClass} py-10 text-center`}>
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[2rem] border-2 border-emerald-400 bg-white text-emerald-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <h4 className="mt-6 text-2xl font-semibold text-slate-900">推理を送信しました</h4>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                準備ができたら結果表示へ進みます。
              </p>
              <Button
                variant="secondary"
                fullWidth
                className="mt-6"
                onClick={() => void updateRoundPhase(roomId, roundId, 'revealing')}
              >
                結果表示へ進む
              </Button>
            </Card>
          ) : (
            <>
              <div className="space-y-4">
                {submissions.map((submission, index) => (
                  <Card
                    key={submission.id}
                    className="space-y-5 border-2 border-slate-400 bg-slate-50 shadow-none hover:border-slate-400 hover:bg-slate-50"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 flex-none items-center justify-center rounded-2xl border-2 border-slate-300 bg-white text-sm font-semibold text-slate-700">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-xl font-semibold text-slate-950">{submission.songName}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      {guessCandidates.map((player) => {
                        const isSelected = guesses.some(
                          (guess) =>
                            guess.submissionId === submission.id && guess.guessedPlayerId === player.id,
                        );
                        const isAssignedElsewhere = guesses.some(
                          (guess) =>
                            guess.submissionId !== submission.id && guess.guessedPlayerId === player.id,
                        );

                        return (
                          <button
                            type="button"
                            key={player.id}
                            disabled={isAssignedElsewhere}
                            onClick={() => handleAssignGuess(submission.id, player.id)}
                            className={`
                              rounded-2xl border-2 px-3 py-3 text-left text-sm font-medium transition
                              ${isSelected ? 'border-primary-500 bg-primary-100 text-slate-900' : 'border-slate-300 bg-white text-slate-700'}
                              ${isAssignedElsewhere ? 'opacity-30' : 'hover:border-primary-300 hover:bg-primary-50 active:scale-[0.98]'}
                            `}
                          >
                            <span className="block font-semibold">{player.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </Card>
                ))}
              </div>

              <div className="pt-6">
                <Button
                  size="lg"
                  fullWidth
                  variant={guesses.length === submissions.length ? 'primary' : 'outline'}
                  disabled={guesses.length < submissions.length || loading}
                  onClick={handleSubmitGuesses}
                >
                  推理を送信する
                </Button>
              </div>
            </>
          )}
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="結果表示">
      <Card className={`${flatCardClass} py-12 text-center`}>
        <h3 className="text-2xl font-semibold text-slate-900">結果表示へ移動しています</h3>
        <p className="mt-3 text-sm leading-6 text-slate-600">親が結果画面へ進めるまで、そのままお待ちください。</p>
      </Card>
    </Layout>
  );
};

function CountdownNotice({
  label,
  remainingSeconds,
  expired,
}: {
  label: string;
  remainingSeconds: number;
  expired: boolean;
}) {
  return (
    <div className="inline-flex flex-col rounded-2xl border-2 border-slate-300 bg-white px-4 py-3 text-left">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <div className="mt-2 flex items-end gap-2">
        <p className="text-2xl font-semibold text-slate-900">{formatCountdown(remainingSeconds)}</p>
        {expired && <span className="text-xs font-semibold text-red-600">目安時間を過ぎています</span>}
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">0になっても自動では進行しません。</p>
    </div>
  );
}

function SubmissionProgressCard({
  players,
  parentPlayerId,
  submissions,
  requiredCount,
}: {
  players: Player[];
  parentPlayerId: string;
  submissions: Submission[];
  requiredCount: number;
}) {
  return (
    <Card className={`${flatCardClass} space-y-4`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-600">提出状況</p>
          <h4 className="text-lg font-semibold text-slate-900">
            {submissions.length} / {requiredCount} 人が提出済み
          </h4>
        </div>
        <div className="rounded-2xl border-2 border-slate-300 bg-white px-3 py-2 text-right">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Status</p>
          <p className="text-lg font-semibold text-slate-900">
            {Math.round((submissions.length / Math.max(requiredCount, 1)) * 100)}%
          </p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {players.map((player) => {
          const isParent = player.id === parentPlayerId;
          const hasSubmitted = submissions.some((submission) => submission.playerId === player.id);

          return (
            <div
              key={player.id}
              className={`rounded-2xl px-3 py-4 text-center transition ${
                isParent
                  ? 'border-2 border-accent-400 bg-accent-100 text-accent-700'
                  : hasSubmitted
                    ? 'border-2 border-emerald-400 bg-emerald-50 text-emerald-700'
                    : 'border-2 border-slate-300 bg-white text-slate-600'
              }`}
            >
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl border-2 border-slate-300 bg-white text-sm font-semibold text-slate-700">
                {isParent ? '親' : hasSubmitted ? '済' : player.name.charAt(0)}
              </div>
              <p className="mt-2 truncate text-xs font-medium">{player.name}</p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
