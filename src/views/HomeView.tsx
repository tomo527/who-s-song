import React, { useState } from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { Layout } from '../components/Layout';
import { loginAnonymously } from '../firebase/auth';
import { upsertPlayer } from '../firebase/player';
import { createRoom, findRoomByCode } from '../firebase/room';

type View = 'home' | 'create' | 'join' | 'how-to';

interface HomeViewProps {
  onJoinRoom: (roomId: string, playerName: string, isHost: boolean) => void;
  startupError?: string | null;
}

export const HomeView: React.FC<HomeViewProps> = ({ onJoinRoom, startupError }) => {
  const [view, setView] = useState<View>('home');
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const ensureFirebaseReady = () => {
    if (!startupError) {
      return true;
    }

    setError('Firebase 設定が不足しているため開始できません。README の環境変数設定を確認してください。');
    return false;
  };

  const handleJoin = async () => {
    if (!ensureFirebaseReady()) {
      return;
    }

    if (!roomCode || !playerName) {
      setError('ルームコードとニックネームを入力してください。');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const playerId = await loginAnonymously();
      const roomId = await findRoomByCode(roomCode);

      if (!roomId) {
        setError('ルームが見つかりません。');
        return;
      }

      await upsertPlayer(roomId, playerId, playerName, false);
      onJoinRoom(roomId, playerName, false);
    } catch {
      setError('参加に失敗しました。Firebase 設定と Firestore ルールを確認してください。');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!ensureFirebaseReady()) {
      return;
    }

    if (!playerName) {
      setError('ニックネームを入力してください。');
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
          bestSubmissionBonus: 2,
        },
      });

      await upsertPlayer(room.id, playerId, playerName, true);
      onJoinRoom(room.id, playerName, true);
    } catch {
      setError('ルーム作成に失敗しました。Firebase 設定と Firestore ルールを確認してください。');
    } finally {
      setLoading(false);
    }
  };

  if (view === 'home') {
    return (
      <Layout>
        <div className="space-y-10 py-8">
          <div className="text-center space-y-4">
            <div className="inline-flex p-4 bg-primary-50 rounded-3xl text-primary-600 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
            </div>
            <h2 className="text-4xl font-extrabold tracking-tight">誰の曲？</h2>
            <p className="text-slate-500 font-medium">匿名セトリ推理ゲーム</p>
          </div>

          {startupError && (
            <Card className="border-red-200 bg-red-50 text-left">
              <h3 className="font-bold text-red-700 mb-2">Firebase 設定が不足しています</h3>
              <p className="text-sm text-red-700 mb-3">
                ページは表示できますが、ルーム作成や参加はまだ動作しません。
              </p>
              <code className="block rounded-xl bg-red-950 text-red-50 p-3 text-xs overflow-x-auto whitespace-pre-wrap">
                {startupError}
              </code>
            </Card>
          )}

          <div className="grid gap-4">
            <Button size="xl" onClick={() => setView('create')}>ルームを作る</Button>
            <Button size="xl" variant="secondary" onClick={() => setView('join')}>ルームに参加する</Button>
            <Button variant="ghost" onClick={() => setView('how-to')}>遊び方</Button>
          </div>
        </div>
      </Layout>
    );
  }

  if (view === 'create') {
    return (
      <Layout showBack onBack={() => setView('home')} title="ルームを作る">
        <div className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-2xl font-bold">ホストとして開始</h3>
            <p className="text-slate-500">ニックネームを入力してルームを作成します。</p>
          </div>
          <Input
            label="ニックネーム"
            placeholder="例: たろう"
            value={playerName}
            onChange={(event) => setPlayerName(event.target.value)}
          />
          {error && <p className="text-red-500 text-sm font-bold">{error}</p>}
          <Button size="lg" fullWidth isLoading={loading} onClick={handleCreate}>
            ルームを作成して進む
          </Button>
        </div>
      </Layout>
    );
  }

  if (view === 'join') {
    return (
      <Layout showBack onBack={() => setView('home')} title="ルームに参加する">
        <div className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-2xl font-bold">参加する</h3>
            <p className="text-slate-500">ルームコードとニックネームを入力してください。</p>
          </div>
          <div className="space-y-4">
            <Input
              label="ルームコード"
              placeholder="例: AB12CD"
              value={roomCode}
              onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
            />
            <Input
              label="ニックネーム"
              placeholder="例: じろう"
              value={playerName}
              onChange={(event) => setPlayerName(event.target.value)}
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
      <div className="space-y-4">
        <Card>
          <h4 className="font-bold mb-2">1. ルーム作成</h4>
          <p className="text-sm text-slate-600">ホストがルームを作り、参加者にルームコードを共有します。</p>
        </Card>
        <Card>
          <h4 className="font-bold mb-2">2. 曲の提出</h4>
          <p className="text-sm text-slate-600">お題に合う曲を1人1曲ずつ匿名で提出します。</p>
        </Card>
        <Card>
          <h4 className="font-bold mb-2">3. 推理と結果発表</h4>
          <p className="text-sm text-slate-600">誰がどの曲を選んだかを当てて、正解数などでスコアを競います。</p>
        </Card>
      </div>
    </Layout>
  );
};
