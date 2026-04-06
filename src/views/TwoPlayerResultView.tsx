import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Layout } from '../components/Layout';
import {
  advanceGame,
  finalizeRoundScores,
  subscribePlayerGuess,
  subscribeSubmissions,
} from '../firebase/game';
import { getGameEndTurn, shouldFinishGameAfterRound } from '../logic/gameProgress';
import { getRotatingParent } from '../logic/parentRotation';
import type { Guess, Player, Round, Room, Submission } from '../types';

interface TwoPlayerResultViewProps {
  room: Room;
  roundId: string;
  round: Round | null;
  players: Player[];
  currentPlayerId: string;
}

const flatCardClass = 'border-2 border-slate-600/40 bg-slate-100 shadow-none hover:border-slate-600/40 hover:bg-slate-100';
const accentCardClass = 'border-2 border-accent-500 bg-accent-50 shadow-none hover:border-accent-500 hover:bg-accent-50';
const primaryCardClass = 'border-2 border-primary-400 bg-primary-50 shadow-none hover:border-primary-400 hover:bg-primary-50';

export const TwoPlayerResultView: React.FC<TwoPlayerResultViewProps> = ({
  room,
  roundId,
  round,
  players,
  currentPlayerId,
}) => {
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [guess, setGuess] = useState<Guess | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const unsubscribeSubmissions = subscribeSubmissions(room.id, roundId, (submissions) => {
      setSubmission(submissions[0] ?? null);
    });

    return () => unsubscribeSubmissions();
  }, [room.id, roundId]);

  useEffect(() => {
    if (!round?.parentPlayerId) {
      setGuess(null);
      return;
    }

    const unsubscribeGuess = subscribePlayerGuess(room.id, roundId, round.parentPlayerId, setGuess);
    return () => unsubscribeGuess();
  }, [room.id, round?.parentPlayerId, roundId]);

  const currentParent = useMemo(
    () => players.find((player) => player.id === round?.parentPlayerId) ?? null,
    [players, round?.parentPlayerId],
  );
  const submitter = useMemo(
    () => players.find((player) => player.id !== round?.parentPlayerId) ?? null,
    [players, round?.parentPlayerId],
  );
  const nextRoundNumber = room.currentRoundNumber + 1;
  const nextParent = useMemo(() => getRotatingParent(players, nextRoundNumber), [players, nextRoundNumber]);
  const isCurrentParent = round?.parentPlayerId === currentPlayerId;
  const isNextParent = nextParent?.id === currentPlayerId;
  const finishTurn = getGameEndTurn(players.length, room.settings.roundsCount);
  const isLastRound = shouldFinishGameAfterRound(room.currentRoundNumber, players.length, room.settings.roundsCount);
  const hasJudgment = guess?.isTextAnswerCorrect !== undefined;

  if (!round) {
    return (
      <Layout title="結果表示">
        <Card className="py-10 text-center">
          <h2 className="text-xl font-semibold text-slate-900">結果を読み込み中です</h2>
          <p className="mt-2 text-sm text-slate-600">判定結果を準備しています。</p>
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
    <Layout title="結果表示">
      <div className="space-y-8 pb-12">
        <div className="space-y-3 text-center">
          <div className="inline-flex rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Turn {room.currentRoundNumber}
          </div>
          <h3 className="text-3xl font-semibold text-slate-950">今回の結果</h3>
          <p className="text-sm leading-6 text-slate-600">
            このターンの親は {currentParent?.name || '未設定'}、提出者は {submitter?.name || '未設定'} です。
          </p>
          <p className="text-xs leading-5 text-slate-500">
            現在の人数では {finishTurn} ターンで最終結果になります。
          </p>
        </div>

        <Card className={flatCardClass}>
          <div className="space-y-4">
            <div className="rounded-2xl border-2 border-slate-300 bg-white px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Theme</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{round.theme || '未設定'}</p>
            </div>
            <div className="rounded-2xl border-2 border-slate-300 bg-white px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Submitted Song</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{submission?.songName || '未提出'}</p>
            </div>
            <div className="rounded-2xl border-2 border-slate-300 bg-white px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">親の回答</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{round.textAnswer || guess?.textAnswer || '未回答'}</p>
            </div>
            <div
              className={`rounded-2xl border-2 px-4 py-4 ${
                !hasJudgment
                  ? 'border-slate-300 bg-white'
                  : guess?.isTextAnswerCorrect
                    ? 'border-emerald-400 bg-emerald-50'
                    : 'border-red-300 bg-red-50'
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">判定結果</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {!hasJudgment ? '判定待ち' : guess?.isTextAnswerCorrect ? '正解' : '不正解'}
              </p>
            </div>
            {submission?.comment && (
              <p className="rounded-2xl border-2 border-slate-300 bg-white p-3 text-sm italic text-slate-600">
                "{submission.comment}"
              </p>
            )}
          </div>
        </Card>

        {!isLastRound && (
          <Card className={accentCardClass}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent-500">Next Parent</p>
            <h4 className="mt-2 text-xl font-semibold text-slate-900">
              次のターンの親は {nextParent?.name || '未定'} です
            </h4>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              次の親が進むと、新しいお題を決めて次のターンが始まります。
            </p>
          </Card>
        )}

        {canFinalizeRound ? (
          <div className="space-y-6 pt-8 text-center">
            <Card className={flatCardClass}>
              <div className="space-y-4 text-left">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Finalize</p>
                  <h4 className="mt-2 text-xl font-semibold text-slate-900">このターンの結果を確定する</h4>
                </div>
                <p className="text-sm leading-6 text-slate-600">
                  提出者の判定に基づいて、このターンのスコアを確定します。
                </p>
              </div>
            </Card>
            <Button size="lg" fullWidth onClick={handleFinalizeRound} isLoading={isProcessing} variant="primary">
              結果を確定する
            </Button>
          </div>
        ) : canStartNextRound ? (
          <div className="space-y-6 pt-8 text-center">
            <Card className={primaryCardClass}>
              <div className="space-y-4 text-left">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Next Turn</p>
                  <h4 className="mt-2 text-xl font-semibold text-slate-900">次のターンへ進む</h4>
                </div>
                <p className="text-sm leading-6 text-slate-600">
                  次の親がお題を決めると、新しいターンが始まります。
                </p>
              </div>
            </Card>
            <Button size="lg" fullWidth onClick={handleStartNextRound} isLoading={isProcessing} variant="secondary">
              次のターンへ進む
            </Button>
          </div>
        ) : canFinishGame ? (
          <div className="space-y-6 pt-8 text-center">
            <Card className={primaryCardClass}>
              <div className="space-y-4 text-left">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Finish</p>
                  <h4 className="mt-2 text-xl font-semibold text-slate-900">最終結果へ進む</h4>
                </div>
                <p className="text-sm leading-6 text-slate-600">
                  すべてのターンが終了しました。お互いの理解度をまとめて表示します。
                </p>
              </div>
            </Card>
            <Button size="lg" fullWidth onClick={handleFinishGame} isLoading={isProcessing} variant="primary">
              最終結果を表示する
            </Button>
          </div>
        ) : (
          <Card className={`${flatCardClass} text-center`}>
            <p className="text-sm font-medium text-slate-600">
              {isLastRound
                ? round.scoreFinalized
                  ? `${currentParent?.name || '親'} が最終結果へ進めるまでお待ちください。`
                  : `${currentParent?.name || '親'} が結果を確定するまでお待ちください。`
                : round.scoreFinalized
                  ? `${nextParent?.name || '次の親'} が次のターンを始めるまでお待ちください。`
                  : `${currentParent?.name || '親'} が結果を確定するまでお待ちください。`}
            </p>
          </Card>
        )}
      </div>
    </Layout>
  );
};
