import React from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Layout } from '../components/Layout';
import type { Player, Room } from '../types';

interface FinalResultViewProps {
  room: Room;
  players: Player[];
  onBackToHome: () => void;
}

type RankedPlayer = Player & { rank: number };

const getRankedPlayers = (players: Player[]): RankedPlayer[] => {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return sortedPlayers.map((player, index) => {
    const higherScoreCount = sortedPlayers
      .slice(0, index)
      .filter((candidate) => candidate.score > player.score).length;

    return {
      ...player,
      rank: higherScoreCount + 1,
    };
  });
};

export const FinalResultView: React.FC<FinalResultViewProps> = ({ players, onBackToHome }) => {
  const [copied, setCopied] = React.useState(false);
  const rankedPlayers = getRankedPlayers(players);

  const handleCopyResults = async () => {
    const lines = rankedPlayers.map((player) => `${player.rank}位 ${player.name} (${player.score}pt)`);
    const fullText = `誰の曲？匿名セトリ推理ゲーム 最終結果\n\n${lines.join('\n')}`;

    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Layout title="最終結果">
      <div className="space-y-8 pb-12">
        <div className="text-center py-6">
          <div className="inline-block p-1 rounded-full bg-primary-50 mb-4 px-4">
            <span className="text-xs font-bold text-primary-600 uppercase tracking-widest">Final Ranking</span>
          </div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">ランキング</h2>
        </div>

        <div className="space-y-4">
          {rankedPlayers.map((player) => {
            const isTop3 = player.rank <= 3;
            const rankColors = [
              'bg-yellow-400 text-white',
              'bg-slate-300 text-slate-700',
              'bg-orange-300 text-white',
            ];

            return (
              <Card
                key={player.id}
                className={`relative overflow-hidden transition-all duration-500 ${
                  player.rank === 1 ? 'ring-4 ring-primary-500 ring-offset-2 scale-105 my-6' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-sm ${
                      isTop3 ? rankColors[player.rank - 1] : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {player.rank}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-400 leading-none mb-1">Player</p>
                    <h4 className="text-xl font-black text-slate-800 truncate">{player.name}</h4>
                  </div>

                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-400 leading-none mb-1">Score</p>
                    <div className="text-2xl font-black text-primary-600">
                      {player.score}
                      <span className="text-xs ml-0.5">pt</span>
                    </div>
                  </div>
                </div>

                {player.rank === 1 && (
                  <div className="absolute top-[-20px] right-[-20px] w-16 h-16 bg-primary-500/10 rounded-full blur-xl animate-pulse" />
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
            {copied ? 'コピーしました' : '結果をコピーする'}
          </Button>
          <Button variant="secondary" fullWidth onClick={onBackToHome}>
            ホームに戻る
          </Button>
        </div>
      </div>
    </Layout>
  );
};
