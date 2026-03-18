import React, { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
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
        <p className="text-slate-500">結果を読み込んでいます...</p>
      </Layout>
    );
  }

  const isLastRound = room.currentRoundNumber >= room.settings.roundsCount;

  return (
    <Layout title="結果発表">
      <div className="space-y-8 pb-12">
        <div className="text-center space-y-2">
          <div className="inline-block bg-slate-100 rounded-full px-3 py-1 text-[10px] font-bold text-slate-500 mb-1">
            ROUND {room.currentRoundNumber} / {room.settings.roundsCount}
          </div>
          <h3 className="text-2xl font-black text-slate-800">正解はこちら</h3>
          <p className="text-sm text-slate-500">誰がどの曲を選んだかを公開します。</p>
        </div>

        <div className="space-y-4">
          {submissions.map((submission) => {
            const author = players.find((player) => player.id === submission.playerId);
            const isBonusWinner = submission.id === round.bonusWinnerSubmissionId;

            return (
              <Card
                key={submission.id}
                className={`relative overflow-hidden border-2 transition-all ${
                  isBonusWinner ? 'border-yellow-400 bg-yellow-50/30' : 'border-transparent'
                }`}
              >
                <div className="absolute top-0 right-0 p-3 flex flex-col items-end gap-2">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-50 text-primary-600 font-bold text-xs ring-4 ring-white">
                    正解
                  </span>
                  {isBonusWinner && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-400 text-white text-[10px] font-black rounded-lg shadow-sm">
                      BEST
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="pr-12">
                    <p className="text-xs font-bold text-primary-500 uppercase tracking-tighter mb-1">Song</p>
                    <h4 className="text-xl font-black text-slate-900 leading-tight">{submission.songName}</h4>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center text-[10px] font-bold text-primary-600">
                        {author?.name?.charAt(0) ?? '?'}
                      </div>
                      <span className="text-sm font-black text-slate-700">{author?.name ?? '不明'} さん</span>
                    </div>

                    {isHost && !round.scoreFinalized && (
                      <button
                        type="button"
                        onClick={() => void updateRoundBonus(room.id, round.id, submission.id)}
                        className={`text-[10px] font-bold px-2 py-1 rounded-lg transition-colors ${
                          isBonusWinner
                            ? 'bg-yellow-400 text-white'
                            : 'bg-slate-100 text-slate-400 hover:bg-yellow-100 hover:text-yellow-600'
                        }`}
                      >
                        {isBonusWinner ? 'BEST選出中' : 'BESTにする'}
                      </button>
                    )}
                  </div>

                  {submission.comment && (
                    <p className="text-xs text-slate-400 bg-white/50 p-2 rounded-xl italic">"{submission.comment}"</p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {isHost && (
          <div className="pt-8 text-center space-y-6">
            {!isLastRound && (
              <Card className="bg-slate-50 border-slate-100 p-4">
                <label className="block text-xs font-black text-slate-400 mb-2 uppercase tracking-tighter text-left">
                  次のラウンドのお題
                </label>
                <input
                  type="text"
                  placeholder="例: ドライブで聴きたい曲"
                  className="w-full px-4 py-3 rounded-xl border-2 border-white focus:border-primary-400 outline-none font-bold text-slate-700 shadow-sm transition-all"
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
