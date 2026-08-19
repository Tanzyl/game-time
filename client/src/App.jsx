import { useEffect, useState, useCallback } from 'react';
import { socket } from './socket';
import Home from './screens/Home';
import Lobby from './screens/Lobby';
import Game from './screens/Game';

const stored = () => { try { return JSON.parse(sessionStorage.getItem('gt_session')) || null; } catch { return null; } };

export default function App() {
  const [screen, setScreen] = useState('home'); // home | lobby | game
  const [session, setSession] = useState(null); // {code, token, playerIdx}
  const [roomInfo, setRoomInfo] = useState(null); // room_state payload
  const [gameState, setGameState] = useState(null); // accumulated round/game payload
  const [error, setError] = useState('');

  const join = useCallback((code, token) => {
    const name = localStorage.getItem('gt_name') || '';
    socket.emit('join_room', { code, token, name }, (res) => {
      if (!res.ok) { setError(res.error); sessionStorage.removeItem('gt_session'); return; }
      const s = { code: res.code, token: res.token, playerIdx: res.playerIdx };
      sessionStorage.setItem('gt_session', JSON.stringify(s));
      setSession(s); setScreen('lobby'); setError('');
    });
  }, []);

  const create = useCallback(() => {
    const name = localStorage.getItem('gt_name') || '';
    socket.emit('create_room', { name }, (res) => {
      const s = { code: res.code, token: res.token, playerIdx: res.playerIdx };
      sessionStorage.setItem('gt_session', JSON.stringify(s));
      setSession(s); setScreen('lobby');
    });
  }, []);

  useEffect(() => {
    const onRoomState = (rs) => setRoomInfo(rs);
    const onRoundStart = (p) => { setScreen('game'); setGameState({ phase: 'playing', ...p, revealed: p.revealed || [], feedback: null, roundEnd: null, matchEnd: null }); };
    const onRevealed = (p) => setGameState((g) => g && { ...g, scores: p.scores, revealed: [...g.revealed, p] });
    const onFeedback = (p) => setGameState((g) => g && { ...g, feedback: { ...p, at: Date.now() } });
    const onRoundEnd = (p) => setGameState((g) => g && { ...g, phase: 'round_end', scores: p.scores, roundEnd: p });
    const onMatchEnd = (p) => { setScreen('game'); setGameState((g) => ({ ...(g || {}), phase: 'match_end', scores: p.scores, matchEnd: p })); };
    const onOppDisc = () => setGameState((g) => g && { ...g, oppDisconnected: true });
    const onOppRecon = () => setGameState((g) => g && { ...g, oppDisconnected: false });
    socket.on('room_state', onRoomState);
    socket.on('round_start', onRoundStart);
    socket.on('answer_revealed', onRevealed);
    socket.on('guess_feedback', onFeedback);
    socket.on('round_end', onRoundEnd);
    socket.on('match_end', onMatchEnd);
    socket.on('opponent_disconnected', onOppDisc);
    socket.on('opponent_reconnected', onOppRecon);
    return () => {
      socket.off('room_state', onRoomState); socket.off('round_start', onRoundStart);
      socket.off('answer_revealed', onRevealed); socket.off('guess_feedback', onFeedback);
      socket.off('round_end', onRoundEnd); socket.off('match_end', onMatchEnd);
      socket.off('opponent_disconnected', onOppDisc); socket.off('opponent_reconnected', onOppRecon);
    };
  }, []);

  // Auto-join: /room/CODE in URL, or stored session (reconnect)
  useEffect(() => {
    const m = window.location.pathname.match(/^\/room\/([A-Za-z2-9]{6})$/);
    const s = stored();
    if (m) join(m[1].toUpperCase(), s && s.code === m[1].toUpperCase() ? s.token : undefined);
    else if (s) join(s.code, s.token);
  }, [join]);

  const leave = () => { sessionStorage.removeItem('gt_session'); window.location.href = '/'; };

  if (screen === 'game' && gameState) {
    return <Game session={session} game={gameState} onGuess={(text) => socket.emit('guess', { text })}
      onRematch={() => socket.emit('rematch')} onLeave={leave} roomInfo={roomInfo} />;
  }
  if (screen === 'lobby' && session) {
    return <Lobby session={session} roomInfo={roomInfo} onReady={() => socket.emit('ready')} onLeave={leave} />;
  }
  return <Home onCreate={create} onJoin={(code) => join(code)} error={error} />;
}
