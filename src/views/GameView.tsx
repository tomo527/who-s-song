import React, { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { Layout } from '../components/Layout';
import {
  subscribePlayerGuess,
  subscribeRound,
  subscribeSubmissions,
  submitGuess,
  submitSong,
  updateRoundPhase,
} from '../firebase/game';
import { subscribePlayers } from '../firebase/player';
import type { GuessAnswer, Player, Round, Submission } from '../types';

interface GameViewProps {
  roomId: string;
  roundId: string;
  playerId: string;
  playerName: string;
  isHost: boolean;
}

export const GameView: React.FC<GameViewProps> = ({ roomId, roundId, playerId, isHost }) => {
  const [round, setRound] = useState<Round | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [songName, setSongName] = useState('');
  const [comment, setComment] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isGuessSubmitted, setIsGuessSubmitted] = useState(false);
  const [guesses, setGuesses] = useState<GuessAnswer[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsubscribeRound = subscribeRound(roomId, roundId, setRound);
    const unsubscribePlayers = subscribePlayers(roomId, setPlayers);
    const unsubscribeSubmissions = subscribeSubmissions(roomId, roundId, (nextSubmissions) => {
      setSubmissions(nextSubmissions);

      const mySubmission = nextSubmissions.find((submission) => submission.playerId === playerId);
      if (mySubmission) {
        setIsSubmitted(true);
        setSongName(mySubmission.songName);
        setComment(mySubmission.comment || '');
      }
    });
    const unsubscribeGuess = subscribePlayerGuess(roomId, roundId, playerId, (guess) => {
      if (guess?.answers) {
        setGuesses(guess.answers);
        setIsGuessSubmitted(true);
      }
    });

    return () => {
      unsubscribeRound();
      unsubscribePlayers();
      unsubscribeSubmissions();
      unsubscribeGuess();
    };
  }, [playerId, roomId, roundId]);

  const handleSubmitSong = async () => {
    if (!songName.trim()) {
      return;
    }

    setLoading(true);
    try {
      await submitSong(roomId, roundId, playerId, songName.trim(), comment.trim());
      setIsSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignGuess = (submissionId: string, guessedPlayerId: string) => {
    setGuesses((previousGuesses) => {
      const filtered = previousGuesses.filter((guess) => guess.submissionId !== submissionId);
      return [...filtered, { submissionId, guessedPlayerId }];
    });
  };

  const handleSubmitGuesses = async () => {
    if (guesses.length < submissions.length) {
      return;
    }

    setLoading(true);
    try {
      await submitGuess(roomId, roundId, playerId, guesses);
      setIsGuessSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  if (!round) {
    return (
      <Layout title="ゲーム">
        <p className="text-slate-500">ラウンド情報を読み込んでいます...</p>
      </Layout>
    );
  }

  if (round.phase === 'submitting') {
    return (
      <Layout title="曲を提出">
        <div className="space-y-8">
          <Card className="bg-primary-600 text-white">
            <p className="text-xs font-bold text-primary-200 uppercase tracking-widest mb-2">今回のお題</p>
            <h3 className="text-2xl font-black">{round.theme}</h3>
          </Card>

          {!isSubmitted ? (
            <div className="space-y-6">
              <Input
                label="曲名"
                placeholder="例: 夜に駆ける"
                value={songName}
                onChange={(event) => setSongName(event.target.value)}
              />
              <Input
                label="ひとこと"
                placeholder="任意。あとで結果画面に表示されます"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
              />
              <Button size="lg" fullWidth isLoading={loading} onClick={handleSubmitSong}>
                提出する
              </Button>
            </div>
          ) : (
            <div className="text-center py-12 space-y-6">
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto ring-8 ring-green-50">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <div className="space-y-2">
                <h4 className="text-2xl font-black text-slate-800">提出完了</h4>
                <p className="text-slate-500 font-bold">全員の提出が揃うまでお待ちください。</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-100">
                <p className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-tighter">Status</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {players.map((player) => {
                    const hasSubmitted = submissions.some((submission) => submission.playerId === player.id);
                    return (
                      <div
                        key={player.id}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                          hasSubmitted ? 'bg-green-500 text-white scale-110' : 'bg-slate-200 text-slate-400'
                        }`}
                      >
                        {hasSubmitted ? '✓' : player.name.charAt(0)}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 text-xs font-black text-slate-500">
                  {submissions.length} / {players.length} 人が提出済み
                </div>
              </div>

              {isHost && submissions.length === players.length && (
                <div className="pt-4">
                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    onClick={() => void updateRoundPhase(roomId, roundId, 'guessing')}
                  >
                    推理フェーズへ進む
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </Layout>
    );
  }

  if (round.phase === 'guessing') {
    return (
      <Layout title="推理タイム">
        <div className="space-y-6">
          <Card className="bg-primary-600 text-white py-4">
            <p className="text-[10px] font-bold text-primary-200 uppercase tracking-widest mb-1">今回のお題</p>
            <h3 className="text-xl font-black">{round.theme}</h3>
          </Card>

          <div className="text-center space-y-1">
            <h3 className="text-lg font-black text-slate-800 tracking-tight">誰の曲かを予想してください</h3>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-tighter">
              同じ人を複数の曲に割り当てることはできません
            </p>
          </div>

          {isGuessSubmitted ? (
            <div className="text-center py-12 space-y-4">
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <h4 className="text-xl font-bold">回答を送信しました</h4>
              <p className="text-slate-500">結果発表までお待ちください。</p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {submissions.map((submission, index) => (
                  <Card key={submission.id} className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-none w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-400">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-lg text-slate-800 break-words">{submission.songName}</p>
                        {submission.comment && (
                          <p className="text-sm text-slate-500 italic mt-1 leading-relaxed">"{submission.comment}"</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-4">
                      {players.map((player) => {
                        const isSelected = guesses.some(
                          (guess) =>
                            guess.submissionId === submission.id && guess.guessedPlayerId === player.id,
                        );
                        const isAssignedElsewhere = guesses.some(
                          (guess) =>
                            guess.submissionId !== submission.id && guess.guessedPlayerId === player.id,
                        );
                        const isOwnSong = submission.playerId === playerId && player.id === playerId;

                        return (
                          <button
                            type="button"
                            key={player.id}
                            disabled={isAssignedElsewhere || isOwnSong}
                            onClick={() => handleAssignGuess(submission.id, player.id)}
                            className={`
                              py-2.5 px-3 rounded-xl text-xs font-black transition-all border-2
                              ${isSelected ? 'bg-primary-600 border-primary-600 text-white shadow-lg shadow-primary-100 scale-[1.02]' : 'bg-white border-slate-100 text-slate-500'}
                              ${(isAssignedElsewhere || isOwnSong) ? 'opacity-20 grayscale' : 'hover:border-primary-200 active:scale-95'}
                            `}
                          >
                            {player.name}
                            {isOwnSong && <span className="block text-[8px] opacity-70">自分は選べません</span>}
                          </button>
                        );
                      })}
                    </div>
                  </Card>
                ))}
              </div>

              <div className="pt-6">
                <Button
                  size="lg"
                  fullWidth
                  variant={guesses.length === submissions.length ? 'primary' : 'outline'}
                  disabled={guesses.length < submissions.length || loading}
                  onClick={handleSubmitGuesses}
                >
                  回答を送信する
                </Button>
                {isHost && (
                  <Button
                    variant="ghost"
                    fullWidth
                    className="mt-4"
                    onClick={() => void updateRoundPhase(roomId, roundId, 'revealing')}
                  >
                    ホストが結果発表へ進む
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="結果発表">
      <div className="text-center py-20">
        <h3 className="text-2xl font-bold mb-4">結果発表</h3>
        <p className="text-slate-500">ホストが結果画面を開くのを待っています。</p>
      </div>
    </Layout>
  );
};
