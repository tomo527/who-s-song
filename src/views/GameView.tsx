import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { subscribeRound, subscribeSubmissions, submitSong, updateRoundPhase, submitGuess, subscribePlayerGuess } from '../firebase/game';
import type { Round, Submission, Player, GuessAnswer } from '../types';
import { subscribePlayers } from '../firebase/player';

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
    const unsubRound = subscribeRound(roomId, roundId, setRound);
    const unsubPlayers = subscribePlayers(roomId, setPlayers);
    const unsubSubs = subscribeSubmissions(roomId, roundId, (subs) => {
      setSubmissions(subs);
      // 自分が提出済みかチェック
      const mySub = subs.find(s => s.playerId === playerId);
      if (mySub) {
        setIsSubmitted(true);
        setSongName(mySub.songName);
        setComment(mySub.comment || '');
      }
    });

    // 自分の予想を購読（リロード復帰用）
    const unsubGuess = subscribePlayerGuess(roomId, roundId, playerId, (g) => {
      if (g && g.answers) {
        setGuesses(g.answers);
        setIsGuessSubmitted(true);
      }
    });

    return () => {
      unsubRound();
      unsubSubs();
      unsubPlayers();
      unsubGuess();
    };
  }, [roomId, roundId, playerId]);

  // 曲を提出
  const handleSubmitSong = async () => {
    if (!songName) return;
    setLoading(true);
    try {
      await submitSong(roomId, roundId, playerId, songName, comment);
      setIsSubmitted(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // 予想を保存
  const handleAssignGuess = (submissionId: string, targetPlayerId: string) => {
    setGuesses(prev => {
      const filtered = prev.filter(g => g.submissionId !== submissionId);
      return [...filtered, { submissionId, guessedPlayerId: targetPlayerId }];
    });
  };

  const handleSubmitGuesses = async () => {
    if (guesses.length < submissions.length) return;
    setLoading(true);
    try {
      await submitGuess(roomId, roundId, playerId, guesses);
      // 推理完了状態を表示（MVPでは簡易的にフラグで管理するか Firestore 連携）
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!round) return <Layout title="読込中..."><p>ロード中...</p></Layout>;

  // フェーズ1: 曲提出
  if (round.phase === 'submitting') {
    return (
      <Layout title="曲を提出">
        <div className="space-y-8">
          <Card className="bg-primary-600 text-white">
            <p className="text-xs font-bold text-primary-200 uppercase tracking-widest mb-2">今ラウンドのお題</p>
            <h3 className="text-2xl font-black">{round.theme}</h3>
          </Card>

          {!isSubmitted ? (
            <div className="space-y-6">
              <Input 
                label="曲名" 
                placeholder="例: 残響散歌" 
                value={songName}
                onChange={(e) => setSongName(e.target.value)}
              />
              <Input 
                label="ひとこと（任意）" 
                placeholder="例: この曲を聴くと元気が出ます" 
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <Button size="lg" fullWidth isLoading={loading} onClick={handleSubmitSong}>提出する</Button>
            </div>
          ) : (
            <div className="text-center py-12 space-y-6">
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto ring-8 ring-green-50 animate-bounce">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div className="space-y-2">
                <h4 className="text-2xl font-black text-slate-800">提出完了！</h4>
                <p className="text-slate-500 font-bold">全員の提出が終わるのを待っています...</p>
              </div>
              
              <div className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-100">
                <p className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-tighter">Status</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {players.map(p => {
                    const hasSubmitted = submissions.some(s => s.playerId === p.id);
                    return (
                      <div key={p.id} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${hasSubmitted ? 'bg-green-500 text-white scale-110' : 'bg-slate-200 text-slate-400'}`}>
                        {hasSubmitted ? '✓' : p.name.charAt(0)}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 text-xs font-black text-slate-500">
                  {submissions.length} / {players.length}人 完了
                </div>
              </div>
              
              {isHost && submissions.length === players.length && (
                <div className="pt-4">
                  <Button variant="primary" size="lg" fullWidth onClick={() => updateRoundPhase(roomId, roundId, 'guessing')}>
                    全員揃ったので推理を開始！
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </Layout>
    );
  }

  // フェーズ2: 推理中
  if (round.phase === 'guessing') {
    return (
      <Layout title="推理タイム">
        <div className="space-y-6">
          <Card className="bg-primary-600 text-white py-4">
            <p className="text-[10px] font-bold text-primary-200 uppercase tracking-widest mb-1">今回のお題</p>
            <h3 className="text-xl font-black">{round.theme}</h3>
          </Card>
          
          <div className="text-center space-y-1">
            <h3 className="text-lg font-black text-slate-800 tracking-tight">誰がどの曲を選んだ？</h3>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-tighter">各プレイヤーを曲に割り当ててください</p>
          </div>

          {isGuessSubmitted ? (
            <div className="text-center py-12 space-y-4">
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <h4 className="text-xl font-bold">推理完了！</h4>
              <p className="text-slate-500">ホストが正解を発表するのを待っています...</p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {submissions.map((sub, idx) => (
                  <Card key={sub.id} className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-none w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-400">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-lg text-slate-800 break-words">{sub.songName}</p>
                        {sub.comment && <p className="text-sm text-slate-500 italic mt-1 leading-relaxed">"{sub.comment}"</p>}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 mt-4">
                      {players.map(p => {
                        const isSelected = guesses.some(g => g.submissionId === sub.id && g.guessedPlayerId === p.id);
                        const isAssignedElseWhere = guesses.some(g => g.submissionId !== sub.id && g.guessedPlayerId === p.id);
                        const isMeForMySong = sub.playerId === playerId && p.id === playerId;
                        
                        return (
                          <button
                            key={p.id}
                            disabled={isAssignedElseWhere || isMeForMySong}
                            onClick={() => handleAssignGuess(sub.id, p.id)}
                            className={`
                              py-2.5 px-3 rounded-xl text-xs font-black transition-all border-2
                              ${isSelected ? 'bg-primary-600 border-primary-600 text-white shadow-lg shadow-primary-100 scale-[1.02]' : 'bg-white border-slate-100 text-slate-500'}
                              ${(isAssignedElseWhere || isMeForMySong) ? 'opacity-20 grayscale' : 'hover:border-primary-200 active:scale-95'}
                            `}
                          >
                            {p.name}
                            {isMeForMySong && <span className="block text-[8px] opacity-70">（自分です）</span>}
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
                  disabled={guesses.length < submissions.length}
                  onClick={handleSubmitGuesses}
                >
                  回答を送信する
                </Button>
                {isHost && (
                  <Button variant="ghost" fullWidth className="mt-4" onClick={() => updateRoundPhase(roomId, roundId, 'revealing')}>
                    （ホスト専用）回答発表へ
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
        <h3 className="text-2xl font-bold mb-4">正解発表</h3>
        <p className="text-slate-500">まもなく結果が表示されます...</p>
        {isHost && (
          <Button className="mt-8" onClick={() => {/* 次のラウンドへ */}}>
            次のラウンドへ
          </Button>
        )}
      </div>
    </Layout>
  );
};
