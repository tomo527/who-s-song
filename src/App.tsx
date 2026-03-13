import { useState, useEffect } from 'react';
import { HomeView } from './views/HomeView';
import { LobbyView } from './views/LobbyView';
import { GameView } from './views/GameView';
import { ResultView } from './views/ResultView';
import { FinalResultView } from './views/FinalResultView';
import { useRoom } from './hooks/useRoom';
import { loginAnonymously } from './firebase/auth';
import { subscribePlayers } from './firebase/player';
import { subscribeRound } from './firebase/game';
import type { Player, Round } from './types';

const STORAGE_KEY = 'song_guess_game_state';

function App() {
  const [gameState, setGameState] = useState<{
    roomId: string;
    playerName: string;
    isHost: boolean;
    playerId?: string;
  } | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  });

  const { room, loading: roomLoading } = useRoom(gameState?.roomId || '');
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentRound, setCurrentRound] = useState<Round | null>(null);

  useEffect(() => {
    if (gameState) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [gameState]);

  useEffect(() => {
    if (gameState?.roomId) {
      const unsubPlayers = subscribePlayers(gameState.roomId, setPlayers);
      return () => unsubPlayers();
    }
  }, [gameState?.roomId]);

  useEffect(() => {
    if (gameState?.roomId && room?.currentRoundId) {
      const unsubRound = subscribeRound(gameState.roomId, room.currentRoundId, setCurrentRound);
      return () => unsubRound();
    }
  }, [gameState?.roomId, room?.currentRoundId]);

  const handleJoinRoom = async (roomId: string, playerName: string, isHost: boolean) => {
    const playerId = await loginAnonymously();
    setGameState({ roomId, playerName, isHost, playerId });
  };

  if (!gameState) {
    return <HomeView onJoinRoom={handleJoinRoom} />;
  }

  if (roomLoading) {
    return <div className="min-h-screen flex items-center justify-center font-bold text-primary-500 animate-pulse">読み込み中...</div>;
  }

  if (!room) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <p className="mb-4 font-bold text-slate-500">ルームが見つかりません</p>
        <button className="px-6 py-2 bg-primary-600 text-white rounded-2xl font-bold shadow-lg shadow-primary-200" onClick={() => setGameState(null)}>ホームに戻る</button>
      </div>
    );
  }

  const isActualHost = room && gameState?.playerId === room.hostId;

  // ゲーム終了時
  if (room.status === 'finished') {
    return (
      <FinalResultView 
        room={room} 
        players={players} 
        onBackToHome={() => setGameState(null)} 
      />
    );
  }

  // 待機ロビー
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

  // ゲーム中
  if (room.status === 'active' && room.currentRoundId) {
    // Reveal フェーズなら結果表示
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

    // それ以外（提出・推理）なら GameView
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

  return null;
}

export default App;
