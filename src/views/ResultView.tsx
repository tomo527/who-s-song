import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Layout } from '../components/Layout';
import { MINIMUM_GAME_TURNS } from '../constants/game';
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

  useEffect(() => {
    const unsubscribeSubmissions = subscribeSubmissions(room.id, roundId, setSubmissions);
    return () => unsubscribeSubmissions();
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
          <h2 className="text-xl font-semibold text-white">結果を読み込み中です</h2>
          <p className="mt-2 text-sm text-slate-300">スコアと正解情報を取得しています。</p>
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
      await advanceGame(room, '', nextParent.id, players.length);
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
        <div className="space-y-3 text-center">
          <div className="inline-flex rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">
            TURN {room.currentRoundNumber}
          </div>
          <h3 className="text-3xl font-semibold text-white">正解はこちら</h3>
          <p className="text-sm leading-6 text-slate-300">
            ジャンルは <span className="font-semibold text-white">{room.settings.genre || '未設定'}</span>、
            このターンの親は {currentParent?.name || '未設定'} です。
          </p>
          <p className="text-xs leading-5 text-slate-400">
            最低 {MINIMUM_GAME_TURNS} ターン、現在の人数なら {finishTurn} ターンでゲーム終了です。
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
                <div className="absolute right-0 top-0 flex flex-col items-end gap-2 p-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-primary-300/30 bg-primary-500/20 text-xs font-semibold text-primary-100">
                    正解
                  </span>
                  {isBonusWinner && (
                    <span className="inline-flex items-center gap-1 rounded-xl bg-yellow-300 px-2 py-1 text-[10px] font-semibold text-slate-950">
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
                        {isBonusWinner ? 'BEST選択中' : 'BESTにする'}
                      </button>
                    )}
                  </div>

                  {submission.comment && (
                    <p className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm italic text-slate-300">
                      "{submission.comment}"
                    </p>
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
              次のターンの親は {nextParent?.name || '未定'} です
            </h4>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              次のターンへ進んだあと、その親が新しいお題を決めてから提出フェーズが始まります。
            </p>
          </Card>
        )}

        {canFinalizeRound ? (
          <div className="space-y-6 pt-8 text-center">
            <Card className="space-y-4">
              <div className="text-left">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Finalize</p>
                <h4 className="mt-2 text-xl font-semibold text-white">このターンの結果を確定する</h4>
              </div>
              <p className="text-left text-sm leading-6 text-slate-300">
                現在の親が BEST 選出とスコア計算を確定します。次のターンへ進む前に一度だけ実行してください。
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
          <div className="space-y-6 pt-8 text-center">
            <Card className="space-y-4">
              <div className="text-left">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Next Turn</p>
                <h4 className="mt-2 text-xl font-semibold text-white">次のターンへ進む</h4>
              </div>
              <p className="text-left text-sm leading-6 text-slate-300">
                次の親がゲーム画面で新しいお題を決めます。ここではターンを進めるだけです。
              </p>
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
          <div className="space-y-6 pt-8 text-center">
            <Card className="space-y-4">
              <div className="text-left">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Finish</p>
                <h4 className="mt-2 text-xl font-semibold text-white">最終結果へ進む</h4>
              </div>
              <p className="text-left text-sm leading-6 text-slate-300">
                全ターン終了後の集計画面へ進みます。ランキングと統計を表示します。
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
                  ? `${currentParent?.name || '親'} が最終結果へ進めるまでお待ちください。`
                  : `${currentParent?.name || '親'} が結果を確定するまでお待ちください。`
                : round.scoreFinalized
                  ? `${nextParent?.name || '次の親'} が次のターンを開始するまでお待ちください。`
                  : `${currentParent?.name || '親'} が結果を確定するまでお待ちください。`}
            </p>
          </Card>
        )}
      </div>
    </Layout>
  );
};
