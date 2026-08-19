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

export default function Game({ session, game, onGuess, onRematch, onLeave }) {
  const [text, setText] = useState('');
  const inputRef = useRef(null);
  const left = useCountdown(game.endsAt, game.phase === 'playing');
  const me = session.playerIdx;
  const slots = Array.from({ length: 6 }, (_, i) => game.revealed.find((r) => r.slot === i) || null);
  const submit = () => {
    const t = text.trim();
    if (t) onGuess(t);
    setText('');
    inputRef.current?.focus();
  };
  const fresh = game.feedback && Date.now() - game.feedback.at < 1500;

  if (game.phase === 'match_end') {
    const { winner, forfeit } = game.matchEnd;
    const verdict = winner === null ? "It's a draw!" : winner === me ? 'You win! 🎉' : 'You lose';
    return (
      <div className="screen end">
        <h2>{verdict}</h2>
        {forfeit && <p>Opponent left the game.</p>}
        <p className="final-score">
          <span className={`p${me}`}>You: {game.scores[me]}</span> — <span className={`p${1 - me}`}>Them: {game.scores[1 - me]}</span>
        </p>
        <button className="primary" onClick={onRematch}>Rematch</button>
        <button className="link" onClick={onLeave}>Leave</button>
      </div>
    );
  }

  return (
    <div className="screen game">
      <header>
        <span className={`score p${me}`}>You: {game.scores?.[me] ?? 0}</span>
        <span className="round">Round {game.round}/3 · x{game.multiplier}</span>
        <span className={`score p${1 - me}`}>Them: {game.scores?.[1 - me] ?? 0}</span>
      </header>
      {game.oppDisconnected && <p className="warn">Opponent disconnected — waiting up to 15s…</p>}
      <div className={`timer ${left <= 5 ? 'low' : ''}`}>{game.phase === 'playing' ? `${left}s` : 'Round over'}</div>
      <h2 className="question">{game.questionText}</h2>
      <ol className="board">
        {slots.map((r, i) => {
          const missed = game.roundEnd?.unclaimed?.find((u) => u.slot === i);
          return (
            <li key={i} className={r ? `revealed p${r.byPlayer}` : missed ? 'missed' : 'hidden'}>
              {r ? <><span>{r.text}</span><b>{r.points}</b></>
                : missed ? <><span>{missed.text}</span><b>{missed.points}</b></>
                : <span>?</span>}
            </li>
          );
        })}
      </ol>
      {game.phase === 'playing' && (
        <div className="guess-row">
          <input ref={inputRef} autoFocus value={text} maxLength={60}
            placeholder="Type an answer…" onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()} />
          <button onClick={submit}>Guess</button>
        </div>
      )}
      {fresh && <p className="feedback">{game.feedback.result === 'taken' ? 'Already taken!' : 'Nope!'}</p>}
      {game.phase === 'round_end' && <p className="intermission">Next round starting…</p>}
    </div>
  );
}
