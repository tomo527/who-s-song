import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { subscribePlayers } from '../firebase/player';
import { subscribeRound, createRound } from '../firebase/game';
import type { Player, Room } from '../types';

interface LobbyViewProps {
  room: Room;
  playerName: string;
  isHost: boolean;
  onStartGame: (roundId: string) => void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({ room, isHost, onStartGame }) => {
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    // 参加者リストの購読
    const unsubscribePlayers = subscribePlayers(room.id, (p) => {
      setPlayers(p);
    });

    // 現在のラウンド情報の購読（ホストが開始したことを検知するため）
    let unsubscribeRound = () => {};
    if (room.currentRoundId) {
      unsubscribeRound = subscribeRound(room.id, room.currentRoundId, (r) => {
        if (r && r.phase === 'submitting') {
          onStartGame(r.id);
        }
      });
    }

    return () => {
      unsubscribePlayers();
      unsubscribeRound();
    };
  }, [room.id, room.currentRoundId]);

  const handleStart = async () => {
    if (!isHost) return;
    try {
      // 設定されたお題を使用（未設定ならデフォルト）
      const initialTheme = room.settings.theme || "一番テンションが上がる曲";
      const totalRounds = room.settings.roundsCount || 3;
      
      // 最初のラウンドを作成
      const roundId = await createRound(room.id, initialTheme, 1);
      
      // ルームステータスをアクティブにする
      const { updateDoc, doc } = await import("firebase/firestore");
      const { db } = await import("../firebase/config");
      await updateDoc(doc(db, "rooms", room.id), { 
        status: 'active',
        'settings.roundsCount': totalRounds // 念のため現在の値を再セット
      });

      onStartGame(roundId);
    } catch (e) {
      console.error("Round creation failed", e);
    }
  };

  return (
    <Layout title="待機ロビー">
      <div className="space-y-8 pb-10">
        <Card className="text-center py-6 border-dashed border-slate-200">
          <p className="text-[10px] font-black text-slate-400 mb-1 uppercase tracking-tighter">Room Code</p>
          <div className="text-5xl font-black tracking-widest text-primary-600">
            {room.roomCode}
          </div>
        </Card>

        {isHost ? (
          <Card className="bg-primary-50/20 border-primary-100">
            <h3 className="font-black text-primary-700 mb-4 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
              ゲーム設定
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">本日のお題</label>
                <input 
                  type="text" 
                  value={room.settings.theme || ''}
                  placeholder="例：一番テンションが上がる曲"
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-primary-400 outline-none font-bold text-slate-700 placeholder:text-slate-300 transition-all shadow-sm"
                  onChange={async (e) => {
                    const { updateDoc, doc } = await import("firebase/firestore");
                    const { db } = await import("../firebase/config");
                    await updateDoc(doc(db, "rooms", room.id), { 'settings.theme': e.target.value });
                  }}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-500 mb-1">ラウンド数</label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 5].map(n => (
                      <button
                        key={n}
                        onClick={async () => {
                          const { updateDoc, doc } = await import("firebase/firestore");
                          const { db } = await import("../firebase/config");
                          await updateDoc(doc(db, "rooms", room.id), { 'settings.roundsCount': n });
                        }}
                        className={`flex-1 py-2 rounded-lg font-black text-sm transition-all ${
                          room.settings.roundsCount === n 
                            ? 'bg-primary-600 text-white shadow-md shadow-primary-200' 
                            : 'bg-white text-slate-400 border-2 border-slate-100 hover:border-slate-200'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="bg-slate-50 border-slate-100 text-center py-4">
            <p className="text-xs font-bold text-slate-400 mb-1">お題</p>
            <p className="text-xl font-black text-slate-700">
              {room.settings.theme || "（未設定）"}
            </p>
            <div className="mt-2 text-[10px] font-bold text-primary-400 bg-white inline-block px-2 py-0.5 rounded-full border border-primary-100">
              {room.settings.roundsCount} ラウンド
            </div>
          </Card>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-700">参加者 ({players.length}人)</h3>
            <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 rounded-full">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-[10px] font-bold text-green-600">リアルタイム同期中</span>
            </div>
          </div>
          
          <div className="grid gap-2">
            {players.map((p) => (
              <div 
                key={p.id} 
                className={`flex items-center justify-between p-4 rounded-2xl border-2 ${p.isHost ? 'border-primary-100 bg-primary-50/30' : 'border-slate-50 bg-white'}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-sm ${p.isHost ? 'bg-primary-500' : 'bg-slate-300'}`}>
                    {p.name.charAt(0)}
                  </div>
                  <div>
                    <span className="font-bold text-slate-700">{p.name}</span>
                    {p.isHost && (
                      <p className="text-[10px] font-black text-primary-400 tracking-tighter uppercase">Host</p>
                    )}
                  </div>
                </div>
                {p.isHost && (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-400"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
                )}
              </div>
            ))}
          </div>
        </div>

        {isHost ? (
          <div className="pt-6">
            <Button size="lg" fullWidth disabled={players.length < 2} onClick={handleStart}>
              {players.length < 2 ? '参加者を待っています...' : 'ゲームを開始する'}
            </Button>
            {players.length < 2 && (
              <p className="mt-2 text-center text-xs text-slate-400">参加者が2名以上必要です</p>
            )}
          </div>
        ) : (
          <div className="text-center py-6">
            <div className="animate-bounce mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-primary-300"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <p className="text-sm font-bold text-slate-500">主催者がゲームを開始するのを待っています</p>
          </div>
        )}
      </div>
    </Layout>
  );
};
