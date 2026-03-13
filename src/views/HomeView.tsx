import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { loginAnonymously } from '../firebase/auth';
import { findRoomByCode, createRoom } from '../firebase/room';
import { upsertPlayer } from '../firebase/player';

type View = 'home' | 'create' | 'join' | 'how-to';

export const HomeView: React.FC<{ 
  onJoinRoom: (roomId: string, playerName: string, isHost: boolean) => void 
}> = ({ onJoinRoom }) => {
  const [view, setView] = useState<View>('home');
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleJoin = async () => {
    if (!roomCode || !playerName) {
      setError('ルームコードとニックネームを入力してください');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const playerId = await loginAnonymously();
      const roomId = await findRoomByCode(roomCode);
      if (roomId) {
        await upsertPlayer(roomId, playerId, playerName, false);
        onJoinRoom(roomId, playerName, false);
      } else {
        setError('ルームが見つかりません');
      }
    } catch (e) {
      setError('エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!playerName) {
      setError('ニックネームを入力してください');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const playerId = await loginAnonymously();
      const room = await createRoom(playerId, {
        roundsCount: 3,
        scoring: {
          correctGuess: 2,
          noOneGuessedMine: 2,
          bestSubmissionBonus: 2
        }
      });
      await upsertPlayer(room.id, playerId, playerName, true);
      onJoinRoom(room.id, playerName, true);
    } catch (e) {
      setError('エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  if (view === 'home') {
    return (
      <Layout>
        <div className="space-y-12 py-8">
          <div className="text-center space-y-4">
            <div className="inline-flex p-4 bg-primary-50 rounded-3xl text-primary-600 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
            </div>
            <h2 className="text-4xl font-extrabold tracking-tight">誰の曲？</h2>
            <p className="text-slate-500 font-medium">匿名セトリ推理ゲーム</p>
          </div>

          <div className="grid gap-4">
            <Button size="xl" onClick={() => setView('create')}>ゲームを作る</Button>
            <Button size="xl" variant="secondary" onClick={() => setView('join')}>ゲームに参加する</Button>
            <Button variant="ghost" onClick={() => setView('how-to')}>遊び方</Button>
          </div>
        </div>
      </Layout>
    );
  }

  if (view === 'create') {
    return (
      <Layout showBack onBack={() => setView('home')} title="ゲームを作る">
        <div className="space-y-8">
          <div className="space-y-2">
            <h3 className="text-2xl font-bold">主催者として参加</h3>
            <p className="text-slate-500">あなたのニックネームを入力してください。</p>
          </div>
          <Input 
            label="ニックネーム" 
            placeholder="例: たろう" 
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
          />
          {error && <p className="text-red-500 text-sm font-bold">{error}</p>}
          <Button size="lg" fullWidth isLoading={loading} onClick={handleCreate}>
            ルームを作成して待機
          </Button>
        </div>
      </Layout>
    );
  }

  if (view === 'join') {
    return (
      <Layout showBack onBack={() => setView('home')} title="参加する">
        <div className="space-y-8">
          <div className="space-y-2">
            <h3 className="text-2xl font-bold">合流しましょう</h3>
            <p className="text-slate-500">提示されたルームコードと、あなたのニックネームを入力してください。</p>
          </div>
          <div className="space-y-4">
            <Input 
              label="ルームコード" 
              placeholder="例: AB12CD" 
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            />
            <Input 
              label="ニックネーム" 
              placeholder="例: じろう" 
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
            />
          </div>
          {error && <p className="text-red-500 text-sm font-bold">{error}</p>}
          <Button size="lg" fullWidth isLoading={loading} onClick={handleJoin}>
            参加する
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout showBack onBack={() => setView('home')} title="遊び方">
      <div className="space-y-6 prose prose-slate">
        <Card>
          <h4 className="font-bold mb-2">1. 曲を提出する</h4>
          <p className="text-sm text-slate-600">お題に沿った曲を1曲、こっそり提出します。誰が選んだかは内緒です。</p>
        </Card>
        <Card>
          <h4 className="font-bold mb-2">2. 推理する</h4>
          <p className="text-sm text-slate-600">全員の曲が出揃ったら、どれが誰の曲かを当てます。</p>
        </Card>
        <Card>
          <h4 className="font-bold mb-2">3. 正解発表！</h4>
          <p className="text-sm text-slate-600">正解するとポイント獲得！自分の曲を隠し通せてもポイントがもらえます。</p>
        </Card>
      </div>
    </Layout>
  );
};
