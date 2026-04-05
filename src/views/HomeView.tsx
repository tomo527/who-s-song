import React, { useState } from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { Layout } from '../components/Layout';
import {
  DEFAULT_ROOM_SETTINGS,
  DUO_PLAYERS,
  MIN_PLAYERS,
  MAX_PLAYERS,
  THEME_TIME_LIMIT_OPTIONS,
  TIME_LIMIT_OPTIONS,
  formatTimeLimit,
  getMaxPlayersForMode,
} from '../constants/game';
import { loginAnonymously } from '../firebase/auth';
import { getPlayerCount, upsertPlayer } from '../firebase/player';
import { createRoom, findRoomByCode } from '../firebase/room';
import type { RoomMode, TimeLimitSetting } from '../types';

type View = 'home' | 'create' | 'join';

interface HomeViewProps {
  onJoinRoom: (roomId: string, playerName: string, isHost: boolean, playerId: string) => void;
  startupError?: string | null;
}

const getModeLabel = (mode: RoomMode) => (mode === 'duo' ? '2人用' : '3人～');
const getCreateTitle = (mode: RoomMode) => `ルームを作る（${getModeLabel(mode)}）`;
const getJoinTitle = (mode: RoomMode) => `ルームに参加する（${getModeLabel(mode)}）`;
const dualLineLabel = (title: string, suffix: string) => (
  <span className="flex w-full flex-col items-center justify-center text-center leading-tight">
    <span>{title}</span>
    <span className="mt-1 text-sm font-semibold">{suffix}</span>
  </span>
);

const valueCards = [
  {
    title: '相手の気持ちを読む',
    body: 'どんな曲を選びそうか、なぜその1曲を出したのか。選曲の理由ごと想像するゲームです。',
  },
  {
    title: '通話しながら進めやすい',
    body: '1ターンごとの操作は短く、会話を止めずに回せます。DiscordやXのスペースなど、オンラインでの集まりに向いています。',
  },
  {
    title: '理解し合うほど強い',
    body: '親として見抜くことも、自分らしい選曲が伝わることも得点になります。',
  },
];

const gettingStartedSteps = [
  {
    label: '1',
    body: 'だれか1人がホストになって「ルームを作る」',
  },
  {
    label: '2',
    body: '表示されたルームコードを参加者に共有する',
  },
  {
    label: '3',
    body: 'ほかの人は「ルームに参加する」からコードを入力して入室する',
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
    body: '各ターンの親が、ジャンル内で考えたいお題を決めます。',
  },
  {
    label: '3',
    title: '親以外が匿名で提出',
    body: '親以外のプレイヤーが1曲ずつ提出。誰の曲かはまだ伏せられます。',
  },
  {
    label: '4',
    title: '親が誰の曲かを当てる',
    body: '親が提出曲を見て、誰が出したかを割り当てます。',
  },
];

const ruleItems = [
  '毎ターン1人が親になり、お題を決めます。ほかの全員は、そのお題に合う曲を匿名で提出します。',
  '親は、誰がどの曲を出したかを当てます。',
  '得点は、親として当てること、そして自分らしい選曲で当ててもらうことの両方で入ります。',
  '同じ曲名を複数人が提出した場合は、そのグループ内の誰を選んでも正解として扱います。',
  '制限時間は進行の目安で、時間切れになっても自動では進みません。',
];

