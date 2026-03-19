import React, { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { Layout } from '../components/Layout';
import { advanceGame, finalizeRoundScores, subscribeRound, subscribeSubmissions, updateRoundBonus } from '../firebase/game';
import type { Player, Round, Room, Submission } from '../types';

interface ResultViewProps {
  room: Room;
  roundId: string;
  players: Player[];
  isHost: boolean;
}

export const ResultView: React.FC<ResultViewProps> = ({ room, roundId, players, isHost }) => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [round, setRound] = useState<Round | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [nextTheme, setNextTheme] = useState('');

  useEffect(() => {
    const unsubscribeSubmissions = subscribeSubmissions(room.id, roundId, setSubmissions);
    const unsubscribeRound = subscribeRound(room.id, roundId, setRound);

    return () => {
      unsubscribeSubmissions();
      unsubscribeRound();
    };
  }, [room.id, roundId]);

  const handleAdvance = async () => {
    if (!isHost || !round || isProcessing) {
      return;
    }

    setIsProcessing(true);
    try {
      if (!round.scoreFinalized) {
        await finalizeRoundScores(room, round, players);
      }

      const theme = nextTheme.trim() || '次のラウンドのお題';
      await advanceGame(room, theme);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!round) {
    return (
      <Layout title="結果発表">
        <Card className="py-10 text-center">
          <h2 className="text-xl font-semibold text-white">結果を読み込んでいます</h2>
          <p className="mt-2 text-sm text-slate-300">提出内容とスコアを同期しています。</p>
        </Card>
      </Layout>
    );
  }

  const isLastRound = room.currentRoundNumber >= room.settings.roundsCount;

  return (
    <Layout title="結果発表">
      <div className="space-y-8 pb-12">
        <div className="text-center space-y-3">
          <div className="inline-flex rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] font-semibold tracking-[0.22em] text-slate-300 uppercase">
            ROUND {room.currentRoundNumber} / {room.settings.roundsCount}
          </div>
          <h3 className="text-3xl font-semibold text-white">正解はこちら</h3>
          <p className="text-sm leading-6 text-slate-300">誰がどの曲を選んだかを公開します。ホストはこの画面で BEST 提出を選べます。</p>
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
                <div className="absolute top-0 right-0 p-3 flex flex-col items-end gap-2">
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

                    {isHost && !round.scoreFinalized && (
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

        {isHost && (
          <div className="pt-8 text-center space-y-6">
            {!isLastRound && (
              <Card className="space-y-4">
                <div className="text-left">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Next Theme</p>
                  <h4 className="mt-2 text-xl font-semibold text-white">次のラウンドのお題を決める</h4>
                </div>
                <Input
                  label="次のお題"
                  placeholder="例: ドライブで聴きたい曲"
                  value={nextTheme}
                  onChange={(event) => setNextTheme(event.target.value)}
                />
              </Card>
            )}

            <div className="space-y-3">
              <Button
                size="lg"
                fullWidth
                onClick={handleAdvance}
                isLoading={isProcessing}
                variant={isLastRound ? 'primary' : 'secondary'}
              >
                {isLastRound ? '最終結果を表示する' : '次のラウンドへ進む'}
              </Button>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {isLastRound
                  ? 'これで全ラウンド終了です'
                  : `次は 第${room.currentRoundNumber + 1} ラウンドです`}
              </p>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};
