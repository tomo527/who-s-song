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
  total > 0 ? `${rate}% (${correct}/${total})` : 'データなし';

const flatCardClass = 'border-2 border-slate-600/40 bg-slate-100 shadow-none hover:border-slate-600/40 hover:bg-slate-100';

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
  const topMutualRates = useMemo(() => stats?.mutualRates.slice(0, 3) ?? [], [stats]);

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
          <div className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Final Ranking
          </div>
          <h2 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">ランキング</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            ジャンルは <span className="font-semibold text-slate-900">{room.settings.genre || '未設定'}</span> でした。
            1ゲームぶんのスコアと理解度をまとめています。
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            スコアは Game Master の正解と、プレイヤー側で当ててもらえた曲をもとに集計しています。
          </p>
        </div>

        {winner && (
          <Card className="border-2 border-primary-400 bg-primary-50 text-center shadow-none hover:border-primary-400 hover:bg-primary-50">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary-600">Winner</p>
            <h3 className="mt-2 text-3xl font-semibold text-slate-950">{winner.name}</h3>
            <p className="mt-2 text-sm text-slate-600">{winner.score}pt でトップでした</p>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          {podiumPlayers.map((player) => {
            const podiumStyle =
              player.rank === 1
                ? 'border-yellow-400 bg-yellow-50'
                : player.rank === 2
                  ? 'border-slate-400 bg-slate-100'
                  : 'border-orange-400 bg-orange-50';

            return (
              <Card key={player.id} className={`text-center shadow-none hover:bg-inherit ${podiumStyle}`}>
                <div className="py-3">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[1.5rem] border-2 border-slate-300 bg-white text-2xl font-semibold text-slate-900">
                    {player.rank}
                  </div>
                  <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Player</p>
                  <h3 className="mt-2 text-2xl font-semibold text-slate-950">{player.name}</h3>
                  <div className="mt-5 text-4xl font-semibold text-slate-950">
                    {player.score}
                    <span className="ml-1 text-sm text-slate-500">pt</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {otherPlayers.length > 0 && (
          <Card className={flatCardClass}>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">All Players</p>
              <h3 className="mt-2 text-xl font-semibold text-slate-900">そのほかの順位</h3>
            </div>
            <div className="mt-4 space-y-3">
              {otherPlayers.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center gap-4 rounded-2xl border-2 border-slate-300 bg-white px-4 py-4"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-slate-300 bg-slate-100 text-lg font-semibold text-slate-900">
                    {player.rank}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold text-slate-900">{player.name}</p>
                  </div>
                  <div className="text-right text-xl font-semibold text-primary-600">
                    {player.score}
                    <span className="ml-1 text-xs text-slate-500">pt</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className={flatCardClass}>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Stats</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">理解度のまとめ</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              親としてどれだけ当てたか、自分らしさがどれだけ伝わったかを並べています。
            </p>
          </div>

          <div className="rounded-3xl border-2 border-slate-300 bg-white px-5 py-5">
            <div className="border-b border-slate-200 pb-3">
              <p className="text-sm font-semibold text-slate-900">スタッツの見方</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                3つの指標を見ると、理解する力と理解される力の両方を分けて確認できます。
              </p>
            </div>
            <div className="mt-4 space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">総合正答率</p>
                <p className="text-sm leading-6 text-slate-600">
                  親側で当てた割合と、プレイヤー側で当ててもらった割合を合計した全体での正答率。どれだけ参加者のことを理解し、理解されていたかの総合得点
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">親ターンの時に当てた割合</p>
                <p className="text-sm leading-6 text-slate-600">どれだけ他の参加者のことを理解しているか</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">プレイヤー側で当ててもらった割合</p>
                <p className="text-sm leading-6 text-slate-600">どれだけ他の参加者に理解されているか</p>
              </div>
            </div>
          </div>

          {statsLoading ? (
            <p className="text-sm text-slate-600">stats を読み込み中です...</p>
          ) : statsError ? (
            <p className="text-sm text-red-600">{statsError}</p>
          ) : (
            <div className="space-y-4">
              {stats?.players.map((playerStat) => (
                <PlayerStatsCard key={playerStat.playerId} stat={playerStat} />
              ))}
            </div>
          )}
        </Card>

        {!statsLoading && !statsError && topMutualRates.length > 0 && (
          <Card className={flatCardClass}>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Mutual Match</p>
              <h3 className="mt-2 text-xl font-semibold text-slate-900">うちとけ度 TOP3</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                お互いをどれだけ当て合えたかを、相性の高い組み合わせだけに絞って表示しています。
              </p>
            </div>
            <div className="mt-4 space-y-3">
              {topMutualRates.map((mutualRate, index) => (
                <div
                  key={mutualRate.pairKey}
                  className="flex items-center gap-4 rounded-2xl border-2 border-slate-300 bg-white px-4 py-4"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-2 border-primary-300 bg-primary-50 text-sm font-semibold text-primary-600">
                    {index + 1}位
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {mutualRate.leftPlayerName} × {mutualRate.rightPlayerName}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {mutualRate.correct} / {mutualRate.total} ターンで一致
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-primary-600">{mutualRate.rate}%</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <div className="space-y-4 pt-12">
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
            <p className="text-center text-sm text-slate-500">
              ホストが選ぶと、同じメンバー・同じジャンルのままロビーへ戻ります。
            </p>
          )}
          <Button variant="secondary" fullWidth onClick={handleCopyResults}>
            {copied ? 'コピーしました' : '結果をコピーする'}
          </Button>
          <Button variant="secondary" fullWidth onClick={onBackToHome}>
            終了してTOPへ戻る
          </Button>
        </div>

        <Card className="border-2 border-slate-600/40 bg-slate-50 shadow-none hover:border-slate-600/40 hover:bg-slate-50">
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Support</p>
              <h3 className="mt-2 text-xl font-semibold text-slate-900">このゲームが楽しかったら</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                もし「面白かった」「また遊びたい」と思ってもらえたら、コーヒー代のご支援をいただけるとうれしいです。
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">開発継続の励みになります。</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                もちろん任意です。遊んでもらえるだけでも本当にうれしいです。
              </p>
            </div>
            <a
              href="https://buymeacoffee.com/tomo_036924768"
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-center rounded-2xl border-2 border-primary-500 bg-white px-4 py-3 text-sm font-semibold text-primary-600 transition hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-200"
            >
              Buy me a coffee
            </a>
          </div>
        </Card>
      </div>
    </Layout>
  );
};

function PlayerStatsCard({ stat }: { stat: PlayerFinalStats }) {
  return (
    <Card className="space-y-4 border-2 border-slate-400 bg-white shadow-none hover:border-slate-400 hover:bg-white">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold text-slate-900">{stat.playerName}</h4>
          <p className="text-sm text-slate-500">{stat.score}pt</p>
        </div>
        <div className="rounded-2xl border-2 border-slate-300 bg-slate-100 px-3 py-2 text-right">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Overall</p>
          <p className="text-lg font-semibold text-slate-900">{stat.overallHitRate}%</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricBlock
          label="総合正答率"
          value={formatRate(stat.overallHitRate, stat.parentCorrect + stat.identifiedCorrect, stat.parentTotal + stat.identifiedTotal)}
        />
        <MetricBlock
          label="親ターンの時に当てた割合"
          value={formatRate(stat.parentHitRate, stat.parentCorrect, stat.parentTotal)}
        />
        <MetricBlock
          label="プレイヤー側で当ててもらった割合"
          value={formatRate(stat.identifiedRate, stat.identifiedCorrect, stat.identifiedTotal)}
        />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">相手ごとの理解率</p>
        <div className="grid gap-2">
          {stat.directionalRates.map((directionalRate) => (
            <div
              key={directionalRate.otherPlayerId}
              className="flex items-center justify-between rounded-2xl border-2 border-slate-300 bg-slate-50 px-3 py-3"
            >
              <p className="text-sm text-slate-700">{stat.playerName} → {directionalRate.otherPlayerName}</p>
              <p className="text-sm font-semibold text-slate-900">
                {directionalRate.total > 0 ? `${directionalRate.rate}%` : 'データなし'}
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
    <div className="rounded-2xl border-2 border-slate-300 bg-slate-50 px-3 py-3">
      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