export const HomeView: React.FC<HomeViewProps> = ({ onJoinRoom, startupError }) => {
  const [view, setView] = useState<View>('home');
  const [mode, setMode] = useState<RoomMode>('standard');
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [genre, setGenre] = useState('');
  const [themeTimeLimit, setThemeTimeLimit] = useState(DEFAULT_ROOM_SETTINGS.themeTimeLimit);
  const [submitTimeLimit, setSubmitTimeLimit] = useState(DEFAULT_ROOM_SETTINGS.submitTimeLimit);
  const [guessTimeLimit, setGuessTimeLimit] = useState(DEFAULT_ROOM_SETTINGS.guessTimeLimit);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const openCreate = (nextMode: RoomMode) => {
    setMode(nextMode);
    setError('');
    setView('create');
  };

  const openJoin = (nextMode: RoomMode) => {
    setMode(nextMode);
    setError('');
    setView('join');
  };

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
      const room = await findRoomByCode(roomCode);

      if (!room) {
        setError('そのルームコードは見つかりませんでした。');
        return;
      }

      const roomMode = room.mode === 'duo' ? 'duo' : 'standard';
      if (roomMode !== mode) {
        setError(
          mode === 'duo'
            ? 'このルームは3人以上用です。3人以上用の参加ボタンから入室してください。'
            : 'このルームは2人用です。2人用の参加ボタンから入室してください。',
        );
        return;
      }

      const precheckedPlayerCount = await getPlayerCount(room.id);
      const maxPlayers = getMaxPlayersForMode(roomMode);
      if (precheckedPlayerCount >= maxPlayers) {
        setError(`このルームは満員です。最大${maxPlayers}人まで参加できます。`);
        return;
      }

      await upsertPlayer(room.id, playerId, playerName.trim(), false);
      onJoinRoom(room.id, playerName.trim(), false, playerId);
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
        themeTimeLimit,
        submitTimeLimit,
        guessTimeLimit,
      }, mode);

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
      <Layout showBack onBack={() => setView('home')} title={getCreateTitle(mode)}>
        <div className="rounded-[2rem] border-2 border-slate-600/40 bg-white p-5">
          <div className="space-y-5">
          <Card className="border-2 border-primary-500 bg-primary-100 shadow-none hover:border-primary-500 hover:bg-primary-100">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary-500">Host Setup</p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-900">ジャンルを決めてルームを作成</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              先に共通ジャンルを決めておくと、お題を出した瞬間に会話が始まりやすくなります。
            </p>
          </Card>

          <Card className="border-2 border-slate-600/40 bg-slate-100 shadow-none hover:border-slate-600/40 hover:bg-slate-100">
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
                placeholder="例: コンテンツ名 / アーティスト名 / 曲ジャンル"
                helperText="ゲーム全体の共通ジャンルです。ロビーであとから変更できます"
                tone="light"
                value={genre}
                onChange={(event) => setGenre(event.target.value)}
              />
              <TimeLimitSelector
                label="親お題選択時間"
                helperText={`現在の設定: ${formatTimeLimit(themeTimeLimit)}`}
                value={themeTimeLimit}
                onChange={setThemeTimeLimit}
                options={THEME_TIME_LIMIT_OPTIONS}
              />
              <TimeLimitSelector
                label="プレイヤー提出時間"
                helperText={`現在の設定: ${formatTimeLimit(submitTimeLimit)}`}
                value={submitTimeLimit}
                onChange={setSubmitTimeLimit}
              />
              <TimeLimitSelector
                label="親推理時間"
                helperText={`現在の設定: ${formatTimeLimit(guessTimeLimit)}`}
                value={guessTimeLimit}
                onChange={setGuessTimeLimit}
              />
              {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
              <Button size="xl" fullWidth isLoading={loading} onClick={handleCreate}>
                ルームを作成して進む
              </Button>
            </div>
          </Card>
          </div>
        </div>
      </Layout>
    );
  }

  if (view === 'join') {
    return (
      <Layout showBack onBack={() => setView('home')} title={getJoinTitle(mode)}>
        <div className="rounded-[2rem] border-2 border-slate-600/40 bg-white p-5">
          <div className="space-y-5">
          <Card className="border-2 border-accent-500 bg-accent-100 shadow-none hover:border-accent-500 hover:bg-accent-100">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent-500">Quick Join</p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-900">コードを入れてすぐ参加</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              親から共有されたルームコードと、あなたの表示名を入力してください。
            </p>
          </Card>

          <Card className="border-2 border-slate-600/40 bg-slate-100 shadow-none hover:border-slate-600/40 hover:bg-slate-100">
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
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="-mx-4 -mt-5 min-h-[calc(100vh-9rem)] space-y-6 bg-[#f7f8fc] px-4 py-5 pb-10 text-slate-900">
        <section className="rounded-[2.25rem] border-2 border-slate-600/45 bg-white px-5 py-6">
          <div className="space-y-5">
            <div className="space-y-3">
              <p className="text-sm font-semibold tracking-[0.08em] text-slate-500">
                匿名セトリ推理ゲーム
              </p>
              <h2 className="max-w-[10ch] text-5xl font-black leading-[0.92] tracking-tight text-slate-950">
                誰の曲？
              </h2>
              <p className="max-w-md text-base leading-7 text-slate-600">
            ジャンルを選んでお題に合わせて曲を出し、親が誰の曲かを当てよう。
                どんな曲を選びそうか、なぜそれを出したのか。相手の気持ちまで想像して楽しむ推理ゲームです。
              </p>
            </div>

            <div className="space-y-5">
              <div className="space-y-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Multi player mode</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button size="xl" className="min-h-[5.5rem]" onClick={() => openCreate('standard')}>
                    {dualLineLabel('ルームを作る', '（3人～）')}
                  </Button>
                  <Button size="xl" variant="secondary" className="min-h-[5.5rem]" onClick={() => openJoin('standard')}>
                    {dualLineLabel('ルームに参加する', '（3人～）')}
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-2xl border-2 border-primary-300 bg-primary-50 px-3 py-3">
                    <p className="text-lg font-bold text-slate-900">{MIN_PLAYERS}-{MAX_PLAYERS}</p>
                    <p className="text-[11px] text-slate-500">players</p>
                  </div>
                  <div className="rounded-2xl border-2 border-accent-500 bg-accent-100 px-3 py-3 transition-colors hover:border-accent-500 active:border-accent-500">
                    <p className="text-lg font-bold text-slate-900">50-60</p>
                    <p className="text-[11px] text-slate-500">minutes</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Two player mode</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button size="xl" className="min-h-[5.5rem]" onClick={() => openCreate('duo')}>
                    {dualLineLabel('ルームを作る', '（2人用）')}
                  </Button>
                  <Button size="xl" variant="secondary" className="min-h-[5.5rem]" onClick={() => openJoin('duo')}>
                    {dualLineLabel('ルームに参加する', '（2人用）')}
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-2xl border-2 border-primary-300 bg-primary-50 px-3 py-3">
                    <p className="text-lg font-bold text-slate-900">{DUO_PLAYERS}</p>
                    <p className="text-[11px] text-slate-500">players</p>
                  </div>
                  <div className="rounded-2xl border-2 border-accent-500 bg-accent-100 px-3 py-3 transition-colors hover:border-accent-500 active:border-accent-500">
                    <p className="text-lg font-bold text-slate-900">30</p>
                    <p className="text-[11px] text-slate-500">minutes</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {startupError && (
          <Card className="border-2 border-red-400 bg-red-50 shadow-none hover:border-red-400 hover:bg-red-50">
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

        <section className="space-y-3 rounded-[2rem] border-2 border-slate-600/40 bg-white p-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Getting Started</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-900">始め方</h3>
          </div>
          <div className="grid gap-3">
            {gettingStartedSteps.map((step) => (
              <Card
                key={step.label}
                className="border-2 border-slate-600/40 bg-slate-50 shadow-none hover:border-slate-600/40 hover:bg-slate-50"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-500 text-sm font-bold text-white">
                    {step.label}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-base leading-7 text-slate-700">{step.body}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-3 rounded-[2rem] border-2 border-slate-600/40 bg-white p-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">How To Play</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-900">遊び方</h3>
          </div>
          <div className="grid gap-3">
            {flowSteps.map((step) => (
              <Card key={step.label} className="border-2 border-slate-600/40 bg-slate-100 shadow-none hover:border-slate-600/40 hover:bg-slate-100">
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

        <section className="space-y-3 rounded-[2rem] border-2 border-slate-600/40 bg-white p-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Value</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-900">ただ当てるだけじゃなく、理解し合う</h3>
          </div>
          <div className="grid gap-3">
            {valueCards.map((card, index) => (
              <Card key={card.title} className="border-2 border-slate-600/40 bg-slate-100 shadow-none hover:border-slate-600/40 hover:bg-slate-100">
                <div className="space-y-3">
                  <div className="space-y-2 border-b border-slate-300 pb-3">
                    <span className="inline-flex items-center rounded-full border border-primary-200 bg-primary-50 px-2.5 py-1 text-[11px] font-semibold tracking-[0.14em] text-primary-600">
                      {`POINT ${String(index + 1).padStart(2, '0')}`}
                    </span>
                    <h4 className="border-l-4 border-primary-500 pl-3 text-base font-semibold text-slate-900">
                      {card.title}
                    </h4>
                  </div>
                  <p className="text-sm leading-6 text-slate-600">{card.body}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-3 rounded-[2rem] border-2 border-slate-600/40 bg-white p-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Rules</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-900">ルール</h3>
          </div>
          <Card className="border-2 border-accent-500 bg-accent-50 shadow-none hover:border-accent-500 hover:bg-accent-50">
            <ul className="space-y-3 text-sm leading-6 text-slate-700">
              {ruleItems.map((rule) => (
                <li key={rule} className="flex items-start gap-3">
                  <span className="mt-[0.55rem] h-2.5 w-2.5 shrink-0 rounded-full bg-accent-500" />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      </div>
    </Layout>
  );
};

function TimeLimitSelector({
  label,
  helperText,
  value,
  onChange,
  options = TIME_LIMIT_OPTIONS,
}: {
  label: string;
  helperText: string;
  value: TimeLimitSetting;
  onChange: (value: TimeLimitSetting) => void;
  options?: Array<{ label: string; value: TimeLimitSetting }>;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{helperText}</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => {
          const selected = option.value === value;

          return (
            <button
              key={option.label}
              type="button"
              onClick={() => onChange(option.value)}
              className={`rounded-2xl border-2 px-3 py-3 text-sm font-semibold transition ${
                selected
                  ? 'border-primary-500 bg-primary-50 text-primary-600'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
