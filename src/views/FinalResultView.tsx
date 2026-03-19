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
  const podiumPlayers = rankedPlayers.filter((player) => player.rank <= 3);
  const otherPlayers = rankedPlayers.filter((player) => player.rank > 3);

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
        <div className="py-4 text-center">
          <div className="inline-flex rounded-full border border-white/10 bg-white/8 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">
            Final Ranking
          </div>
          <h2 className="mt-4 text-4xl font-semibold tracking-tight text-white">ランキング</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            最後まで遊んだ全員のスコアです。コピーしてそのままシェアできます。
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {podiumPlayers.map((player) => {
            const podiumStyle =
              player.rank === 1
                ? 'border-yellow-300/50 bg-yellow-300/12'
                : player.rank === 2
                  ? 'border-slate-300/30 bg-slate-200/10'
                  : 'border-orange-300/40 bg-orange-300/10';

            return (
              <Card key={player.id} className={`relative overflow-hidden text-center ${podiumStyle}`}>
                <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/10 to-transparent" />
                <div className="relative py-3">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[1.5rem] border border-white/15 bg-white/10 text-2xl font-semibold text-white">
                    {player.rank}
                  </div>
                  <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">Player</p>
                  <h3 className="mt-2 text-2xl font-semibold text-white">{player.name}</h3>
                  <div className="mt-5 text-4xl font-semibold text-white">
                    {player.score}
                    <span className="ml-1 text-sm text-slate-300">pt</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {otherPlayers.length > 0 && (
          <Card className="space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">All Players</p>
              <h3 className="mt-2 text-xl font-semibold text-white">そのほかの順位</h3>
            </div>
            <div className="space-y-3">
              {otherPlayers.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-lg font-semibold text-slate-100">
                    {player.rank}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold text-white">{player.name}</p>
                  </div>
                  <div className="text-right text-xl font-semibold text-primary-100">
                    {player.score}
                    <span className="ml-1 text-xs text-slate-400">pt</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <div className="pt-12 space-y-4">
          <Button variant="primary" fullWidth onClick={handleCopyResults}>
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
