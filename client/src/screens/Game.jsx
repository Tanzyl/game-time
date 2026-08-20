import { useEffect, useRef, useState } from 'react';
import Doodles from '../Doodles';

const ROUND_SECS = 30; // mirrors server ROUND_MS

function useCountdown(endsAt, active) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!active) return;
    const tick = () => setLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endsAt, active]);
  return left;
}

function Confetti() {
  const bits = ['🎉', '🎊', '⭐', '🏆', '✨', '🥳'];
  return (
    <div className="confetti">
      {Array.from({ length: 24 }, (_, i) => (
        <span key={i} style={{ left: `${(i * 41) % 100}%`, animationDelay: `${(i % 8) * 0.25}s` }}>
          {bits[i % bits.length]}
        </span>
      ))}
    </div>
  );
}

function SeriesBoard({ series, names, me }) {
  if (!series || !names) return null;
  const rows = [0, 1]
    .map((i) => ({ i, name: names[i], points: series.points[i], wins: series.wins[i] }))
    .sort((a, b) => b.points - a.points);
  return (
    <div className="series panel">
      <p className="label">Series standings · {series.matches} {series.matches === 1 ? 'game' : 'games'}</p>
      <table>
        <thead><tr><th>#</th><th>Player</th><th>Wins</th><th>Total</th></tr></thead>
        <tbody>
          {rows.map((r, pos) => (
            <tr key={r.i} className={`p${r.i} ${r.i === me ? 'me' : ''}`}>
              <td>{pos === 0 ? '🥇' : '🥈'}</td>
              <td>{r.name}{r.i === me ? ' (you)' : ''}</td>
              <td>{r.wins}</td>
              <td>{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Game({ session, game, onGuess, onRematch, onLeave, roomInfo }) {
  const [text, setText] = useState('');
  const inputRef = useRef(null);
  const left = useCountdown(game.endsAt, game.phase === 'playing');
  const me = session.playerIdx;
  const myName = roomInfo?.players?.[me]?.name || 'You';
  const oppName = roomInfo?.players?.[1 - me]?.name || 'Opponent';
  const slots = Array.from({ length: 6 }, (_, i) => game.revealed.find((r) => r.slot === i) || null);

  // fresh round -> fresh input box
  useEffect(() => { setText(''); inputRef.current?.focus(); }, [game.round, game.phase]);

  const submit = () => {
    const t = text.trim();
    if (t) onGuess(t);
    setText('');
    inputRef.current?.focus();
  };
  const fresh = game.feedback && Date.now() - game.feedback.at < 1500;

  if (game.phase === 'match_end') {
    const { winner, forfeit, series, names } = game.matchEnd;
    const verdict = winner === null ? "🤝 It's a draw!" : winner === me ? 'You win!' : `${oppName} wins!`;
    const cards = [me, 1 - me].map((i) => ({
      i,
      name: i === me ? myName : oppName,
      score: game.scores[i],
      won: winner === i,
    }));
    return (
      <div className="screen end">
        <Doodles />
        {winner === me && <Confetti />}
        <h1 className="title">Results</h1>
        <span className="round-pill">{verdict}</span>
        {forfeit && <p className="warn">📴 {oppName} left the game.</p>}
        <div className="podium">
          {cards.map((c) => (
            <div key={c.i} className={`pcard p${c.i} ${c.won ? 'winner' : ''}`}>
              {c.won && <span className="pcrown">👑</span>}
              <span className={`avatar lg p${c.i}-bg`}>{c.name[0].toUpperCase()}</span>
              <b className="pname">{c.name}{c.i === me ? ' (you)' : ''}</b>
              <span className="pts">{c.score}</span>
            </div>
          ))}
        </div>
        <SeriesBoard series={series} names={names || [myName, oppName]} me={me} />
        <div className="end-actions">
          <button onClick={onLeave}>🏠 Main menu</button>
          {!forfeit && <button className="accent" onClick={onRematch}>Rematch ▶</button>}
        </div>
      </div>
    );
  }

  return (
    <div className="screen game">
      <Doodles />
      <header>
        <span className={`badge score-badge p${me}`}><small>{myName}</small><b>{game.scores?.[me] ?? 0}</b></span>
        <span className="badge round-badge"><small>Round</small><b>{game.round}<em> / 3</em></b><span className="mult">×{game.multiplier} points</span></span>
        <span className={`badge score-badge p${1 - me}`}><small>{oppName}</small><b>{game.scores?.[1 - me] ?? 0}</b></span>
      </header>
      {game.oppDisconnected && <p className="warn">📴 {oppName} disconnected — waiting up to 15s…</p>}
      <div className="question-card">
        <span className="quote">“</span>
        <h2 className="question">{game.questionText}</h2>
      </div>
      <div className="timerbar">
        <span className={`clock ${left <= 5 ? 'low' : ''}`}>⏱ {game.phase === 'playing' ? left : 0}</span>
        <div className="track">
          <div className={`fill ${left <= 5 ? 'low' : ''}`}
            style={{ width: `${game.phase === 'playing' ? Math.min(100, (left / ROUND_SECS) * 100) : 0}%` }} />
        </div>
      </div>
      {game.phase === 'playing' && (
        <div className="guess-row">
          <input ref={inputRef} autoFocus value={text} maxLength={60}
            placeholder="Type your answer…" onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()} />
          <button className="accent go" onClick={submit} aria-label="Submit answer">➤</button>
        </div>
      )}
      <p className="board-label">What do you think others answered?</p>
      <ol className="board">
        {slots.map((r, i) => {
          const missed = game.roundEnd?.unclaimed?.find((u) => u.slot === i);
          return (
            <li key={i} className={r ? `revealed p${r.byPlayer}` : missed ? 'missed revealed' : 'hidden'}>
              {r ? <><span>{r.byPlayer === me ? '🔵' : '🟠'} {r.text}</span><b>+{r.points}</b></>
                : missed ? <><span>💤 {missed.text}</span><b>{missed.points}</b></>
                : <span>❓</span>}
            </li>
          );
        })}
      </ol>
      {fresh && <p className="feedback">{game.feedback.result === 'taken' ? '🙅 Already taken!' : '❌ Nope, try again!'}</p>}
      {game.phase === 'round_end' && <p className="intermission">🎬 Next round starting…</p>}
    </div>
  );
}
