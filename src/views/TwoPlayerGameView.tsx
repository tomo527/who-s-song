import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { Layout } from '../components/Layout';
import { getRandomPrompt } from '../constants/prompts';
import {
  fetchPlayerGuess,
  judgeTextGuess,
  submitSong,
  submitTextGuess,
  subscribePlayerGuess,
  subscribeSubmissions,
  updateRoundPhase,
  updateRoundTheme,
} from '../firebase/game';
import type { Guess, Player, Round, Submission, TimeLimitSetting } from '../types';

interface TwoPlayerGameViewProps {
  roomId: string;
  roundId: string;
  playerId: string;
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

export const TwoPlayerGameView: React.FC<TwoPlayerGameViewProps> = ({
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
  const [textAnswer, setTextAnswer] = useState('');
  const [guess, setGuess] = useState<Guess | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const isParent = round?.parentPlayerId === playerId;
  const otherPlayer = useMemo(
    () => players.find((player) => player.id !== round?.parentPlayerId) ?? null,
    [players, round?.parentPlayerId],
  );

  useEffect(() => {
    setDraftTheme(round?.theme?.trim() ? round.theme : getRandomPrompt());
  }, [roundId, round?.theme]);

  useEffect(() => {
    setSongName('');
    setComment('');
    setTextAnswer('');
    setGuess(null);
    setError('');

    const unsubscribeSubmissions = subscribeSubmissions(roomId, roundId, (nextSubmissions) => {
      setSubmissions(nextSubmissions);

      const mySubmission = nextSubmissions.find((submission) => submission.playerId === playerId);
      if (mySubmission) {
        setSongName(mySubmission.songName);
        setComment(mySubmission.comment || '');
      }
    });

    return () => unsubscribeSubmissions();
  }, [playerId, roomId, roundId]);

  useEffect(() => {
    if (!round?.parentPlayerId) {
      setGuess(null);
      return;
    }

    const canReadGuess = isParent || round.phase === 'judging' || round.phase === 'revealing';
    if (!canReadGuess) {
      setGuess(null);
      return;
    }

    return subscribePlayerGuess(roomId, roundId, round.parentPlayerId, (nextGuess) => {
      setGuess(nextGuess);
      if (nextGuess?.textAnswer) {
        setTextAnswer(nextGuess.textAnswer);
      }
    });
  }, [isParent, roomId, round?.parentPlayerId, round?.phase, roundId]);

  useEffect(() => {
    if (!round?.parentPlayerId || isParent || round.phase !== 'judging' || guess?.textAnswer?.trim()) {
      return;
    }

    let cancelled = false;
    let retryId: number | null = null;

    const loadGuess = async (attempt = 0) => {
      try {
        const nextGuess = await fetchPlayerGuess(roomId, roundId, round.parentPlayerId);
        if (cancelled) {
          return;
        }

        if (nextGuess?.textAnswer?.trim()) {
          setGuess(nextGuess);
          setTextAnswer(nextGuess.textAnswer);
          return;
        }
      } catch {
        // onSnapshot を主としつつ、初回同期が間に合わないケースだけを補います。
      }

      if (cancelled || attempt >= 8) {
        return;
      }

      retryId = window.setTimeout(() => {
        void loadGuess(attempt + 1);
      }, 400);
    };

    void loadGuess();

    return () => {
      cancelled = true;
      if (retryId !== null) {
        window.clearTimeout(retryId);
      }
    };
  }, [guess?.textAnswer, isParent, roomId, round?.parentPlayerId, round?.phase, roundId]);

  const submission = submissions[0] ?? null;
  const hasSubmitted = Boolean(submissions.find((candidate) => candidate.playerId === playerId));
  const isThemeReady = Boolean(round?.theme?.trim());
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

      return {
        label: '提出時間の目安',
        startedAtMs: themeStartedAtMs,
        durationSeconds: submitTimeLimit,
      };
    }

    if (round.phase === 'guessing') {
      const startedAtMs = toMillis((round as Round & { phaseStartedAt?: unknown }).phaseStartedAt ?? round.startedAt);
      if (startedAtMs == null || guessTimeLimit == null) {
        return null;
      }

      return { label: '親推理時間の目安', startedAtMs, durationSeconds: guessTimeLimit };
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
  const judgingAnswer = round?.textAnswer?.trim() || guess?.textAnswer?.trim() || textAnswer.trim();
  const isJudgingAnswerReady = Boolean(judgingAnswer);

  useEffect(() => {
    if (!countdownConfig) {
      return;
    }

    setNow(Date.now());
    const timerId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [countdownConfig]);

  const handleConfirmTheme = async () => {
    if (!isParent || round?.phase !== 'submitting' || !draftTheme.trim()) {
      return;
    }

    setLoading(true);
    setError('');
    try {
      await updateRoundTheme(roomId, roundId, playerId, draftTheme.trim());
    } catch (themeError) {
      setError(
        themeError instanceof Error
          ? themeError.message
          : 'お題の保存に失敗しました。時間をおいてもう一度試してください。',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitSong = async () => {
    if (!songName.trim() || isParent) {
      return;
    }

    setLoading(true);
    setError('');
    try {
      await submitSong(roomId, roundId, playerId, songName.trim(), comment.trim());
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : '提出に失敗しました。時間をおいてもう一度試してください。',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleStartGuessing = async () => {
    if (!isParent || !submission || round?.phase !== 'submitting') {
      return;
    }

    setLoading(true);
    setError('');
    try {
      await updateRoundPhase(roomId, roundId, 'guessing');
    } catch (phaseError) {
      setError(
        phaseError instanceof Error
          ? phaseError.message
          : '回答フェーズへの移行に失敗しました。時間をおいてもう一度試してください。',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitTextGuess = async () => {
    if (!isParent || !textAnswer.trim() || round?.phase !== 'guessing') {
      return;
    }

    setLoading(true);
    setError('');
    try {
      await submitTextGuess(roomId, roundId, playerId, textAnswer.trim());
    } catch (guessError) {
      setError(
        guessError instanceof Error
          ? guessError.message
          : '回答の送信に失敗しました。時間をおいてもう一度試してください。',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleJudge = async (isCorrect: boolean) => {
    if (isParent || round?.phase !== 'judging') {
      return;
    }

    setLoading(true);
    setError('');
    try {
      await judgeTextGuess(roomId, roundId, playerId, isCorrect);
    } catch (judgeError) {
      setError(
        judgeError instanceof Error
          ? judgeError.message
          : '判定の保存に失敗しました。時間をおいてもう一度試してください。',
      );
    } finally {
      setLoading(false);
    }
  };

  if (!round) {
    return (
      <Layout title="ゲーム">
        <Card className="py-10 text-center">
          <h2 className="text-xl font-semibold text-slate-900">ラウンド情報を読み込み中です</h2>
          <p className="mt-2 text-sm text-slate-600">画面を最新状態に合わせています。</p>
        </Card>
      </Layout>
    );
  }

  if (round.phase === 'submitting' && !isThemeReady) {
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
                  親がお題を決めると、相手が曲を提出するフェーズへ進みます。
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
                    <h4 className="mt-2 text-xl font-semibold text-slate-900">このターンのお題を決めます</h4>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      確定後、相手がこのお題に合う曲を1曲提出します。
                    </p>
                  </div>
                  <Button type="button" variant="secondary" fullWidth onClick={() => setDraftTheme(() => getRandomPrompt())}>
                    ランダムなお題を表示
                  </Button>
                  <Input
                    tone="light"
                    label="今回のお題"
                    placeholder="例: ドライブで聴きたい曲"
                    value={draftTheme}
                    onChange={(event) => setDraftTheme(event.target.value)}
                    helperText="ここで決めたお題が、このターンの提出条件になります。"
                  />
                  {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
                  <Button size="xl" fullWidth isLoading={loading} disabled={!draftTheme.trim()} onClick={handleConfirmTheme}>
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
                    {players.find((player) => player.id === round.parentPlayerId)?.name || '親'} がお題を設定すると、提出フォームに切り替わります。
                  </p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </Layout>
    );
  }

  if (round.phase === 'submitting') {
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
              親以外の1人が、このお題に合う曲を1曲提出します。
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
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent-500">親の待機</p>
                <h4 className="mt-2 text-xl font-semibold text-slate-900">
                  {otherPlayer?.name || '相手'} の提出を待っています
                </h4>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  提出が届いたら、相手がどの曲を出したかを自由記述で当てるフェーズに進みます。
                </p>
              </div>
              <div className="rounded-2xl border-2 border-accent-300 bg-white px-4 py-4">
                <p className="text-sm font-medium text-slate-600">提出状況</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{submission ? '提出済み' : '未提出'}</p>
              </div>
              {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
              {submission && (
                <Button size="lg" fullWidth isLoading={loading} onClick={handleStartGuessing}>
                  推理フェーズを始める
                </Button>
              )}
            </Card>
          ) : !hasSubmitted ? (
            <Card className={flatCardClass}>
              <div className="space-y-5">
                <div className="space-y-1">
                  <h4 className="text-xl font-semibold text-slate-900">曲を提出する</h4>
                  <p className="text-sm leading-6 text-slate-600">
                    このお題に合う曲を1曲だけ提出します。親にはまだ曲名は見えません。
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
                {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
                <Button size="lg" fullWidth isLoading={loading} onClick={handleSubmitSong}>
                  この曲で提出する
                </Button>
              </div>
            </Card>
          ) : (
            <Card className={`${successCardClass} py-10 text-center`}>
              <h4 className="text-2xl font-semibold text-slate-900">提出できました</h4>
              <p className="mt-3 text-sm leading-6 text-slate-600">親が回答フェーズへ進むまで、このまま待機してください。</p>
            </Card>
          )}
        </div>
      </Layout>
    );
  }

  if (round.phase === 'guessing') {
    if (!isParent) {
      return (
        <Layout title="親の回答待ち">
          <Card className={`${flatCardClass} py-12 text-center`}>
            <h3 className="text-2xl font-semibold text-slate-900">親が曲名を考えています</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {players.find((player) => player.id === round.parentPlayerId)?.name || '親'} が、あなたの提出曲を自由記述で当てています。
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
      <Layout title="曲名を当てる">
        <div className="space-y-6">
          <Card className={`${accentCardClass} py-6`}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent-500">Guess Phase</p>
            <p className="mt-2 text-xs text-slate-500">ジャンル {roomGenre || '未設定'}</p>
            <h3 className="mt-3 text-2xl font-semibold text-slate-950">{round.theme}</h3>
            <p className="mt-2 text-sm text-slate-600">
              相手がこのお題で提出した曲名を、自由記述で当ててください。
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

          <Card className={flatCardClass}>
            <div className="space-y-5">
              <Input
                tone="light"
                label="相手が提出した曲名"
                placeholder="思い当たる曲名を入力してください"
                helperText="完全一致の自動判定は行わず、提出者が正解かどうかを判定します。"
                value={textAnswer}
                onChange={(event) => setTextAnswer(event.target.value)}
              />
              {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
              <Button
                size="lg"
                fullWidth
                variant="primary"
                disabled={!textAnswer.trim() || loading}
                isLoading={loading}
                onClick={handleSubmitTextGuess}
              >
                この回答で送信する
              </Button>
            </div>
          </Card>
        </div>
      </Layout>
    );
  }

  if (round.phase === 'judging') {
    if (isParent) {
      return (
        <Layout title="判定待ち">
          <Card className={`${flatCardClass} py-12 text-center`}>
            <h3 className="text-2xl font-semibold text-slate-900">提出者が回答を確認しています</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              あなたの回答「{judgingAnswer || '送信した回答を読み込み中です'}」が正解かどうか、相手が判定しています。
            </p>
          </Card>
        </Layout>
      );
    }

    return (
      <Layout title="正誤を判定">
        <div className="space-y-6">
          <Card className={`${primaryCardClass} space-y-4`}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Judge Answer</p>
            <h3 className="text-2xl font-semibold text-slate-950">親の回答が正しいか判定してください</h3>
            <p className="text-sm leading-6 text-slate-600">
              曲名の表記ゆれや略称も含めて、人間の判断で正解 / 不正解を決めます。
            </p>
          </Card>

          <Card className={flatCardClass}>
            <div className="space-y-4">
              <div className="rounded-2xl border-2 border-slate-300 bg-white px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Submitted Song</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{submission?.songName || '未提出'}</p>
              </div>
              <div className="rounded-2xl border-2 border-slate-300 bg-white px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">親の回答</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {isJudgingAnswerReady ? judgingAnswer : '親の回答を読み込んでいます'}
                </p>
              </div>
              {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  size="lg"
                  fullWidth
                  isLoading={loading}
                  disabled={!isJudgingAnswerReady || loading}
                  onClick={() => void handleJudge(true)}
                >
                  正解にする
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  fullWidth
                  isLoading={loading}
                  disabled={!isJudgingAnswerReady || loading}
                  onClick={() => void handleJudge(false)}
                >
                  不正解にする
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="結果表示">
      <Card className={`${flatCardClass} py-12 text-center`}>
        <h3 className="text-2xl font-semibold text-slate-900">結果表示へ移動しています</h3>
        <p className="mt-3 text-sm leading-6 text-slate-600">結果画面へ切り替わるまで、そのままお待ちください。</p>
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
