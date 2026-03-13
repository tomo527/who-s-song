import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { subscribeSubmissions, subscribeRound, finalizeRoundScores, advanceGame, updateRoundBonus } from '../firebase/game';
import type { Submission, Player, Round, Room } from '../types';

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
    const unsubSubs = subscribeSubmissions(room.id, roundId, setSubmissions);
    const unsubRound = subscribeRound(room.id, roundId, setRound);
    return () => {
      unsubSubs();
      unsubRound();
    };
  }, [room.id, roundId]);

  const handleAdvance = async () => {
    if (!isHost || !round || isProcessing) return;
    
    setIsProcessing(true);
    try {
      // 1. スコアを確定させる（まだ確定していない場合のみトランザクション内で処理される）
      if (!round.scoreFinalized) {
        await finalizeRoundScores(room, round, players);
      }

      // 2. 次のラウンドまたは終了へ
      const theme = nextTheme || "次のお題";
      await advanceGame(room, theme); 
    } catch (e) {
      console.error("Failed to advance game:", e);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!round) return null;

  const isLastRound = room.currentRoundNumber >= room.settings.roundsCount;

  return (
    <Layout title="結果発表">
      <div className="space-y-8 pb-12">
        <div className="text-center space-y-2">
          <div className="inline-block bg-slate-100 rounded-full px-3 py-1 text-[10px] font-bold text-slate-500 mb-1">
            ROUND {room.currentRoundNumber} / {room.settings.roundsCount}
          </div>
          <h3 className="text-2xl font-black text-slate-800">答え合わせ</h3>
          <p className="text-sm text-slate-500">誰がどの曲を選んだでしょうか？</p>
        </div>

        <div className="space-y-4">
          {submissions.map((sub) => {
            const author = players.find(p => p.id === sub.playerId);
            return (
              <Card key={sub.id} className={`relative overflow-hidden group border-2 transition-all ${sub.id === round.bonusWinnerSubmissionId ? 'border-yellow-400 bg-yellow-50/30' : 'border-transparent'}`}>
                <div className="absolute top-0 right-0 p-3 flex flex-col items-end gap-2">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-50 text-primary-600 font-bold text-xs ring-4 ring-white">
                    正解
                  </span>
                  {sub.id === round.bonusWinnerSubmissionId && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-400 text-white text-[10px] font-black rounded-lg shadow-sm animate-bounce">
                      <span>⭐</span> BEST
                    </span>
                  )}
                </div>
                <div className="space-y-3">
                  <div className="pr-12">
                    <p className="text-xs font-bold text-primary-500 uppercase tracking-tighter mb-1">Song</p>
                    <h4 className="text-xl font-black text-slate-900 leading-tight">{sub.songName}</h4>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center text-[10px] font-bold text-primary-600">
                        {author?.name.charAt(0)}
                      </div>
                      <span className="text-sm font-black text-slate-700">{author?.name} さん</span>
                    </div>

                    {isHost && !round.scoreFinalized && (
                      <button 
                        onClick={() => updateRoundBonus(room.id, round.id, sub.id)}
                        className={`text-[10px] font-bold px-2 py-1 rounded-lg transition-colors ${
                          sub.id === round.bonusWinnerSubmissionId 
                            ? 'bg-yellow-400 text-white' 
                            : 'bg-slate-100 text-slate-400 hover:bg-yellow-100 hover:text-yellow-600'
                        }`}
                      >
                        {sub.id === round.bonusWinnerSubmissionId ? 'ベスト選出中' : 'ベストに選ぶ'}
                      </button>
                    )}
                  </div>

                  {sub.comment && (
                    <p className="text-xs text-slate-400 bg-white/50 p-2 rounded-xl italic">
                      "{sub.comment}"
                    </p>
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
                <label className="block text-xs font-black text-slate-400 mb-2 uppercase tracking-tighter text-left">次ラウンドのお題</label>
                <input 
                  type="text"
                  placeholder="例: 最近ハマっている食べ物"
                  className="w-full px-4 py-3 rounded-xl border-2 border-white focus:border-primary-400 outline-none font-bold text-slate-700 shadow-sm transition-all"
                  value={nextTheme}
                  onChange={(e) => setNextTheme(e.target.value)}
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
                {isLastRound ? '最終順位を発表する 🏆' : '次のラウンドを開始 ❯'}
              </Button>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {isLastRound ? '全ラウンドが終了しました' : `次は 第 ${room.currentRoundNumber + 1} ラウンドです`}
              </p>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};
