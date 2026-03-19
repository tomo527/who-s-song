import { useEffect, useState } from 'react';
import { subscribePlayers } from './firebase/player';
import { subscribeRound } from './firebase/game';
import { loginAnonymously } from './firebase/auth';
import { firebaseConfigError } from './firebase/config';
import { useRoom } from './hooks/useRoom';
import type { Player, Round } from './types';
import { FinalResultView } from './views/FinalResultView';
import { GameView } from './views/GameView';
import { HomeView } from './views/HomeView';
import { LobbyView } from './views/LobbyView';
import { ResultView } from './views/ResultView';

const STORAGE_KEY = 'song_guess_game_state';

type SavedGameState = {
  roomId: string;
  playerName: string;
  isHost: boolean;
  playerId?: string;
};

function App() {
  const [gameState, setGameState] = useState<SavedGameState | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? (JSON.parse(saved) as SavedGameState) : null;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  });
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const { room, loading, error } = useRoom(gameState?.roomId || '');

  useEffect(() => {
    if (gameState) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [gameState]);

  useEffect(() => {
    if (!gameState?.roomId || firebaseConfigError) {
      return;
    }

    return subscribePlayers(gameState.roomId, setPlayers);
  }, [gameState?.roomId]);

  useEffect(() => {
    if (!gameState?.roomId || !room?.currentRoundId || firebaseConfigError) {
      return;
    }

    return subscribeRound(gameState.roomId, room.currentRoundId, setCurrentRound);
  }, [gameState?.roomId, room?.currentRoundId]);

  const handleJoinRoom = async (roomId: string, playerName: string, isHost: boolean) => {
    const playerId = await loginAnonymously();
    setGameState({ roomId, playerName, isHost, playerId });
  };

  if (!gameState) {
    return <HomeView onJoinRoom={handleJoinRoom} startupError={firebaseConfigError} />;
  }

  if (firebaseConfigError) {
    return (
      <StartupErrorScreen
        title="Firebase 設定エラー"
        description="環境変数が不足しているため、ルーム情報を読み込めません。"
        message={firebaseConfigError}
        onBack={() => setGameState(null)}
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center font-bold text-primary-500 animate-pulse">
        読み込み中...
      </div>
    );
  }

  if (error) {
    return (
      <StartupErrorScreen
        title="ルームの読み込みに失敗しました"
        description="Firebase 設定または Firestore ルールを確認してください。"
        message={error.message}
        onBack={() => setGameState(null)}
      />
    );
  }

  if (!room) {
    return (
      <StartupErrorScreen
        title="ルームが見つかりません"
        description="保存されていたルームが削除されたか、アクセスできません。"
        message={gameState.roomId}
        onBack={() => setGameState(null)}
      />
    );
  }

  const isActualHost = gameState.playerId === room.hostId;

  if (room.status === 'finished') {
    return <FinalResultView room={room} players={players} onBackToHome={() => setGameState(null)} />;
  }

  if (room.status === 'waiting') {
    return (
      <LobbyView
        room={room}
        isHost={isActualHost}
        currentPlayerId={gameState.playerId || ''}
        onStartGame={() => {}}
      />
    );
  }

  if (room.status === 'active' && room.currentRoundId) {
    if (currentRound?.phase === 'revealing') {
      return (
        <ResultView
          room={room}
          roundId={room.currentRoundId}
          players={players}
          currentPlayerId={gameState.playerId || ''}
        />
      );
    }

    return (
      <GameView
        roomId={room.id}
        roundId={room.currentRoundId}
        playerId={gameState.playerId || ''}
        isHost={isActualHost}
      />
    );
  }

  return (
    <StartupErrorScreen
      title="未対応のルーム状態です"
      description="想定外の room.status または round.phase です。"
      message={JSON.stringify(
        {
          roomStatus: room.status,
          currentRoundId: room.currentRoundId,
          currentRoundPhase: currentRound?.phase ?? null,
        },
        null,
        2,
      )}
      onBack={() => setGameState(null)}
    />
  );
}

function StartupErrorScreen({
  title,
  description,
  message,
  onBack,
}: {
  title: string;
  description: string;
  message: string;
  onBack: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#08111f] px-6 py-12 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-3xl items-center justify-center">
        <div className="w-full rounded-[2rem] border border-white/10 bg-white/8 p-6 shadow-[0_24px_80px_rgba(8,15,30,0.42)] backdrop-blur-xl sm:p-8">
          <div className="mb-6 inline-flex rounded-full border border-red-300/20 bg-red-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-red-100">
            Configuration Error
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">{description}</p>
          <code className="mt-6 block overflow-x-auto whitespace-pre-wrap rounded-[1.5rem] border border-white/10 bg-slate-950/80 p-4 text-xs text-slate-100">
            {message}
          </code>
          <button
            type="button"
            className="mt-6 rounded-2xl bg-gradient-to-r from-primary-500 to-accent-400 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(56,130,246,0.3)] transition hover:brightness-105"
            onClick={onBack}
          >
            ホームに戻る
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
