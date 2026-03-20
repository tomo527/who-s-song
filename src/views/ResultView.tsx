import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { Layout } from '../components/Layout';
import { MINIMUM_GAME_TURNS } from '../constants/game';
import { getRandomPrompt } from '../constants/prompts';
import {
  advanceGame,
  finalizeRoundScores,
  subscribeSubmissions,
  updateRoundBonus,
} from '../firebase/game';
import { getGameEndTurn, shouldFinishGameAfterRound } from '../logic/gameProgress';
import { getRotatingParent } from '../logic/parentRotation';
import type { Player, Round, Room, Submission } from '../types';

interface ResultViewProps {
  room: Room;
  roundId: string;
  round: Round | null;
  players: Player[];
  currentPlayerId: string;
}

export const ResultView: React.FC<ResultViewProps> = ({
  room,
  roundId,
  round,
  players,
  currentPlayerId,
}) => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [nextTheme, setNextTheme] = useState(() => getRandomPrompt());

  useEffect(() => {
    const unsubscribeSubmissions = subscribeSubmissions(room.id, roundId, setSubmissions);

    return () => {
      unsubscribeSubmissions();
    };
  }, [room.id, roundId]);

  const currentParent = useMemo(
    () => players.find((player) => player.id === round?.parentPlayerId) ?? null,
    [players, round?.parentPlayerId],
  );
  const nextRoundNumber = room.currentRoundNumber + 1;
  const nextParent = useMemo(
    () => getRotatingParent(players, nextRoundNumber),
    [players, nextRoundNumber],
  );
  const isCurrentParent = round?.parentPlayerId === currentPlayerId;
  const isNextParent = nextParent?.id === currentPlayerId;
  const finishTurn = getGameEndTurn(players.length, room.settings.roundsCount || MINIMUM_GAME_TURNS);
  const isLastRound = shouldFinishGameAfterRound(
    room.currentRoundNumber,
    players.length,
    room.settings.roundsCount || MINIMUM_GAME_TURNS,
  );

  if (!round) {
    return (
      <Layout title="結果発表">
        <Card className="py-10 text-center">
          <h2 className="text-xl font-semibold text-white">結果を読み込んでいます</h2>
          <p className="mt-2 text-sm text-slate-300">投稿内容とスコアを同期しています。</p>
        </Card>
      </Layout>
    );
  }

  const canFinalizeRound = isCurrentParent && !round.scoreFinalized;
  const canStartNextRound = !isLastRound && round.scoreFinalized && isNextParent;
  const canFinishGame = isLastRound && round.scoreFinalized && isCurrentParent;

  const handleFinalizeRound = async () => {
    if (!isCurrentParent || round.scoreFinalized || isProcessing) {
      return;
    }

    setIsProcessing(true);
    try {
      await finalizeRoundScores(room, round, players, currentPlayerId);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartNextRound = async () => {
    if (!nextParent || !round.scoreFinalized || !isNextParent || isProcessing) {
      return;
    }

    setIsProcessing(true);
    try {
      const theme = nextTheme.trim() || getRandomPrompt();
      await advanceGame(room, theme, nextParent.id, players.length);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinishGame = async () => {
    if (!isLastRound || !round.scoreFinalized || !isCurrentParent || isProcessing) {
      return;
    }

    setIsProcessing(true);
    try {
      await advanceGame(room, '', round.parentPlayerId, players.length);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Layout title="結果発表">
      <div className="space-y-8 pb-12">
        <div className="text-center space-y-3">
          <div className="inline-flex rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] font-semibold tracking-[0.22em] text-slate-300 uppercase">
            TURN {room.currentRoundNumber}
          </div>
          <h3 className="text-3xl font-semibold text-white">正解はこちら</h3>
          <p className="text-sm leading-6 text-slate-300">
            ジャンルは <span className="font-semibold text-white">{room.settings.genre || '未設定'}</span>。
            今回の親役は {currentParent?.name || '未設定'} です。
          </p>
          <p className="text-xs leading-5 text-slate-400">
            最低 {MINIMUM_GAME_TURNS} ターン、現在の人数なら {finishTurn} ターン目でゲーム終了です。
          </p>
        </div>

        <div className="space-y-4">
          {submissions.map((submission) => {
            const author = players.find((player) => player.id === submission.playerId);
            const isBonusWinner = submission.id === round.bonusWinnerSubmissionId;

            return (
              <Card
                key={submission.id}
                className={`relative overflow-hidden border-2 transition-all ${
                  isBonusWinner ? 'border-yellow-300/50 bg-yellow-300/10' : 'border-white/10'
                }`}
              >
                <div className="absolute top-0 right-0 flex flex-col items-end gap-2 p-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-primary-300/30 bg-primary-500/20 text-xs font-semibold text-primary-100">
                    正解
                  </span>
                  {isBonusWinner && (
                    <span className="inline-flex items-center gap-1 rounded-xl bg-yellow-300 px-2 py-1 text-[10px] font-semibold text-slate-950 shadow-sm">
                      BEST
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="pr-12">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary-100">Song</p>
                    <h4 className="text-2xl font-semibold leading-tight text-white">{submission.songName}</h4>
                  </div>

                  <div className="flex items-center justify-between border-t border-white/10 pt-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-[11px] font-semibold text-slate-100">
                        {author?.name?.charAt(0) ?? '?'}
                      </div>
                      <span className="text-sm font-semibold text-slate-100">{author?.name ?? '不明'} さん</span>
                    </div>

                    {isCurrentParent && !round.scoreFinalized && (
                      <button
                        type="button"
                        onClick={() => void updateRoundBonus(room.id, round.id, submission.id)}
                        className={`rounded-xl px-3 py-2 text-[11px] font-semibold transition ${
                          isBonusWinner
                            ? 'bg-yellow-300 text-slate-950'
                            : 'border border-white/10 bg-white/5 text-slate-300 hover:border-yellow-200/30 hover:bg-yellow-200/10 hover:text-yellow-100'
                        }`}
                      >
                        {isBonusWinner ? 'BEST選出中' : 'BESTにする'}
                      </button>
                    )}
                  </div>

                  {submission.comment && (
                    <p className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm italic text-slate-300">"{submission.comment}"</p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {!isLastRound && (
          <Card className="bg-white/7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Next Parent</p>
            <h4 className="mt-2 text-xl font-semibold text-white">
              次ターンの親役は {nextParent?.name || '未定'} です
            </h4>
          </Card>
        )}

        {canFinalizeRound ? (
          <div className="pt-8 text-center space-y-6">
            <Card className="space-y-4">
              <div className="text-left">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Finalize</p>
                <h4 className="mt-2 text-xl font-semibold text-white">このターンの結果を確定する</h4>
              </div>
              <p className="text-left text-sm leading-6 text-slate-300">
                現在の親役が BEST 選出とスコア反映を確定します。主な加点は親役の正解と、親に「その人らしい」と正しく伝わった提出曲です。
              </p>
            </Card>

            <Button
              size="lg"
              fullWidth
              onClick={handleFinalizeRound}
              isLoading={isProcessing}
              variant="primary"
            >
              結果を確定する
            </Button>
          </div>
        ) : canStartNextRound ? (
          <div className="pt-8 text-center space-y-6">
            <Card className="space-y-4">
              <div className="text-left">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Next Theme</p>
                <h4 className="mt-2 text-xl font-semibold text-white">次のお題を決める</h4>
              </div>
              <p className="text-left text-sm leading-6 text-slate-300">
                ジャンルは <span className="font-semibold text-white">{room.settings.genre || '未設定'}</span> のままです。
              </p>
              <Button
                type="button"
                variant="secondary"
                fullWidth
                onClick={() => setNextTheme((current) => getRandomPrompt(current))}
              >
                ランダムなお題を表示
              </Button>
              <Input
                label="次のお題"
                placeholder="例: ドライブで聴きたい曲"
                value={nextTheme}
                onChange={(event) => setNextTheme(event.target.value)}
                helperText="ランダム候補を出してから手動で調整できます。"
              />
            </Card>

            <div className="space-y-3">
              <Button
                size="lg"
                fullWidth
                onClick={handleStartNextRound}
                isLoading={isProcessing}
                variant="secondary"
              >
                次のターンへ進む
              </Button>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                次は第{room.currentRoundNumber + 1}ターンです
              </p>
            </div>
          </div>
        ) : canFinishGame ? (
          <div className="pt-8 text-center space-y-6">
            <Card className="space-y-4">
              <div className="text-left">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Finish</p>
                <h4 className="mt-2 text-xl font-semibold text-white">最終結果へ進む</h4>
              </div>
              <p className="text-left text-sm leading-6 text-slate-300">
                全員の親役回数が揃いました。最終結果でスコアと相互理解 stats を確認できます。
              </p>
            </Card>

            <Button
              size="lg"
              fullWidth
              onClick={handleFinishGame}
              isLoading={isProcessing}
              variant="primary"
            >
              最終結果を表示する
            </Button>
          </div>
        ) : (
          <Card className="bg-white/6 text-center">
            <p className="text-sm font-medium text-slate-300">
              {isLastRound
                ? round.scoreFinalized
                  ? `${currentParent?.name || '親役'} が最終結果へ進めるまでお待ちください。`
                  : `${currentParent?.name || '親役'} が結果を確定するまでお待ちください。`
                : round.scoreFinalized
                  ? `${nextParent?.name || '次の親役'} がお題を決めて開始するまでお待ちください。`
                  : `${currentParent?.name || '親役'} が結果を確定するまでお待ちください。`}
            </p>
          </Card>
        )}
      </div>
    </Layout>
  );
};
