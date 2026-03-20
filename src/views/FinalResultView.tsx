import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Layout } from '../components/Layout';
import { fetchFinishedGameData, getCurrentGameId, restartGame } from '../firebase/game';
import {
  buildFinalStats,
  type FinalStatsSummary,
  type PlayerFinalStats,
} from '../logic/finalStats';
import type { Player, Room } from '../types';

interface FinalResultViewProps {
  room: Room;
  players: Player[];
  currentPlayerId: string;
  onBackToHome: () => void;
}

type RankedPlayer = Player & { rank: number };

const getRankedPlayers = (players: Player[]): RankedPlayer[] => {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'ja'));

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

const formatRate = (rate: number, correct: number, total: number) =>
  total > 0 ? `${rate}% (${correct}/${total})` : '機会なし';

export const FinalResultView: React.FC<FinalResultViewProps> = ({
  room,
  players,
  currentPlayerId,
  onBackToHome,
}) => {
  const [copied, setCopied] = React.useState(false);
  const [stats, setStats] = useState<FinalStatsSummary | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [isRestarting, setIsRestarting] = useState(false);
  const rankedPlayers = useMemo(() => getRankedPlayers(players), [players]);
  const podiumPlayers = rankedPlayers.filter((player) => player.rank <= 3);
  const otherPlayers = rankedPlayers.filter((player) => player.rank > 3);
  const winner = rankedPlayers[0] ?? null;
  const isHost = currentPlayerId === room.hostId;
  const currentGameId = getCurrentGameId(room);

  useEffect(() => {
    let cancelled = false;

    setStatsLoading(true);
    setStatsError(null);

    void fetchFinishedGameData(room.id, currentGameId)
      .then((result) => {
        if (cancelled) {
          return;
        }

        setStats(buildFinalStats(players, result.rounds, result.submissions, result.guesses));
        setStatsLoading(false);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setStatsError(error instanceof Error ? error.message : 'stats の読み込みに失敗しました。');
        setStatsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentGameId, players, room.id]);

  const handleCopyResults = async () => {
    const lines = rankedPlayers.map((player) => `${player.rank}位 ${player.name} (${player.score}pt)`);
    const fullText = `誰の曲？匿名セトリ推理ゲーム 最終結果\nジャンル: ${room.settings.genre || '未設定'}\n\n${lines.join('\n')}`;

    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleRestart = async () => {
    if (!isHost || isRestarting) {
      return;
    }

    setIsRestarting(true);
    try {
      await restartGame(room, players);
    } finally {
      setIsRestarting(false);
    }
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
            ジャンルは <span className="font-semibold text-white">{room.settings.genre || '未設定'}</span> でした。
            1ゲームぶんのスコアと相互理解の結果をまとめて表示します。
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            スコアは親役の正解が中心です。そこに「その人らしい」と伝わった提出曲の加点と、控えめな BEST 加点を足して集計しています。
          </p>
        </div>

        {winner && (
          <Card className="bg-linear-to-br from-primary-500/18 to-accent-500/14 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary-100">Winner</p>
            <h3 className="mt-2 text-3xl font-semibold text-white">{winner.name}</h3>
            <p className="mt-2 text-sm text-slate-300">{winner.score}pt で勝利です</p>
          </Card>
        )}

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

        <Card className="space-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Stats</p>
            <h3 className="mt-2 text-xl font-semibold text-white">理解度のまとめ</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              誰をどれだけ見抜けたか、そして自分の選曲がどれだけ自分らしく伝わったかを並べています。
            </p>
          </div>

          {statsLoading ? (
            <p className="text-sm text-slate-300">stats を集計しています...</p>
          ) : statsError ? (
            <p className="text-sm text-red-200">{statsError}</p>
          ) : (
            <div className="space-y-4">
              {stats?.players.map((playerStat) => (
                <PlayerStatsCard key={playerStat.playerId} stat={playerStat} />
              ))}
            </div>
          )}
        </Card>

        {!statsLoading && !statsError && stats && stats.mutualRates.length > 0 && (
          <Card className="space-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Mutual Understanding</p>
            <h3 className="mt-2 text-xl font-semibold text-white">相互理解率</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              2人の組み合わせごとに、お互いをどれだけ当て合えたかを表示します。
            </p>
          </div>
            <div className="space-y-3">
              {stats.mutualRates.map((mutualRate) => (
                <div
                  key={mutualRate.pairKey}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {mutualRate.leftPlayerName} ↔ {mutualRate.rightPlayerName}
                    </p>
                    <p className="text-xs text-slate-400">
                      {mutualRate.correct} / {mutualRate.total} ターンで一致
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-primary-100">{mutualRate.rate}%</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <div className="pt-12 space-y-4">
          <Button
            variant="primary"
            fullWidth
            onClick={handleRestart}
            isLoading={isRestarting}
            disabled={!isHost}
          >
            もう1ゲーム遊ぶ
          </Button>
          {!isHost && (
            <p className="text-center text-sm text-slate-400">
              ホストが選ぶと、同じメンバー・同じジャンルのままロビーに戻れます。
            </p>
          )}
          <Button variant="secondary" fullWidth onClick={handleCopyResults}>
            {copied ? 'コピーしました' : '結果をコピーする'}
          </Button>
          <Button variant="secondary" fullWidth onClick={onBackToHome}>
            終了してTOPへ戻る
          </Button>
        </div>
      </div>
    </Layout>
  );
};

function PlayerStatsCard({ stat }: { stat: PlayerFinalStats }) {
  return (
    <Card className="space-y-4 bg-white/6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold text-white">{stat.playerName}</h4>
          <p className="text-sm text-slate-400">{stat.score}pt</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/8 px-3 py-2 text-right">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Overall</p>
          <p className="text-lg font-semibold text-white">{stat.overallHitRate}%</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricBlock
          label="総合理解率"
          value={formatRate(stat.overallHitRate, stat.parentCorrect + stat.identifiedCorrect, stat.parentTotal + stat.identifiedTotal)}
        />
        <MetricBlock
          label="親役時の的中率"
          value={formatRate(stat.parentHitRate, stat.parentCorrect, stat.parentTotal)}
        />
        <MetricBlock
          label="自分らしさ伝達率"
          value={formatRate(stat.identifiedRate, stat.identifiedCorrect, stat.identifiedTotal)}
        />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">相手ごとの理解率</p>
        <div className="grid gap-2">
          {stat.directionalRates.map((directionalRate) => (
            <div
              key={directionalRate.otherPlayerId}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/12 px-3 py-3"
            >
              <p className="text-sm text-slate-200">{stat.playerName} → {directionalRate.otherPlayerName}</p>
              <p className="text-sm font-semibold text-white">
                {directionalRate.total > 0 ? `${directionalRate.rate}%` : '機会なし'}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function MetricBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/12 px-3 py-3">
      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
