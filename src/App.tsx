import { useEffect, useState } from 'react';
import { deactivatePlayer, subscribePlayers } from './firebase/player';
import { subscribeRound } from './firebase/game';
import { firebaseConfigError } from './firebase/config';
import { waitForAuthReady } from './firebase/auth';
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

const readSavedGameState = (): SavedGameState | null => {
  try {
    const sessionSaved = sessionStorage.getItem(STORAGE_KEY);
    if (sessionSaved) {
      return JSON.parse(sessionSaved) as SavedGameState;
    }

    const legacySaved = localStorage.getItem(STORAGE_KEY);
    if (!legacySaved) {
      return null;
    }

    const parsed = JSON.parse(legacySaved) as SavedGameState;
    sessionStorage.setItem(STORAGE_KEY, legacySaved);
    localStorage.removeItem(STORAGE_KEY);
    return parsed;
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
};

function App() {
  const [gameState, setGameState] = useState<SavedGameState | null>(() => readSavedGameState());
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [authResolved, setAuthResolved] = useState(() => !readSavedGameState());
  const [identityError, setIdentityError] = useState<string | null>(null);
  const { room, loading, error } = useRoom(gameState?.roomId || '');

  useEffect(() => {
    if (gameState) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(gameState));
      localStorage.removeItem(STORAGE_KEY);
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [gameState]);

  useEffect(() => {
    if (!gameState || firebaseConfigError) {
      return;
    }

    let cancelled = false;

    void waitForAuthReady()
      .then((uid) => {
        if (cancelled) {
          return;
        }

        if (!uid) {
          setIdentityError('匿名認証の復元に失敗しました。もう一度ルームに入り直してください。');
          setAuthResolved(true);
          return;
        }

        if (gameState.playerId && gameState.playerId !== uid) {
          setIdentityError('保存されていたプレイヤー情報と現在の匿名認証が一致しません。もう一度ルームに入り直してください。');
          setAuthResolved(true);
          return;
        }

        if (!gameState.playerId) {
          setGameState((currentState) => (currentState ? { ...currentState, playerId: uid } : currentState));
        }

        setIdentityError(null);
        setAuthResolved(true);
      })
      .catch((authError) => {
        if (cancelled) {
          return;
        }

        setIdentityError(
          authError instanceof Error
            ? authError.message
            : '匿名認証の復元に失敗しました。もう一度ルームに入り直してください。',
        );
        setAuthResolved(true);
      });

    return () => {
      cancelled = true;
    };
  }, [gameState]);

  useEffect(() => {
    if (!gameState?.roomId || firebaseConfigError || identityError) {
      return;
    }

    return subscribePlayers(gameState.roomId, setPlayers);
  }, [gameState?.roomId, identityError]);

  useEffect(() => {
    if (!gameState?.roomId || !room?.currentRoundId || firebaseConfigError || identityError) {
      return;
    }

    return subscribeRound(gameState.roomId, room.currentRoundId, setCurrentRound);
  }, [gameState?.roomId, room?.currentRoundId, identityError]);

  const handleJoinRoom = (roomId: string, playerName: string, isHost: boolean, playerId: string) => {
    setIdentityError(null);
    setAuthResolved(false);
    setGameState({ roomId, playerName, isHost, playerId });
  };

  const handleResetSession = () => {
    setIdentityError(null);
    setAuthResolved(true);
    setGameState(null);
  };

  const handleBackToHomeFromLobby = async () => {
    const currentState = gameState;

    try {
      if (currentState?.roomId && currentState.playerId) {
        await deactivatePlayer(currentState.roomId, currentState.playerId);
      }
    } finally {
      setIdentityError(null);
      setAuthResolved(true);
      setGameState(null);
    }
  };

  const authReady = !gameState || firebaseConfigError ? true : authResolved;

  if (!gameState) {
    return <HomeView onJoinRoom={handleJoinRoom} startupError={firebaseConfigError} />;
  }

  if (identityError) {
    return (
      <StartupErrorScreen
        title="プレイヤー情報を復元できませんでした"
        description="保存されていたプレイヤー情報と現在の匿名認証が一致しません。再参加して同じプレイヤーとして入り直してください。"
        message={identityError}
        onBack={handleResetSession}
      />
    );
  }

  if (firebaseConfigError) {
    return (
      <StartupErrorScreen
        title="Firebase 設定エラー"
        description="必要な環境変数が不足しているため、ルーム情報を読み込めません。"
        message={firebaseConfigError}
        onBack={handleResetSession}
      />
    );
  }

  if (!authReady || loading) {
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
        onBack={handleResetSession}
      />
    );
  }

  if (!room) {
    return (
      <StartupErrorScreen
        title="ルームが見つかりません"
        description="指定されていたルームが削除されたか、アクセスできません。"
        message={gameState.roomId}
        onBack={handleResetSession}
      />
    );
  }

  const currentPlayerId = gameState.playerId || '';
  const isActualHost = currentPlayerId === room.hostId;

  if (room.status === 'finished') {
    return (
      <FinalResultView
        room={room}
        players={players}
        currentPlayerId={currentPlayerId}
        onBackToHome={handleResetSession}
      />
    );
  }

  if (room.status === 'waiting') {
    return (
      <LobbyView
        room={room}
        players={players}
        isHost={isActualHost}
        currentPlayerId={currentPlayerId}
        onBackToHome={handleBackToHomeFromLobby}
      />
    );
  }

  if (room.status === 'active' && room.currentRoundId) {
    if (currentRound?.phase === 'revealing') {
      return (
        <ResultView
          room={room}
          roundId={room.currentRoundId}
          round={currentRound}
          players={players}
          currentPlayerId={currentPlayerId}
        />
      );
    }

    return (
      <GameView
        roomId={room.id}
        roundId={room.currentRoundId}
        playerId={currentPlayerId}
        isHost={isActualHost}
        roomGenre={room.settings.genre || ''}
        submitTimeLimit={room.settings.submitTimeLimit ?? null}
        guessTimeLimit={room.settings.guessTimeLimit ?? null}
        round={currentRound}
        players={players}
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
      onBack={handleResetSession}
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
