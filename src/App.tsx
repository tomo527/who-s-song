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
    return <LobbyView room={room} isHost={isActualHost} onStartGame={() => {}} />;
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
    <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-xl border border-slate-200 space-y-4">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-sm text-slate-600">{description}</p>
        <code className="block rounded-xl bg-slate-950 text-slate-100 p-4 text-xs overflow-x-auto whitespace-pre-wrap">
          {message}
        </code>
        <button
          type="button"
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
