import React, { useMemo, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { Layout } from '../components/Layout';
import { MAX_PLAYERS, MIN_PLAYERS, MINIMUM_GAME_TURNS } from '../constants/game';
import { getDb } from '../firebase/config';
import { createRound, getCurrentGameId } from '../firebase/game';
import { getGameEndTurn } from '../logic/gameProgress';
import { getRotatingParent } from '../logic/parentRotation';
import type { Player, Room } from '../types';

interface LobbyViewProps {
  room: Room;
  players: Player[];
  isHost: boolean;
  currentPlayerId: string;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  room,
  players,
  isHost,
  currentPlayerId,
}) => {
  const [draftGenre, setDraftGenre] = useState(room.settings.genre || '');

  const currentParent = useMemo(() => getRotatingParent(players, 1), [players]);
  const isCurrentParent = currentParent?.id === currentPlayerId;
  const participantsLabel = `${players.length} / ${MAX_PLAYERS}`;
  const gameEndTurn = getGameEndTurn(players.length, room.settings.roundsCount || MINIMUM_GAME_TURNS);
  const canStart = players.length >= MIN_PLAYERS && Boolean(room.settings.genre.trim()) && Boolean(currentParent);

  const flatCardClass = 'border-2 border-slate-600/40 bg-slate-100 shadow-none hover:border-slate-600/40 hover:bg-slate-100';

  const updateRoomSettings = async (values: Partial<Room['settings']>) => {
    const db = getDb();
    const nextGenre = values.genre !== undefined ? values.genre.trim() : undefined;

    await updateDoc(doc(db, 'rooms', room.id), {
      ...(nextGenre !== undefined ? { 'settings.genre': nextGenre } : {}),
    });
  };

  const handleStart = async () => {
    if (!isCurrentParent || players.length < MIN_PLAYERS || !currentParent || !room.settings.genre.trim()) {
      return;
    }

    await createRound(
      room.id,
      '',
      1,
      currentParent.id,
      getCurrentGameId(room),
    );

    const db = getDb();
    await updateDoc(doc(db, 'rooms', room.id), {
      status: 'active',
    });
  };

  return (
    <Layout title="ロビー">
      <div className="space-y-5 pb-10 text-slate-900">
        <Card className={flatCardClass}>
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Room Ready</p>
              <h2 className="text-2xl font-semibold text-slate-900">メンバーがそろったら開始できます</h2>
              <p className="text-sm leading-6 text-slate-600">
                ルーム開始後、そのターンの親がお題を決めてから提出フェーズに入ります。
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem] sm:items-stretch">
              <div className="rounded-[1.5rem] border-2 border-slate-400 bg-slate-50 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Room Code</p>
                <p className="mt-2 text-4xl font-black tracking-[0.18em] text-slate-950">{room.roomCode}</p>
                <p className="mt-3 text-sm text-slate-600">
                  ジャンル: <span className="font-semibold text-slate-900">{room.settings.genre || '未設定'}</span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:w-[10rem] sm:grid-cols-1">
                <div className="rounded-[1.5rem] border-2 border-primary-400 bg-primary-50 px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary-500">Players</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{participantsLabel}</p>
                </div>
                <div className="rounded-[1.5rem] border-2 border-accent-400 bg-accent-100 px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent-500">Finish</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">Turn {gameEndTurn}</p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className={flatCardClass}>
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Round Flow</p>
            <h3 className="text-xl font-semibold text-slate-900">
              1ターン目の親は {currentParent?.name || '未定'} です
            </h3>
            <p className="text-sm leading-6 text-slate-600">
              最低 {MINIMUM_GAME_TURNS} ターン遊び、親の回数が全員そろう最初のタイミングで終了します。
              現在の人数だと目安は {gameEndTurn} ターンです。
            </p>
          </div>
        </Card>

        {isHost && (
          <Card className="border-2 border-primary-500 bg-primary-100 shadow-none hover:border-primary-500 hover:bg-primary-100">
            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary-500">Host Controls</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-900">ジャンルを確認する</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  ルーム全体で共有するのはジャンルだけです。お題は各ターンの親があとで決めます。
                </p>
              </div>
              <Input
                tone="light"
                label="今回のジャンル"
                placeholder="例: 邦ロック / ボカロ / アニソン"
                helperText="ゲーム開始後もこのジャンルはルーム全体で維持されます"
                value={draftGenre}
                onChange={(event) => setDraftGenre(event.target.value)}
              />
              <Button
                variant="secondary"
                fullWidth
                disabled={!draftGenre.trim()}
                onClick={() => void updateRoomSettings({ genre: draftGenre })}
              >
                ジャンルを保存する
              </Button>
            </div>
          </Card>
        )}

        {isCurrentParent ? (
          <Card className="border-2 border-accent-500 bg-accent-50 shadow-none hover:border-accent-500 hover:bg-accent-50">
            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent-500">Parent Controls</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-900">ゲームを開始する</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  開始後、このターンの親であるあなたが最初のお題を決めます。非親はお題確定後に曲を提出します。
                </p>
              </div>
              <Button
                size="xl"
                fullWidth
                disabled={!canStart}
                onClick={handleStart}
              >
                {players.length < MIN_PLAYERS
                  ? `${MIN_PLAYERS}人そろうと開始できます`
                  : !room.settings.genre.trim()
                    ? 'ジャンルを設定すると開始できます'
                    : 'ゲームを開始する'}
              </Button>
            </div>
          </Card>
        ) : (
          <Card className={flatCardClass}>
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Waiting</p>
              <h3 className="text-xl font-semibold text-slate-900">親の開始を待っています</h3>
              <p className="text-sm leading-6 text-slate-600">
                {currentParent
                  ? `${currentParent.name} さんがゲームを開始し、そのまま1ターン目のお題を決めます。`
                  : 'プレイヤー情報を読み込み中です。'}
              </p>
            </div>
          </Card>
        )}

        <Card className={flatCardClass}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Players</p>
              <h3 className="mt-1 text-xl font-semibold text-slate-900">参加メンバー</h3>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border-2 border-emerald-400 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              募集中
            </div>
          </div>

          <div className="mt-4 grid gap-2">
            {players.map((player) => (
              <div
                key={player.id}
                className={`flex items-center justify-between rounded-[1.35rem] border px-4 py-3 ${
                  player.isHost ? 'border-2 border-primary-400 bg-primary-50' : 'border-2 border-slate-400 bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-bold ${
                      player.isHost ? 'bg-primary-500 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {player.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{player.name}</p>
                    <div className="flex flex-wrap gap-2 text-[11px] font-medium">
                      {player.isHost && <span className="text-primary-600">Host</span>}
                      {currentParent?.id === player.id && <span className="text-accent-600">親</span>}
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
