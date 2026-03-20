import React, { useState } from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { Layout } from '../components/Layout';
import {
  DEFAULT_ROOM_SETTINGS,
  MAX_PLAYERS,
  MIN_PLAYERS,
} from '../constants/game';
import { loginAnonymously } from '../firebase/auth';
import { getPlayerCount, upsertPlayer } from '../firebase/player';
import { createRoom, findRoomByCode } from '../firebase/room';

type View = 'home' | 'create' | 'join';

interface HomeViewProps {
  onJoinRoom: (roomId: string, playerName: string, isHost: boolean, playerId: string) => void;
  startupError?: string | null;
}

const valueCards = [
  {
    title: '相手の気持ちを読む',
    body: 'どんな曲を選びそうか、なぜその一曲を出したのか。選曲の理由ごと想像するゲームです。',
  },
  {
    title: '通話しながら進めやすい',
    body: '1ターンごとの操作は短く、会話を止めずに回せます。オンライン飲みや Discord 集まり向けです。',
  },
  {
    title: '理解し合うほど強い',
    body: '親として見抜けることも、自分らしい選曲が伝わることも得点になります。',
  },
];

const flowSteps = [
  {
    label: '1',
    title: 'ジャンルを決めてルーム作成',
    body: 'まずは邦ロックやアニソンなど、みんなで遊ぶジャンルを1つ決めます。1つのコンテンツに絞ってもOK！',
  },
  {
    label: '2',
    title: '親がお題を出す',
    body: '各ターンの親役が、ジャンル内で考えたいお題を決めます。',
  },
  {
    label: '3',
    title: '親以外が匿名で提出',
    body: '親以外のプレイヤーが1曲ずつ提出。誰の曲かはまだ伏せられます。',
  },
  {
    label: '4',
    title: '親が誰の曲かを当てる',
    body: '親役が提出曲を見て、誰が出したかを割り当てます。',
  },
];

const scoreIdeas = [
  '親として誰の曲かを正しく見抜けるほど高得点',
  '自分の選曲が親に「あなたらしい」と伝わっても加点',
];

