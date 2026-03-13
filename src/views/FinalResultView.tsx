import React from 'react';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import type { Player, Room } from '../types';

interface FinalResultViewProps {
  room: Room;
  players: Player[];
  onBackToHome: () => void;
}

export const FinalResultView: React.FC<FinalResultViewProps> = ({ players, onBackToHome }) => {
  const [copied, setCopied] = React.useState(false);

  // スコア順にソート
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  
  // 順位判定（同点対応）
  let currentRank = 1;
  const playersWithRank = sortedPlayers.map((player, index) => {
    if (index > 0 && player.score < sortedPlayers[index - 1].score) {
      currentRank = index + 1;
    }
    return { ...player, rank: currentRank };
  });

  const handleCopyResults = () => {
    const text = playersWithRank.map(p => `${p.rank}位: ${p.name} (${p.score}pt)`).join('\n');
    const fullText = `【誰の曲？匿名セトリ推理ゲーム】最終結果\n\n${text}\n\n#誰の曲ゲーム #セトリ推理`;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Layout title="最終結果">
      <div className="space-y-8 pb-12">
        <div className="text-center py-6">
          <div className="inline-block p-1 rounded-full bg-primary-50 mb-4 px-4">
            <span className="text-xs font-bold text-primary-600 uppercase tracking-widest">Congratulation!</span>
          </div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">最終ランキング</h2>
        </div>

        <div className="space-y-4">
          {playersWithRank.map((player) => {
            const isTop3 = player.rank <= 3;
            const rankColors = [
              'bg-yellow-400 text-white', // 1位
              'bg-slate-300 text-slate-700', // 2位
              'bg-orange-300 text-white', // 3位
            ];

            return (
              <Card 
                key={player.id} 
                className={`relative overflow-hidden transition-all duration-500 ${
                  player.rank === 1 ? 'ring-4 ring-primary-500 ring-offset-2 scale-105 my-6' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-sm ${
                    isTop3 ? rankColors[player.rank - 1] : 'bg-slate-100 text-slate-400'
                  }`}>
                    {player.rank}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-400 leading-none mb-1">Player</p>
                    <h4 className="text-xl font-black text-slate-800 truncate">
                      {player.name}
                      {player.rank === 1 && " 👑"}
                      {player.rank === 2 && " 🥈"}
                      {player.rank === 3 && " 🥉"}
                    </h4>
                  </div>

                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-400 leading-none mb-1">Score</p>
                    <div className="text-2xl font-black text-primary-600">
                      {player.score}<span className="text-xs ml-0.5">pt</span>
                    </div>
                  </div>
                </div>

                {player.rank === 1 && (
                  <div className="absolute top-[-20px] right-[-20px] w-16 h-16 bg-primary-500/10 rounded-full blur-xl animate-pulse"></div>
                )}
              </Card>
            );
          })}
        </div>

        <div className="pt-12 space-y-4">
          <Button 
            variant="primary" 
            fullWidth 
            onClick={handleCopyResults}
            className="bg-slate-800 hover:bg-slate-900 border-none"
          >
            {copied ? 'コピーしました！' : '結果をコピーして共有 📋'}
          </Button>
          <Button 
            variant="secondary" 
            fullWidth 
            onClick={onBackToHome}
          >
            ホームに戻る
          </Button>
          <p className="text-center text-[10px] text-slate-400 px-8 leading-relaxed">
            お疲れ様でした！結果をコピーしてSNSで共有したり、スクリーンショットを撮って思い出に残しましょう。
          </p>
        </div>
      </div>
    </Layout>
  );
};
