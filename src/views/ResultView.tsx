import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Layout } from '../components/Layout';
import { MINIMUM_GAME_TURNS } from '../constants/game';
import {
  advanceGame,
  finalizeRoundScores,
  subscribePlayerGuess,
  subscribeSubmissions,
} from '../firebase/game';
import { getGameEndTurn, shouldFinishGameAfterRound } from '../logic/gameProgress';
import { getRotatingParent } from '../logic/parentRotation';
import type { Guess, Player, Round, Room, Submission } from '../types';

interface ResultViewProps {
  room: Room;
  roundId: string;
  round: Round | null;
  players: Player[];
  currentPlayerId: string;
}

const flatCardClass = 'border-2 border-slate-600/40 bg-slate-100 shadow-none hover:border-slate-600/40 hover:bg-slate-100';
const accentCardClass = 'border-2 border-accent-500 bg-accent-50 shadow-none hover:border-accent-500 hover:bg-accent-50';
const primaryCardClass = 'border-2 border-primary-400 bg-primary-50 shadow-none hover:border-primary-400 hover:bg-primary-50';

export const ResultView: React.FC<ResultViewProps> = ({
  room,
  roundId,
  round,
  players,
  currentPlayerId,
}) => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [guess, setGuess] = useState<Guess | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const unsubscribeSubmissions = subscribeSubmissions(room.id, roundId, setSubmissions);
    return () => unsubscribeSubmissions();
  }, [room.id, roundId]);

  useEffect(() => {
    if (!round?.parentPlayerId) {
      setGuess(null);
      return;
    }

    const unsubscribeGuess = subscribePlayerGuess(
      room.id,
      roundId,
      round.parentPlayerId,
      setGuess,
    );

    return () => unsubscribeGuess();
  }, [room.id, round?.parentPlayerId, roundId]);

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
      <Layout title="結果表示">
        <Card className="py-10 text-center">
          <h2 className="text-xl font-semibold text-slate-900">結果を読み込み中です</h2>
          <p className="mt-2 text-sm text-slate-600">スコアと正解を準備しています。</p>
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
          <h3 className="text-3xl font-semibold text-slate-950">正解はこちら</h3>
          <p className="text-sm leading-6 text-slate-600">
            ジャンルは <span className="font-semibold text-slate-900">{room.settings.genre || '未設定'}</span>。
            このターンの親は {currentParent?.name || '未設定'} です。
          </p>
          <p className="text-xs leading-5 text-slate-500">
            最低 {MINIMUM_GAME_TURNS} ターン遊び、現在の人数では {finishTurn} ターンで終了します。
          </p>
        </div>

        <div className="space-y-4">
          {submissions.map((submission) => {
            const author = players.find((player) => player.id === submission.playerId);
            const guessAnswer = guess?.answers.find((answer) => answer.submissionId === submission.id);
            const guessedPlayer = players.find((player) => player.id === guessAnswer?.guessedPlayerId);
            const hasAnswer = Boolean(guessAnswer);
            const isCorrect = hasAnswer && guessAnswer?.guessedPlayerId === submission.playerId;

            return (
              <Card
                key={submission.id}
                className={`relative border-2 shadow-none ${
                  !hasAnswer
                    ? 'border-slate-400 bg-slate-50 hover:border-slate-400 hover:bg-slate-50'
                    : isCorrect
                    ? 'border-emerald-400 bg-emerald-50 hover:border-emerald-400 hover:bg-emerald-50'
                    : 'border-red-300 bg-red-50 hover:border-red-300 hover:bg-red-50'
                }`}
              >
                <div className="absolute right-4 top-4">
                  <span
                    className={`inline-flex items-center rounded-xl border px-3 py-1 text-[11px] font-semibold ${
                      !hasAnswer
                        ? 'border-slate-300 bg-white text-slate-600'
                        : isCorrect
                        ? 'border-emerald-400 bg-emerald-100 text-emerald-700'
                        : 'border-red-300 bg-red-100 text-red-700'
                    }`}
                  >
                    {!hasAnswer ? '確認中' : isCorrect ? '正解' : '不正解'}
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="pr-14">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary-600">Song</p>
                    <h4 className="text-2xl font-semibold leading-tight text-slate-950">{submission.songName}</h4>
                  </div>

                  <div className="grid gap-3 border-t border-slate-300 pt-3 sm:grid-cols-2">
                    <div className="rounded-2xl border-2 border-slate-300 bg-white px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Actual Player</p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-2xl border-2 border-slate-300 bg-slate-100 text-[11px] font-semibold text-slate-700">
                          {author?.name?.charAt(0) ?? '?'}
                        </div>
                        <span className="text-sm font-semibold text-slate-900">{author?.name ?? '不明'}</span>
                      </div>
                    </div>
                    <div className="rounded-2xl border-2 border-slate-300 bg-white px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Game Master Answer</p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-2xl border-2 border-slate-300 bg-slate-100 text-[11px] font-semibold text-slate-700">
                          {guessedPlayer?.name?.charAt(0) ?? '?'}
                        </div>
                        <span className="text-sm font-semibold text-slate-900">{guessedPlayer?.name ?? '未回答'}</span>
                      </div>
                    </div>
                  </div>

                  {submission.comment && (
                    <p className="rounded-2xl border-2 border-slate-300 bg-white p-3 text-sm italic text-slate-600">
                      "{submission.comment}"
                    </p>
                  )}

                  <p
                    className={`text-sm font-medium ${
                      !hasAnswer ? 'text-slate-600' : isCorrect ? 'text-emerald-700' : 'text-red-700'
                    }`}
                  >
                    {!hasAnswer
                      ? 'Game Master の回答を読み込んでいます。'
                      : isCorrect
                      ? `${currentParent?.name || 'Game Master'} の回答は正解でした。`
                      : `${currentParent?.name || 'Game Master'} は ${guessedPlayer?.name || '未回答'} と答えました。`}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>

        {!isLastRound && (
          <Card className={accentCardClass}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent-500">Next Game Master</p>
            <h4 className="mt-2 text-xl font-semibold text-slate-900">
              次のターンの親は {nextParent?.name || '未定'} です
            </h4>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              次の親が画面に進むと、新しいお題を決めてから提出フェーズが始まります。
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
                  このターンのスコアを確定すると、次のターンへ進めます。
                </p>
              </div>
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
            <Card className={primaryCardClass}>
              <div className="space-y-4 text-left">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Next Turn</p>
                  <h4 className="mt-2 text-xl font-semibold text-slate-900">次のターンへ進む</h4>
                </div>
                <p className="text-sm leading-6 text-slate-600">
                  次の親が画面に進み、お題設定から新しいターンを始めます。
                </p>
              </div>
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
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                次は {room.currentRoundNumber + 1} ターン目です
              </p>
            </div>
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
                  すべてのターンが終了しました。ランキングと統計を表示します。
                </p>
              </div>
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
