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
import type { GuessAnswer, Player, Round, Submission } from '../types';

interface GameViewProps {
  roomId: string;
  roundId: string;
  playerId: string;
  isHost: boolean;
  roomGenre: string;
  round: Round | null;
  players: Player[];
}

export const GameView: React.FC<GameViewProps> = ({ roomId, roundId, playerId, roomGenre, round, players }) => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [draftTheme, setDraftTheme] = useState(() => getRandomPrompt());
  const [songName, setSongName] = useState('');
  const [comment, setComment] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isGuessSubmitted, setIsGuessSubmitted] = useState(false);
  const [guesses, setGuesses] = useState<GuessAnswer[]>([]);
  const [loading, setLoading] = useState(false);

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
          <div className="mx-auto mb-4 h-12 w-12 rounded-2xl border border-white/10 bg-white/10" />
          <h2 className="text-xl font-semibold text-white">ラウンド情報を読み込んでいます</h2>
          <p className="mt-2 text-sm text-slate-300">ゲームの状態を同期しています。</p>
        </Card>
      </Layout>
    );
  }

  if (round.phase === 'submitting') {
    if (!isThemeReady) {
      const flatCardClass = 'border-slate-400/70 bg-white shadow-none hover:border-slate-400/70 hover:bg-white';

      return (
        <Layout title="お題を決める">
          <div className="space-y-5 pb-10 text-slate-900">
            <Card className={flatCardClass}>
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Theme Setup</p>
                <h3 className="text-2xl font-semibold text-slate-900">このターンのお題を決めます</h3>
                <p className="text-sm leading-6 text-slate-600">
                  ジャンルは <span className="font-semibold text-slate-900">{roomGenre || '未設定'}</span> です。
                  親がお題を確定したあと、非親プレイヤーの提出フェーズが始まります。
                </p>
              </div>
            </Card>

            {isParent ? (
              <Card className="border-accent-300 bg-white shadow-none hover:border-accent-300 hover:bg-white">
                <div className="space-y-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent-500">Parent Controls</p>
                    <h4 className="mt-2 text-xl font-semibold text-slate-900">{parentPlayer?.name || '親'} がこのターンのお題を決めます</h4>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      ランダム候補を見ながら自由入力でも決められます。確定後にそのまま提出画面へ進みます。
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    fullWidth
                    onClick={() => setDraftTheme((current) => getRandomPrompt(current))}
                  >
                    ランダムなお題を表示
                  </Button>
                  <Input
                    tone="light"
                    label="このターンのお題"
                    placeholder="例: ドライブで聴きたい曲"
                    value={draftTheme}
                    onChange={(event) => setDraftTheme(event.target.value)}
                    helperText="確定したお題だけがこのターンの参加者全員に表示されます"
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
                      ? `${parentPlayer.name} さんがお題を確定すると、あなたの曲提出フォームが表示されます。`
                      : '親プレイヤー情報を読み込み中です。'}
                  </p>
                </div>
              </Card>
            )}
          </div>
        </Layout>
      );
    }

    return (
      <Layout title="曲を提出">
        <div className="space-y-8">
          <Card className="overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-primary-500/30 via-accent-400/20 to-transparent blur-2xl" />
            <div className="relative space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary-400/30 bg-primary-500/15 px-3 py-1 text-[11px] font-semibold tracking-[0.24em] text-primary-100 uppercase">
                Submit Phase
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  ジャンル {roomGenre || '未設定'}
                </p>
                <p className="text-sm font-medium text-slate-300">今回のお題</p>
                <h3 className="mt-2 text-3xl font-semibold leading-tight text-white">{round.theme}</h3>
              </div>
              <p className="max-w-xl text-sm leading-6 text-slate-300">
                親役は提出を待ち、親以外のプレイヤーが1曲ずつ匿名で提出します。
              </p>
            </div>
          </Card>

          {isParent ? (
            <Card className="space-y-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent-100">Parent Role</p>
                <h4 className="mt-2 text-xl font-semibold text-white">
                  {parentPlayer?.name || '親役'}は提出せず、みんなの曲が揃うのを待ちます
                </h4>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  全員分が揃ったら、親役だけが匿名曲の提出者を推理します。
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-sm font-medium text-slate-300">進行状況</p>
                <p className="mt-2 text-lg font-semibold text-white">
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
              <Card className="space-y-5">
                <div className="space-y-1">
                  <h4 className="text-xl font-semibold text-white">匿名で曲を提出</h4>
                  <p className="text-sm leading-6 text-slate-300">
                    曲名は全員分が揃うまで伏せたままです。コメントは任意で添えられます。
                  </p>
                </div>
                <Input
                  label="曲名"
                  placeholder="例: 夜に駆ける"
                  value={songName}
                  onChange={(event) => setSongName(event.target.value)}
                />
                <Input
                  label="ひとこと"
                  placeholder="任意。あとで結果画面に表示されます"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                />
                <Button size="lg" fullWidth isLoading={loading} onClick={handleSubmitSong}>
                  この曲で提出する
                </Button>
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
              <Card className="py-10 text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[2rem] border border-emerald-400/30 bg-emerald-400/15 text-emerald-200">
                  <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </div>
                <h4 className="mt-6 text-2xl font-semibold text-white">提出できました</h4>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  親役が推理フェーズを始めるまで、このまま待機してください。
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
          <Card className="py-12 text-center">
            <h3 className="text-2xl font-semibold text-white">親役が推理中です</h3>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              {parentPlayer?.name || '親役'}が匿名曲の提出者を割り当てています。少しお待ちください。
            </p>
          </Card>
        </Layout>
      );
    }

    return (
      <Layout title="推理タイム">
        <div className="space-y-6">
          <Card className="overflow-hidden py-6">
            <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-r from-accent-400/25 via-primary-500/20 to-transparent blur-2xl" />
            <div className="relative">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent-100">Guess Phase</p>
              <p className="mt-2 text-xs text-slate-400">ジャンル {roomGenre || '未設定'}</p>
              <h3 className="mt-3 text-2xl font-semibold text-white">{round.theme}</h3>
              <p className="mt-2 text-sm text-slate-300">
                親役だけが、匿名で並んだ曲を見て提出者を割り当てます。
              </p>
            </div>
          </Card>

          <div className="text-center space-y-1">
            <h3 className="text-xl font-semibold tracking-tight text-white">誰がどの曲を出したか当ててください</h3>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400">
              親役自身は候補に出ず、同じ人を複数の曲に割り当てることもできません
            </p>
          </div>

          {isGuessSubmitted ? (
            <Card className="py-10 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[2rem] border border-emerald-400/30 bg-emerald-400/15 text-emerald-200">
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <h4 className="mt-6 text-2xl font-semibold text-white">推理を送信しました</h4>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                内容を確認したら、結果発表に進めます。
              </p>
              <Button
                variant="ghost"
                fullWidth
                className="mt-6"
                onClick={() => void updateRoundPhase(roomId, roundId, 'revealing')}
              >
                結果発表へ進む
              </Button>
            </Card>
          ) : (
            <>
              <div className="space-y-4">
                {submissions.map((submission, index) => (
                  <Card key={submission.id} className="space-y-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 flex-none items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-sm font-semibold text-slate-200">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="break-words text-xl font-semibold text-white">{submission.songName}</p>
                        {submission.comment && (
                          <p className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm italic leading-relaxed text-slate-300">
                            "{submission.comment}"
                          </p>
                        )}
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
                              rounded-2xl border px-3 py-3 text-left text-sm font-medium transition
                              ${isSelected ? 'border-primary-400/50 bg-primary-500/20 text-white shadow-[0_16px_40px_rgba(56,130,246,0.22)]' : 'border-white/10 bg-white/5 text-slate-200'}
                              ${isAssignedElsewhere ? 'opacity-25' : 'hover:border-primary-300/40 hover:bg-white/10 active:scale-[0.98]'}
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
    <Layout title="結果発表">
      <Card className="py-12 text-center">
        <h3 className="text-2xl font-semibold text-white">結果発表へ移動します</h3>
        <p className="mt-3 text-sm leading-6 text-slate-300">親役が結果画面に進めると、このまま自動で同期されます。</p>
      </Card>
    </Layout>
  );
};

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
    <Card className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-300">進行状況</p>
          <h4 className="text-lg font-semibold text-white">
            {submissions.length} / {requiredCount} 人が提出済み
          </h4>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-right">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Status</p>
          <p className="text-lg font-semibold text-white">
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
              className={`rounded-2xl border px-3 py-4 text-center transition ${
                isParent
                  ? 'border-accent-300/40 bg-accent-400/12 text-accent-100'
                  : hasSubmitted
                    ? 'border-emerald-400/40 bg-emerald-400/12 text-emerald-100'
                    : 'border-white/10 bg-white/5 text-slate-300'
              }`}
            >
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-sm font-semibold">
                {isParent ? '親' : hasSubmitted ? '✓' : player.name.charAt(0)}
              </div>
              <p className="mt-2 truncate text-xs font-medium">{player.name}</p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