export const HomeView: React.FC<HomeViewProps> = ({ onJoinRoom, startupError }) => {
  const [view, setView] = useState<View>('home');
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [genre, setGenre] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const ensureFirebaseReady = () => {
    if (!startupError) {
      return true;
    }

    setError('Firebase 設定を確認してください。現在はルーム作成・参加ができません。');
    return false;
  };

  const handleJoin = async () => {
    if (!ensureFirebaseReady()) {
      return;
    }

    if (!roomCode || !playerName) {
      setError('ルームコードと表示名を入力してください。');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const playerId = await loginAnonymously();
      const roomId = await findRoomByCode(roomCode);

      if (!roomId) {
        setError('そのルームコードは見つかりませんでした。');
        return;
      }

      const playerCount = await getPlayerCount(roomId);
      if (playerCount >= MAX_PLAYERS) {
        setError(`このルームは満員です。最大${MAX_PLAYERS}人まで参加できます。`);
        return;
      }

      await upsertPlayer(roomId, playerId, playerName, false);
      onJoinRoom(roomId, playerName, false, playerId);
    } catch (joinError) {
      setError(
        joinError instanceof Error
          ? joinError.message
          : '参加に失敗しました。時間をおいてもう一度試してください。',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!ensureFirebaseReady()) {
      return;
    }

    if (!playerName.trim() || !genre.trim()) {
      setError('表示名とジャンルを入力してください。');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const playerId = await loginAnonymously();
      const room = await createRoom(playerId, {
        ...DEFAULT_ROOM_SETTINGS,
        genre: genre.trim(),
      });

      await upsertPlayer(room.id, playerId, playerName.trim(), true);
      onJoinRoom(room.id, playerName.trim(), true, playerId);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : 'ルーム作成に失敗しました。時間をおいてもう一度試してください。',
      );
    } finally {
      setLoading(false);
    }
  };

  if (view === 'create') {
    return (
      <Layout showBack onBack={() => setView('home')} title="ルームを作る">
        <div className="space-y-5">
          <Card className="border-primary-200 bg-white shadow-none hover:border-primary-200 hover:bg-white">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary-500">Host Setup</p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-900">ジャンルを決めてルームを作成</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              先に共通ジャンルを決めておくと、お題を出した瞬間に会話が始まりやすくなります。
            </p>
          </Card>

          <Card className="border-slate-200 bg-white shadow-none hover:border-slate-200 hover:bg-white">
            <div className="space-y-4">
              <Input
                label="表示名"
                placeholder="例: たろう"
                helperText="ルーム内で表示される名前です"
                tone="light"
                value={playerName}
                onChange={(event) => setPlayerName(event.target.value)}
              />
              <Input
                label="今回のジャンル"
                placeholder="例: 邦ロック / ボカロ / アニソン"
                helperText="ゲーム全体の共通ジャンルです。ロビーであとから変更できます"
                tone="light"
                value={genre}
                onChange={(event) => setGenre(event.target.value)}
              />
              {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
              <Button size="xl" fullWidth isLoading={loading} onClick={handleCreate}>
                ルームを作成して進む
              </Button>
            </div>
          </Card>
        </div>
      </Layout>
    );
  }

  if (view === 'join') {
    return (
      <Layout showBack onBack={() => setView('home')} title="ルームに参加する">
        <div className="space-y-5">
          <Card className="border-accent-200 bg-white shadow-none hover:border-accent-200 hover:bg-white">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent-500">Quick Join</p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-900">コードを入れてすぐ参加</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              通話中でも迷わないよう、参加導線は最短にしています。コードと表示名だけ入力してください。
            </p>
          </Card>

          <Card className="border-slate-200 bg-white shadow-none hover:border-slate-200 hover:bg-white">
            <div className="space-y-4">
              <Input
                label="ルームコード"
                placeholder="例: AB12CD"
                helperText="大文字のまま入力するとスムーズです"
                tone="light"
                value={roomCode}
                onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
              />
              <Input
                label="表示名"
                placeholder="例: じろう"
                helperText="あとから誰か分かる名前にしておくと遊びやすいです"
                tone="light"
                value={playerName}
                onChange={(event) => setPlayerName(event.target.value)}
              />
              {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
              <Button size="xl" variant="secondary" fullWidth isLoading={loading} onClick={handleJoin}>
                参加する
              </Button>
            </div>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="-mx-4 -mt-5 min-h-[calc(100vh-9rem)] space-y-6 bg-[#f7f8fc] px-4 py-5 pb-10 text-slate-900">
        <section className="rounded-[2.25rem] border border-slate-200 bg-white px-5 py-6">
          <div className="space-y-5">
            <div className="space-y-3">
              <p className="text-sm font-semibold tracking-[0.08em] text-slate-500">
                匿名セトリ推理ゲーム
              </p>
              <h2 className="max-w-[10ch] text-5xl font-black leading-[0.92] tracking-tight text-slate-950">
                誰の曲？
              </h2>
              <p className="max-w-md text-base leading-7 text-slate-600">
                ジャンルを選んでお題に合わせて曲を出し、親役が誰の曲かを当てよう。
                どんな曲を選びそうか、なぜそれを出したのか。相手の気持ちまで想像して楽しむ推理ゲームです。
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Button size="xl" onClick={() => setView('create')}>
                ルームを作る
              </Button>
              <Button size="xl" variant="secondary" onClick={() => setView('join')}>
                ルームに参加する
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-2xl border border-primary-200 bg-primary-50 px-3 py-3">
                <p className="text-lg font-bold text-slate-900">{MIN_PLAYERS}-{MAX_PLAYERS}</p>
                <p className="text-[11px] text-slate-500">players</p>
              </div>
              <div className="rounded-2xl border border-accent-500 bg-accent-100 px-3 py-3 transition-colors hover:border-accent-500 active:border-accent-500">
                <p className="text-lg font-bold text-slate-900">10-20</p>
                <p className="text-[11px] text-slate-500">minutes</p>
              </div>
            </div>
          </div>
        </section>

        {startupError && (
          <Card className="border-red-200 bg-red-50 shadow-none hover:border-red-200 hover:bg-red-50">
            <div className="space-y-3">
              <div className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-semibold text-red-600">
                Setup Required
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Firebase 設定を確認してください</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  トップページは表示できますが、ルーム作成・参加はまだ使えません。
                </p>
              </div>
              <code className="block rounded-2xl bg-white p-3 text-xs text-red-600 whitespace-pre-wrap break-words">
                {startupError}
              </code>
            </div>
          </Card>
        )}

        <section className="space-y-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">How To Play</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-900">遊び方</h3>
          </div>
          <div className="grid gap-3">
            {flowSteps.map((step) => (
              <Card key={step.label} className="border-slate-200 bg-white shadow-none hover:border-slate-200 hover:bg-white">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-500 text-sm font-bold text-white">
                    {step.label}
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-slate-900">{step.title}</h4>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{step.body}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Value</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-900">ただ当てるだけじゃなく、理解し合う</h3>
          </div>
          <div className="grid gap-3">
            {valueCards.map((card) => (
              <Card key={card.title} className="border-slate-200 bg-white shadow-none hover:border-slate-200 hover:bg-white">
                <h4 className="text-base font-semibold text-slate-900">{card.title}</h4>
                <p className="mt-2 text-sm leading-6 text-slate-600">{card.body}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Scoring</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-900">得点ルール</h3>
          </div>
          <Card className="border-accent-200 bg-white shadow-none hover:border-accent-200 hover:bg-white">
            <ul className="space-y-3 text-sm leading-6 text-slate-700">
              {scoreIdeas.map((idea) => (
                <li key={idea} className="flex gap-3">
                  <span className="mt-2 h-2 w-2 rounded-full bg-accent-500" />
                  <span>{idea}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      </div>
    </Layout>
  );
};
