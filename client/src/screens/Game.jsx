import { useEffect, useRef, useState } from 'react';

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
    <div className="series">
      <h3>📊 Series standings · {series.matches} {series.matches === 1 ? 'game' : 'games'}</h3>
      <table>
        <thead><tr><th>#</th><th>Player</th><th>Wins</th><th>Total points</th></tr></thead>
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
    const verdict = winner === null ? "🤝 It's a draw!" : winner === me ? '🏆 You win!' : `😤 ${oppName} wins!`;
    return (
      <div className="screen end">
        {winner === me && <Confetti />}
        <h2>{verdict}</h2>
        {forfeit && <p className="warn">📴 {oppName} left the game.</p>}
        <p className="final-score">
          <span className={`p${me}`}>{myName}: {game.scores[me]}</span>
          <span className="vs"> vs </span>
          <span className={`p${1 - me}`}>{oppName}: {game.scores[1 - me]}</span>
        </p>
        <SeriesBoard series={series} names={names || [myName, oppName]} me={me} />
        {!forfeit && <button className="primary" onClick={onRematch}>🔁 Rematch</button>}
        <button className="link" onClick={onLeave}>Leave game</button>
      </div>
    );
  }

  return (
    <div className="screen game">
      <header>
        <span className={`score p${me}`}>{myName}<b>{game.scores?.[me] ?? 0}</b></span>
        <span className="round">Round {game.round}/3<br /><em>×{game.multiplier} points</em></span>
        <span className={`score p${1 - me}`}>{oppName}<b>{game.scores?.[1 - me] ?? 0}</b></span>
      </header>
      {game.oppDisconnected && <p className="warn">📴 {oppName} disconnected — waiting up to 15s…</p>}
      <div className={`timer ${left <= 5 ? 'low' : ''}`}>{game.phase === 'playing' ? `⏱ ${left}s` : "⏰ Time's up!"}</div>
      <h2 className="question">{game.questionText}</h2>
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
      {game.phase === 'playing' && (
        <div className="guess-row">
          <input ref={inputRef} autoFocus value={text} maxLength={60}
            placeholder="Type your answer…" onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()} />
          <button className="primary" onClick={submit}>Go!</button>
        </div>
      )}
      {fresh && <p className="feedback">{game.feedback.result === 'taken' ? '🙅 Already taken!' : '❌ Nope, try again!'}</p>}
      {game.phase === 'round_end' && <p className="intermission">🎬 Next round starting…</p>}
    </div>
  );
}
