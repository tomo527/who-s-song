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
      <div className="space-y-8 pb-10">
        <Card className="text-center py-6 border-dashed border-slate-200">
          <p className="text-[10px] font-black text-slate-400 mb-1 uppercase tracking-tighter">Room Code</p>
          <div className="text-5xl font-black tracking-widest text-primary-600">{room.roomCode}</div>
        </Card>

        {isHost ? (
          <Card className="bg-primary-50/20 border-primary-100">
            <h3 className="font-black text-primary-700 mb-4">ゲーム設定</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">最初のお題</label>
                <input
                  type="text"
                  value={room.settings.theme || ''}
                  placeholder="例: いま一番おすすめしたい曲"
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-primary-400 outline-none font-bold text-slate-700 placeholder:text-slate-300 transition-all shadow-sm"
                  onChange={(event) => void updateRoomSettings({ theme: event.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">ラウンド数</label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 5].map((roundCount) => (
                    <button
                      type="button"
                      key={roundCount}
                      onClick={() => void updateRoomSettings({ roundsCount: roundCount })}
                      className={`flex-1 py-2 rounded-lg font-black text-sm transition-all ${
                        room.settings.roundsCount === roundCount
                          ? 'bg-primary-600 text-white shadow-md shadow-primary-200'
                          : 'bg-white text-slate-400 border-2 border-slate-100 hover:border-slate-200'
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
          <Card className="bg-slate-50 border-slate-100 text-center py-4">
            <p className="text-xs font-bold text-slate-400 mb-1">最初のお題</p>
            <p className="text-xl font-black text-slate-700">{room.settings.theme || 'ホストが設定中です'}</p>
            <div className="mt-2 text-[10px] font-bold text-primary-400 bg-white inline-block px-2 py-0.5 rounded-full border border-primary-100">
              {room.settings.roundsCount} ラウンド
            </div>
          </Card>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-700">参加者 ({players.length}人)</h3>
            <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 rounded-full">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-green-600">接続中</span>
            </div>
          </div>

          <div className="grid gap-2">
            {players.map((player) => (
              <div
                key={player.id}
                className={`flex items-center justify-between p-4 rounded-2xl border-2 ${
                  player.isHost ? 'border-primary-100 bg-primary-50/30' : 'border-slate-50 bg-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-sm ${
                      player.isHost ? 'bg-primary-500' : 'bg-slate-300'
                    }`}
                  >
                    {player.name.charAt(0)}
                  </div>
                  <div>
                    <span className="font-bold text-slate-700">{player.name}</span>
                    {player.isHost && (
                      <p className="text-[10px] font-black text-primary-400 tracking-tighter uppercase">Host</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {isHost ? (
          <div className="pt-6">
            <Button size="lg" fullWidth disabled={players.length < 2} onClick={handleStart}>
              {players.length < 2 ? '2人以上集まるまで待機中...' : 'ゲームを開始する'}
            </Button>
            {players.length < 2 && (
              <p className="mt-2 text-center text-xs text-slate-400">ゲーム開始には2人以上の参加が必要です。</p>
            )}
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-sm font-bold text-slate-500">ホストがゲームを開始するまでお待ちください。</p>
          </div>
        )}
      </div>
    </Layout>
  );
};
