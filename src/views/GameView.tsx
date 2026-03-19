import React, { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { Layout } from '../components/Layout';
import {
  subscribePlayerGuess,
  subscribeRound,
  subscribeSubmissions,
  submitGuess,
  submitSong,
  updateRoundPhase,
} from '../firebase/game';
import { subscribePlayers } from '../firebase/player';
import type { GuessAnswer, Player, Round, Submission } from '../types';

interface GameViewProps {
  roomId: string;
  roundId: string;
  playerId: string;
  isHost: boolean;
}

export const GameView: React.FC<GameViewProps> = ({ roomId, roundId, playerId, isHost }) => {
  const [round, setRound] = useState<Round | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [songName, setSongName] = useState('');
  const [comment, setComment] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isGuessSubmitted, setIsGuessSubmitted] = useState(false);
  const [guesses, setGuesses] = useState<GuessAnswer[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsubscribeRound = subscribeRound(roomId, roundId, setRound);
    const unsubscribePlayers = subscribePlayers(roomId, setPlayers);
    const unsubscribeSubmissions = subscribeSubmissions(roomId, roundId, (nextSubmissions) => {
      setSubmissions(nextSubmissions);

      const mySubmission = nextSubmissions.find((submission) => submission.playerId === playerId);
      if (mySubmission) {
        setIsSubmitted(true);
        setSongName(mySubmission.songName);
        setComment(mySubmission.comment || '');
      }
    });
    const unsubscribeGuess = subscribePlayerGuess(roomId, roundId, playerId, (guess) => {
      if (guess?.answers) {
        setGuesses(guess.answers);
        setIsGuessSubmitted(true);
      }
    });

    return () => {
      unsubscribeRound();
      unsubscribePlayers();
      unsubscribeSubmissions();
      unsubscribeGuess();
    };
  }, [playerId, roomId, roundId]);

  const handleSubmitSong = async () => {
    if (!songName.trim()) {
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

  const handleAssignGuess = (submissionId: string, guessedPlayerId: string) => {
    setGuesses((previousGuesses) => {
      const filtered = previousGuesses.filter((guess) => guess.submissionId !== submissionId);
      return [...filtered, { submissionId, guessedPlayerId }];
    });
  };

  const handleSubmitGuesses = async () => {
    if (guesses.length < submissions.length) {
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
                <p className="text-sm font-medium text-slate-300">今回のお題</p>
                <h3 className="mt-2 text-3xl font-semibold leading-tight text-white">{round.theme}</h3>
              </div>
              <p className="max-w-xl text-sm leading-6 text-slate-300">
                連想しすぎず、でも自分っぽさは残る一曲を選ぶと盛り上がります。
              </p>
            </div>
          </Card>

          {!isSubmitted ? (
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

              <Card className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-300">進行状況</p>
                    <h4 className="text-lg font-semibold text-white">
                      {submissions.length} / {players.length} 人が提出済み
                    </h4>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-right">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Status</p>
                    <p className="text-lg font-semibold text-white">
                      {Math.round((submissions.length / Math.max(players.length, 1)) * 100)}%
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {players.map((player) => {
                    const hasSubmitted = submissions.some((submission) => submission.playerId === player.id);
                    return (
                      <div
                        key={player.id}
                        className={`rounded-2xl border px-3 py-4 text-center transition ${
                          hasSubmitted
                            ? 'border-emerald-400/40 bg-emerald-400/12 text-emerald-100'
                            : 'border-white/10 bg-white/5 text-slate-300'
                        }`}
                      >
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-sm font-semibold">
                          {hasSubmitted ? '✓' : player.name.charAt(0)}
                        </div>
                        <p className="mt-2 truncate text-xs font-medium">{player.name}</p>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </>
          ) : (
            <Card className="py-10 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[2rem] border border-emerald-400/30 bg-emerald-400/15 text-emerald-200">
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <h4 className="mt-6 text-2xl font-semibold text-white">提出できました</h4>
              <p className="mt-2 text-sm leading-6 text-slate-300">全員分が揃うと、次は誰の曲かを当てる推理フェーズに進みます。</p>

              <div className="mt-8 grid grid-cols-3 gap-3 sm:grid-cols-4">
                {players.map((player) => {
                  const hasSubmitted = submissions.some((submission) => submission.playerId === player.id);
                  return (
                    <div
                      key={player.id}
                      className={`rounded-2xl border px-3 py-4 text-center transition ${
                        hasSubmitted
                          ? 'border-emerald-400/40 bg-emerald-400/12 text-emerald-100'
                          : 'border-white/10 bg-white/5 text-slate-300'
                      }`}
                    >
                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-sm font-semibold">
                        {hasSubmitted ? '✓' : player.name.charAt(0)}
                      </div>
                      <p className="mt-2 truncate text-xs font-medium">{player.name}</p>
                    </div>
                  );
                })}
              </div>

              {isHost && submissions.length === players.length && (
                <div className="mt-8">
                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    onClick={() => void updateRoundPhase(roomId, roundId, 'guessing')}
                  >
                    推理フェーズを始める
                  </Button>
                </div>
              )}
            </Card>
          )}
        </div>
      </Layout>
    );
  }

  if (round.phase === 'guessing') {
    return (
      <Layout title="推理タイム">
        <div className="space-y-6">
          <Card className="overflow-hidden py-6">
            <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-r from-accent-400/25 via-primary-500/20 to-transparent blur-2xl" />
            <div className="relative">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent-100">Guess Phase</p>
              <h3 className="mt-3 text-2xl font-semibold text-white">{round.theme}</h3>
              <p className="mt-2 text-sm text-slate-300">曲名とコメントをヒントに、誰が選んだかを予想してください。</p>
            </div>
          </Card>

          <div className="text-center space-y-1">
            <h3 className="text-xl font-semibold tracking-tight text-white">誰の曲かを予想してください</h3>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400">
              同じ人を複数の曲に割り当てることはできません
            </p>
          </div>

          {isGuessSubmitted ? (
            <Card className="py-10 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[2rem] border border-emerald-400/30 bg-emerald-400/15 text-emerald-200">
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <h4 className="mt-6 text-2xl font-semibold text-white">回答を送信しました</h4>
              <p className="mt-2 text-sm leading-6 text-slate-300">全員の回答が揃ったら、結果発表に進みます。</p>
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

                    <div className="grid grid-cols-2 gap-2 mt-4">
                      {players.map((player) => {
                        const isSelected = guesses.some(
                          (guess) =>
                            guess.submissionId === submission.id && guess.guessedPlayerId === player.id,
                        );
                        const isAssignedElsewhere = guesses.some(
                          (guess) =>
                            guess.submissionId !== submission.id && guess.guessedPlayerId === player.id,
                        );
                        const isOwnSong = submission.playerId === playerId && player.id === playerId;

                        return (
                          <button
                            type="button"
                            key={player.id}
                            disabled={isAssignedElsewhere || isOwnSong}
                            onClick={() => handleAssignGuess(submission.id, player.id)}
                            className={`
                              rounded-2xl border px-3 py-3 text-left text-sm font-medium transition
                              ${isSelected ? 'border-primary-400/50 bg-primary-500/20 text-white shadow-[0_16px_40px_rgba(56,130,246,0.22)]' : 'border-white/10 bg-white/5 text-slate-200'}
                              ${(isAssignedElsewhere || isOwnSong) ? 'opacity-25' : 'hover:border-primary-300/40 hover:bg-white/10 active:scale-[0.98]'}
                            `}
                          >
                            <span className="block font-semibold">{player.name}</span>
                            {isOwnSong && <span className="mt-1 block text-[10px] uppercase tracking-[0.18em] opacity-70">自分は選べません</span>}
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
                {isHost && (
                  <Button
                    variant="ghost"
                    fullWidth
                    className="mt-4"
                    onClick={() => void updateRoundPhase(roomId, roundId, 'revealing')}
                  >
                    ホストが結果発表へ進む
                  </Button>
                )}
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
        <p className="mt-3 text-sm leading-6 text-slate-300">ホストが結果画面に進めると、このまま自動で同期されます。</p>
      </Card>
    </Layout>
  );
};
