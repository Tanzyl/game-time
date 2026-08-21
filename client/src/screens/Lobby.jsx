import { useState } from 'react';
import Doodles from '../Doodles';

export default function Lobby({ session, roomInfo, onReady, onLeave }) {
  // invite links always point at the game server: itch.io iframe URLs can't route /room/CODE
  const url = `${import.meta.env.VITE_SERVER_URL || window.location.origin}/room/${session.code}`;
  const me = roomInfo?.players?.[session.playerIdx];
  const players = roomInfo?.players || [];
  const bothHere = players.length === 2;
  const [copied, setCopied] = useState(false);
  const invite = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="screen lobby">
      <Doodles />
      <button className="back" onClick={onLeave} aria-label="Leave room">←</button>
      <h1 className="title">Lobby</h1>
      <p className="sub">Invite your friend!</p>
      <div className="share-row">
        <code>{url}</code>
        <button className="accent" onClick={invite}>{copied ? '✔ Copied!' : '👥 Invite'}</button>
      </div>
      <div className="panel">
        <p className="label">Players {players.length}/2</p>
        <ul className="players">
          {players.map((p, i) => (
            <li key={i} className="player-row">
              <span className={`avatar p${i}-bg`}>{(p.name || '?')[0].toUpperCase()}</span>
              <span className="pname">{i === 0 && <span className="crown-sm">👑</span>}{p.name}{i === session.playerIdx ? ' (you)' : ''}</span>
              <span className={`status ${p.ready ? 'ready' : ''}`}>
                {p.ready ? <>Ready <i className="check on">✔</i></>
                  : p.connected ? <>Waiting… <i className="check" /></>
                  : <>Offline <i className="check" /></>}
              </span>
            </li>
          ))}
          {!bothHere && <li className="player-row empty">Waiting for a friend to join…</li>}
        </ul>
      </div>
      <button className="success big" disabled={!bothHere || me?.ready} onClick={onReady}>
        {me?.ready ? 'Waiting for opponent…' : 'Start game ▶'}
      </button>
    </div>
  );
}
