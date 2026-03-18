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

function App() {
  const [gameState, setGameState] = useState<{
    roomId: string;
    playerName: string;
    isHost: boolean;
    playerId?: string;
  } | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  });

  const { room, loading: roomLoading, error: roomError } = useRoom(gameState?.roomId || '');
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentRound, setCurrentRound] = useState<Round | null>(null);

  useEffect(() => {
    if (gameState) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState));
      return;
    }

    localStorage.removeItem(STORAGE_KEY);
  }, [gameState]);

  useEffect(() => {
    if (!gameState?.roomId || firebaseConfigError) {
      return;
    }

    const unsubscribe = subscribePlayers(gameState.roomId, setPlayers);
    return () => unsubscribe();
  }, [gameState?.roomId]);

  useEffect(() => {
    if (!gameState?.roomId || !room?.currentRoundId || firebaseConfigError) {
      return;
    }

    const unsubscribe = subscribeRound(gameState.roomId, room.currentRoundId, setCurrentRound);
    return () => unsubscribe();
  }, [gameState?.roomId, room?.currentRoundId]);

  const handleJoinRoom = async (roomId: string, playerName: string, isHost: boolean) => {
    const playerId = await loginAnonymously();
    setGameState({ roomId, playerName, isHost, playerId });
  };

  if (firebaseConfigError && gameState) {
    return <StartupErrorScreen message={firebaseConfigError} onBack={() => setGameState(null)} />;
  }

  if (!gameState) {
    return <HomeView onJoinRoom={handleJoinRoom} startupError={firebaseConfigError} />;
  }

  if (roomLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center font-bold text-primary-500 animate-pulse">
        読み込み中...
      </div>
    );
  }

  if (roomError) {
    return <StartupErrorScreen message={roomError.message} onBack={() => setGameState(null)} />;
  }

  if (!room) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-slate-50">
        <p className="font-bold text-slate-600">ルームが見つかりません。</p>
        <button
          className="px-6 py-2 bg-primary-600 text-white rounded-2xl font-bold shadow-lg shadow-primary-200"
          onClick={() => setGameState(null)}
        >
          ホームに戻る
        </button>
      </div>
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
        playerName={gameState.playerName}
        isHost={isActualHost}
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
          isHost={isActualHost}
        />
      );
    }

    return (
      <GameView
        roomId={room.id}
        roundId={room.currentRoundId}
        playerId={gameState.playerId || ''}
        playerName={gameState.playerName}
        isHost={isActualHost}
      />
    );
  }

  return (
    <StartupErrorScreen
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
      title="未対応のルーム状態です"
      description="room.status または round.phase が想定外の値になっています。"
    />
  );
}

function StartupErrorScreen({
  message,
  onBack,
  title = 'アプリを開始できません',
  description = 'Firebase 設定またはルーム状態を確認してください。',
}: {
  message: string;
  onBack: () => void;
  title?: string;
  description?: string;
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-xl border border-slate-200 space-y-4">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-sm text-slate-600">{description}</p>
        <code className="block rounded-xl bg-slate-950 text-slate-100 p-4 text-xs overflow-x-auto whitespace-pre-wrap">
          {message}
        </code>
        <button
          className="px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold"
          onClick={onBack}
        >
          ホームに戻る
        </button>
      </div>
    </div>
  );
}

export default App;
