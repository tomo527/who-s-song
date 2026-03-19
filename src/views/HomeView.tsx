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

const featureCards = [
  { title: '匿名で提出', body: '好きな曲を出しても、結果発表までは誰のものか分かりません。', tone: 'from-primary-400/24 to-primary-200/6' },
  { title: 'オンライン向け', body: '3〜6人くらいの通話や Discord 集まりにちょうどいいテンポです。', tone: 'from-accent-400/24 to-accent-200/6' },
  { title: '数分で1ゲーム', body: 'ルーム作成から結果発表まで、軽く遊べるスピード感を意識しています。', tone: 'from-emerald-300/18 to-cyan-300/6' },
];

const steps = [
  { label: '1', title: 'ルームを作成', body: 'ホストがルームコードを発行' },
  { label: '2', title: '曲を提出', body: 'お題に合う1曲を匿名で出す' },
  { label: '3', title: '誰の曲か当てる', body: '結果発表で正解とスコアを公開' },
];

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

      await upsertPlayer(roomId, playerId, playerName, false);
      onJoinRoom(roomId, playerName, false);
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

    if (!playerName) {
      setError('表示名を入力してください。');
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

  if (view === 'home') {
    return (
      <Layout>
        <div className="space-y-6 pb-6">
          <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/7 px-5 py-6 shadow-[0_30px_80px_-36px_rgba(8,18,34,0.95)]">
            <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-primary-400/30 blur-3xl" />
            <div className="absolute bottom-0 right-10 h-24 w-24 rounded-full bg-accent-400/20 blur-3xl" />
            <div className="relative space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[11px] font-semibold text-slate-200">
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.8)]" />
                3〜6人向け / オンライン推奨
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-primary-200/90">Anonymous Music Party Game</p>
                <h2 className="max-w-[11ch] text-5xl font-black leading-[0.92] tracking-tight text-white">
                  誰の曲？
                </h2>
                <p className="max-w-sm text-sm leading-6 text-slate-300">
                  お題に合わせて曲を出して、誰が選んだかを当てるだけ。
                  通話しながらでも回しやすい、今っぽいテンポの匿名パーティゲームです。
                </p>
              </div>

              <div className="grid gap-3">
                <Button size="xl" onClick={() => setView('create')}>
                  ルームを作る
                </Button>
                <Button size="xl" variant="secondary" onClick={() => setView('join')}>
                  ルームに参加する
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl border border-white/10 bg-black/16 px-2 py-3">
                  <p className="text-lg font-bold text-white">3-6</p>
                  <p className="text-[11px] text-slate-400">players</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/16 px-2 py-3">
                  <p className="text-lg font-bold text-white">5-15</p>
                  <p className="text-[11px] text-slate-400">minutes</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/16 px-2 py-3">
                  <p className="text-lg font-bold text-white">匿名</p>
                  <p className="text-[11px] text-slate-400">submit</p>
                </div>
              </div>
            </div>
          </section>

          {startupError && (
            <Card className="border-red-300/30 bg-red-400/10">
              <div className="space-y-3">
                <div className="inline-flex items-center rounded-full bg-red-200/12 px-2.5 py-1 text-[11px] font-semibold text-red-100">
                  Setup Required
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Firebase 設定を確認してください</h3>
                  <p className="mt-1 text-sm leading-6 text-red-100/85">
                    トップページは表示できますが、ルーム作成・参加はまだ使えません。
                  </p>
                </div>
                <code className="block rounded-2xl bg-black/30 p-3 text-xs text-red-100/90 whitespace-pre-wrap break-words">
                  {startupError}
                </code>
              </div>
            </Card>
          )}

          <section className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Why it works</p>
                <h3 className="mt-1 text-xl font-semibold text-white">初見でも入りやすい理由</h3>
              </div>
              <button
                type="button"
                className="text-sm font-medium text-primary-200 transition hover:text-white"
                onClick={() => setView('how-to')}
              >
                遊び方を見る
              </button>
            </div>
            <div className="grid gap-3">
              {featureCards.map((card) => (
                <Card key={card.title} className={`bg-linear-to-br ${card.tone}`}>
                  <h4 className="text-base font-semibold text-white">{card.title}</h4>
                  <p className="mt-2 text-sm leading-6 text-slate-200/88">{card.body}</p>
                </Card>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Flow</p>
              <h3 className="mt-1 text-xl font-semibold text-white">遊び方は3ステップ</h3>
            </div>
            <div className="grid gap-3">
              {steps.map((step) => (
                <Card key={step.label}>
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-primary-400 to-accent-500 text-sm font-bold text-white shadow-[0_14px_30px_-18px_rgba(96,165,250,1)]">
                      {step.label}
                    </div>
                    <div>
                      <h4 className="text-base font-semibold text-white">{step.title}</h4>
                      <p className="mt-1 text-sm leading-6 text-slate-300">{step.body}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        </div>
      </Layout>
    );
  }

  if (view === 'create') {
    return (
      <Layout showBack onBack={() => setView('home')} title="ルームを作る">
        <div className="space-y-5">
          <Card className="bg-linear-to-br from-primary-500/20 to-accent-500/10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary-100">Host Setup</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">まずはホストとして入室</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              名前を決めるだけでルームを作成できます。お題やラウンド数はロビーで調整できます。
            </p>
          </Card>

          <Card>
            <div className="space-y-4">
              <Input
                label="表示名"
                placeholder="例: たろう"
                helperText="ルーム内で表示される名前です"
                value={playerName}
                onChange={(event) => setPlayerName(event.target.value)}
              />
              {error && <p className="text-sm font-semibold text-red-200">{error}</p>}
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
          <Card className="bg-linear-to-br from-white/10 to-primary-400/10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">Quick Join</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">コードを入れてすぐ参加</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              ホストから共有されたルームコードと、自分の表示名を入力してください。
            </p>
          </Card>

          <Card>
            <div className="space-y-4">
              <Input
                label="ルームコード"
                placeholder="例: AB12CD"
                helperText="大文字のまま入力するとスムーズです"
                value={roomCode}
                onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
              />
              <Input
                label="表示名"
                placeholder="例: じろう"
                helperText="あとから誰か分かる名前にしておくと遊びやすいです"
                value={playerName}
                onChange={(event) => setPlayerName(event.target.value)}
              />
              {error && <p className="text-sm font-semibold text-red-200">{error}</p>}
              <Button size="xl" fullWidth isLoading={loading} onClick={handleJoin}>
                参加する
              </Button>
            </div>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout showBack onBack={() => setView('home')} title="遊び方">
      <div className="space-y-4">
        {steps.map((step) => (
          <Card key={step.label}>
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-primary-400 to-accent-500 text-sm font-bold text-white">
                {step.label}
              </div>
              <div>
                <h4 className="text-base font-semibold text-white">{step.title}</h4>
                <p className="mt-1 text-sm leading-6 text-slate-300">{step.body}</p>
              </div>
            </div>
          </Card>
        ))}
        <Card className="bg-white/6">
          <h4 className="text-base font-semibold text-white">ひとこと</h4>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            お題は広めにした方が盛り上がりやすく、1ゲームは3ラウンド前後がちょうど遊びやすいです。
          </p>
        </Card>
      </div>
    </Layout>
  );
};
