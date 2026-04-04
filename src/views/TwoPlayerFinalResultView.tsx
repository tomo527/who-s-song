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

interface TwoPlayerFinalResultViewProps {
  room: Room;
  players: Player[];
  currentPlayerId: string;
  onBackToHome: () => void;
}

const formatRate = (rate: number, correct: number, total: number) =>
  total > 0 ? `${rate}% (${correct}/${total})` : 'データなし';

const flatCardClass = 'border-2 border-slate-600/40 bg-slate-100 shadow-none hover:border-slate-600/40 hover:bg-slate-100';

export const TwoPlayerFinalResultView: React.FC<TwoPlayerFinalResultViewProps> = ({
  room,
  players,
  currentPlayerId,
  onBackToHome,
}) => {
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState<FinalStatsSummary | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [isRestarting, setIsRestarting] = useState(false);
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

        setStats(buildFinalStats(players, result.rounds, result.submissions, result.guesses, 'duo'));
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

  const orderedStats = useMemo(
    () => players
      .map((player) => stats?.players.find((candidate) => candidate.playerId === player.id) ?? null)
      .filter((playerStat): playerStat is PlayerFinalStats => playerStat !== null),
    [players, stats],
  );
  const mutualStat = stats?.mutualRates[0] ?? null;
  const resultsText = useMemo(() => {
    if (!orderedStats.length) {
      return `誰の曲？匿名セトリ推理ゲーム 2人用 最終結果\nジャンル: ${room.settings.genre || '未設定'}`;
    }

    const lines = orderedStats.flatMap((playerStat) => [
      `${playerStat.playerName} 親で当てた数 ${playerStat.parentCorrect}/${playerStat.parentTotal}`,
      `${playerStat.playerName} 当ててもらえた数 ${playerStat.identifiedCorrect}/${playerStat.identifiedTotal}`,
    ]);

    if (mutualStat) {
      lines.push(`お互いの理解率 ${mutualStat.rate}% (${mutualStat.correct}/${mutualStat.total})`);
    }

    return `誰の曲？匿名セトリ推理ゲーム 2人用 最終結果\nジャンル: ${room.settings.genre || '未設定'}\n\n${lines.join('\n')}`;
  }, [mutualStat, orderedStats, room.settings.genre]);

  const handleCopyResults = async () => {
    await navigator.clipboard.writeText(resultsText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handlePostToX = () => {
    const postText = [
      '誰の曲？匿名セトリ推理ゲームで遊びました！',
      resultsText,
      'https://who-s-song.pages.dev/',
    ].join('\n');
    const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(postText)}`;

    window.open(intentUrl, '_blank', 'noopener,noreferrer');
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
            Final Summary
          </div>
          <h2 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">お互いの理解度</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            ジャンルは <span className="font-semibold text-slate-900">{room.settings.genre || '未設定'}</span> でした。
            2人でどれだけ当て合えたかをまとめています。
          </p>
        </div>

        {statsLoading ? (
          <Card className={flatCardClass}>
            <p className="text-sm text-slate-600">最終結果を読み込み中です...</p>
          </Card>
        ) : statsError ? (
          <Card className={flatCardClass}>
            <p className="text-sm text-red-600">{statsError}</p>
          </Card>
        ) : (
          <>
            <div className="space-y-4">
              {orderedStats.map((playerStat) => (
                <Card
                  key={playerStat.playerId}
                  className="space-y-4 border-2 border-slate-400 bg-white shadow-none hover:border-slate-400 hover:bg-white"
                >
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900">{playerStat.playerName}</h3>
                    <p className="mt-1 text-sm text-slate-500">{playerStat.score}pt</p>
                  </div>
                  <div className="grid gap-3">
                    <MetricBlock
                      label="親として当てた数"
                      value={`${playerStat.parentCorrect} / ${playerStat.parentTotal}`}
                      helper={formatRate(playerStat.parentHitRate, playerStat.parentCorrect, playerStat.parentTotal)}
                    />
                    <MetricBlock
                      label="当ててもらえた数"
                      value={`${playerStat.identifiedCorrect} / ${playerStat.identifiedTotal}`}
                      helper={formatRate(playerStat.identifiedRate, playerStat.identifiedCorrect, playerStat.identifiedTotal)}
                    />
                  </div>
                </Card>
              ))}
            </div>

            <Card className={flatCardClass}>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Mutual Match</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-900">お互いの理解率</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  親として当てた回数と、相手から当ててもらえた回数をペア全体でまとめた数値です。
                </p>
              </div>
              <div className="mt-4 rounded-2xl border-2 border-slate-300 bg-white px-4 py-4">
                <p className="text-3xl font-semibold text-primary-600">
                  {mutualStat ? `${mutualStat.rate}%` : 'データなし'}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  {mutualStat ? `${mutualStat.correct} / ${mutualStat.total} ターンで一致` : 'ゲーム結果が十分にありません。'}
                </p>
              </div>
            </Card>
          </>
        )}

        <div className="space-y-4 pt-12">
          <Button variant="primary" fullWidth onClick={handleRestart} isLoading={isRestarting} disabled={!isHost}>
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
          <Button variant="secondary" fullWidth onClick={handlePostToX}>
            Xにポスト
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

function MetricBlock({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border-2 border-slate-300 bg-slate-50 px-4 py-4">
      <p className="text-sm font-semibold text-slate-900">{label}</p>
      <p className="mt-2 text-lg font-semibold text-primary-600">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{helper}</p>
    </div>
  );
}
