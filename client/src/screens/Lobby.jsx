export default function Lobby({ session, roomInfo, onReady, onLeave }) {
  const url = `${window.location.origin}/room/${session.code}`;
  const me = roomInfo?.players?.[session.playerIdx];
  const bothHere = (roomInfo?.players?.length || 0) === 2;
  return (
    <div className="screen lobby">
      <h2>🎪 Room {session.code}</h2>
      <p>Share this link with your opponent:</p>
      <div className="share-row">
        <code>{url}</code>
        <button onClick={() => navigator.clipboard.writeText(url)}>📋 Copy</button>
      </div>
      <ul className="players">
        {(roomInfo?.players || []).map((p, i) => (
          <li key={i} className={`p${i}`}>
            {i === 0 ? '🔵' : '🟠'} {p.name}{i === session.playerIdx ? ' (you)' : ''} — {p.ready ? '✅ Ready' : p.connected ? '⏳ Waiting' : '📴 Disconnected'}
          </li>
        ))}
        {!bothHere && <li className="empty">Waiting for opponent to join…</li>}
      </ul>
      <button className="primary" disabled={!bothHere || me?.ready} onClick={onReady}>
        {me?.ready ? 'Waiting for opponent…' : "Let's go! 🚀"}
      </button>
      <button className="link" onClick={onLeave}>Leave</button>
    </div>
  );
}
