import React, { useEffect, useMemo, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { Layout } from '../components/Layout';
import { DEFAULT_ROUNDS_COUNT, MAX_PLAYERS, MIN_PLAYERS } from '../constants/game';
import { getRandomPrompt } from '../constants/prompts';
import { getDb } from '../firebase/config';
import { createRound, subscribeRound } from '../firebase/game';
import { subscribePlayers } from '../firebase/player';
import { getRotatingParent } from '../logic/parentRotation';
import type { Player, Room } from '../types';

interface LobbyViewProps {
  room: Room;
  isHost: boolean;
  currentPlayerId: string;
  onStartGame: (roundId: string) => void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  room,
  isHost,
  currentPlayerId,
  onStartGame,
}) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [draftPrompt, setDraftPrompt] = useState(() => room.settings.theme || getRandomPrompt());

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

  const currentParent = useMemo(
    () => getRotatingParent(players, 1),
    [players],
  );
  const isCurrentParent = currentParent?.id === currentPlayerId;

  const updateRoomSettings = async (values: Partial<Room['settings']>) => {
    const db = getDb();
    await updateDoc(doc(db, 'rooms', room.id), {
      ...(values.roundsCount !== undefined ? { 'settings.roundsCount': values.roundsCount } : {}),
    });
  };

  const handleStart = async () => {
    if (!isCurrentParent || players.length < MIN_PLAYERS || !currentParent) {
      return;
    }

    const theme = draftPrompt.trim() || getRandomPrompt();
    const roundId = await createRound(
      room.id,
      theme,
      1,
      currentParent.id,
    );

    const db = getDb();
    await updateDoc(doc(db, 'rooms', room.id), {
      status: 'active',
      'settings.roundsCount': room.settings.roundsCount || DEFAULT_ROUNDS_COUNT,
    });

    onStartGame(roundId);
  };

  const participantsLabel = `${players.length} / ${MAX_PLAYERS}人`;

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
              <p className="text-lg font-semibold text-white">{participantsLabel}</p>
            </div>
          </div>
        </Card>

        <Card className="bg-linear-to-br from-white/10 to-accent-500/10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">Round Parent</p>
          <h3 className="mt-2 text-2xl font-semibold text-white">
            {currentParent ? `${currentParent.name} が1ラウンド目の親役です` : '親役を準備中'}
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            親役は曲を提出せず、提出された匿名曲の提出者を推理します。親役はラウンドごとに順番に交代します。
          </p>
        </Card>

        {isHost && (
          <Card>
            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Host Controls</p>
                <h3 className="mt-1 text-xl font-semibold text-white">ルーム設定</h3>
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-300">ラウンド数</label>
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
        )}

        {isCurrentParent ? (
          <Card>
            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary-100">Parent Controls</p>
                <h3 className="mt-1 text-xl font-semibold text-white">このラウンドのお題を決める</h3>
              </div>
              <Button
                type="button"
                variant="secondary"
                fullWidth
                onClick={() => setDraftPrompt((current) => getRandomPrompt(current))}
              >
                ランダムなお題を表示
              </Button>
              <Input
                label="今回のお題"
                placeholder="例: ドライブで流したい曲"
                value={draftPrompt}
                onChange={(event) => setDraftPrompt(event.target.value)}
                helperText="ランダム候補を出したあとに手修正できます"
              />
              <Button
                size="xl"
                fullWidth
                disabled={players.length < MIN_PLAYERS || !draftPrompt.trim()}
                onClick={handleStart}
              >
                {players.length < MIN_PLAYERS ? `${MIN_PLAYERS}人以上集まると開始できます` : 'このお題で開始'}
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="bg-white/7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Waiting</p>
            <h3 className="mt-2 text-lg font-semibold text-white">親役がお題を準備しています</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {currentParent ? `${currentParent.name} が準備できたらゲームが始まります。` : 'プレイヤー情報を同期中です。'}
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
                    <div className="flex flex-wrap gap-2 text-[11px] font-medium">
                      {player.isHost && <span className="text-primary-200">Host</span>}
                      {currentParent?.id === player.id && <span className="text-accent-200">親役</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Layout>
  );
};
