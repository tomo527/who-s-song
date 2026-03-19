import React, { useEffect, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Layout } from '../components/Layout';
import { getDb } from '../firebase/config';
import { createRound, subscribeRound } from '../firebase/game';
import { subscribePlayers } from '../firebase/player';
import type { Player, Room } from '../types';

interface LobbyViewProps {
  room: Room;
  isHost: boolean;
  onStartGame: (roundId: string) => void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({ room, isHost, onStartGame }) => {
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    const unsubscribePlayers = subscribePlayers(room.id, setPlayers);
    let unsubscribeRound = () => {};

    if (room.currentRoundId) {
      unsubscribeRound = subscribeRound(room.id, room.currentRoundId, (round) => {
        if (round?.phase === 'submitting') {
          onStartGame(round.id);
        }
      });
    }

    return () => {
      unsubscribePlayers();
      unsubscribeRound();
    };
  }, [onStartGame, room.currentRoundId, room.id]);

  const updateRoomSettings = async (values: Partial<Room['settings']>) => {
    const db = getDb();
    await updateDoc(doc(db, 'rooms', room.id), {
      ...(values.theme !== undefined ? { 'settings.theme': values.theme } : {}),
      ...(values.roundsCount !== undefined ? { 'settings.roundsCount': values.roundsCount } : {}),
    });
  };

  const handleStart = async () => {
    if (!isHost) {
      return;
    }

    const initialTheme = room.settings.theme?.trim() || 'いま一番おすすめしたい曲';
    const roundsCount = room.settings.roundsCount || 3;
    const roundId = await createRound(room.id, initialTheme, 1);

    const db = getDb();
    await updateDoc(doc(db, 'rooms', room.id), {
      status: 'active',
      'settings.roundsCount': roundsCount,
    });

    onStartGame(roundId);
  };

  return (
    <Layout title="ロビー">
      <div className="space-y-5 pb-10">
        <Card className="overflow-hidden bg-linear-to-br from-primary-500/22 via-white/8 to-accent-500/18">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-200">Room Ready</p>
          <div className="mt-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-slate-300">ルームコード</p>
              <div className="mt-1 text-5xl font-black tracking-[0.18em] text-white">{room.roomCode}</div>
            </div>
            <div className="rounded-2xl border border-white/12 bg-black/16 px-3 py-2 text-right">
              <p className="text-[11px] text-slate-400">参加人数</p>
              <p className="text-lg font-semibold text-white">{players.length}人</p>
            </div>
          </div>
        </Card>

        {isHost ? (
          <Card>
            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Host Controls</p>
                <h3 className="mt-1 text-xl font-semibold text-white">ゲームを整える</h3>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">最初のお題</label>
                <input
                  type="text"
                  value={room.settings.theme || ''}
                  placeholder="例: いま一番おすすめしたい曲"
                  className="w-full rounded-[1.25rem] border border-white/12 bg-white/8 px-4 py-3.5 text-slate-50 placeholder:text-slate-400 outline-none transition focus:border-primary-300/70 focus:bg-white/12 focus:ring-4 focus:ring-primary-300/10"
                  onChange={(event) => void updateRoomSettings({ theme: event.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">ラウンド数</label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 5].map((roundCount) => (
                    <button
                      type="button"
                      key={roundCount}
                      onClick={() => void updateRoomSettings({ roundsCount: roundCount })}
                      className={`rounded-2xl px-3 py-3 text-sm font-semibold transition ${
                        room.settings.roundsCount === roundCount
                          ? 'bg-linear-to-r from-primary-500 to-accent-500 text-white shadow-[0_18px_40px_-22px_rgba(59,130,246,0.8)]'
                          : 'border border-white/10 bg-white/7 text-slate-300 hover:bg-white/12'
                      }`}
                    >
                      {roundCount}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="bg-white/7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Game Info</p>
            <h3 className="mt-2 text-lg font-semibold text-white">{room.settings.theme || 'ホストが準備中です'}</h3>
            <p className="mt-2 inline-flex rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs font-medium text-slate-300">
              {room.settings.roundsCount} ラウンド予定
            </p>
          </Card>
        )}

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Players</p>
              <h3 className="mt-1 text-lg font-semibold text-white">参加メンバー</h3>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/18 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
              接続中
            </div>
          </div>

          <div className="mt-4 grid gap-2">
            {players.map((player) => (
              <div
                key={player.id}
                className={`flex items-center justify-between rounded-[1.35rem] border px-4 py-3 ${
                  player.isHost ? 'border-primary-300/24 bg-primary-400/12' : 'border-white/10 bg-white/6'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-bold ${
                      player.isHost ? 'bg-linear-to-br from-primary-400 to-accent-500 text-white' : 'bg-white/10 text-slate-100'
                    }`}
                  >
                    {player.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-white">{player.name}</p>
                    {player.isHost && <p className="text-[11px] font-medium text-primary-200">Host</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {isHost ? (
          <div className="space-y-3 pt-1">
            <Button size="xl" fullWidth disabled={players.length < 2} onClick={handleStart}>
              {players.length < 2 ? '2人以上集まると開始できます' : 'この設定でゲームを始める'}
            </Button>
            <p className="text-center text-xs text-slate-400">
              {players.length < 2 ? '最低2人でプレイできます。' : '通話をつないだまま開始すると遊びやすいです。'}
            </p>
          </div>
        ) : (
          <Card className="bg-white/6 text-center">
            <p className="text-sm font-medium text-slate-300">ホストがゲームを開始するまで、そのままお待ちください。</p>
          </Card>
        )}
      </div>
    </Layout>
  );
};
