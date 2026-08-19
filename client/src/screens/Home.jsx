import { useState } from 'react';

export default function Home({ onCreate, onJoin, error }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState(() => localStorage.getItem('gt_name') || '');
  const saveName = () => localStorage.setItem('gt_name', name.trim());
  const ready = name.trim().length > 0;
  return (
    <div className="screen home">
      <h1>🎯 Guess Their Answer</h1>
      <p className="tagline">Guess the most popular answers. Beat your friend. 🏆</p>
      <input value={name} maxLength={20} placeholder="Your name"
        onChange={(e) => setName(e.target.value)} autoFocus />
      <button className="primary" disabled={!ready}
        onClick={() => { saveName(); onCreate(); }}>🎮 Create room</button>
      <div className="join-row">
        <input value={code} maxLength={6} placeholder="Room code"
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && ready && code.length === 6 && (saveName(), onJoin(code))} />
        <button disabled={!ready || code.length !== 6}
          onClick={() => { saveName(); onJoin(code); }}>Join</button>
      </div>
      {!ready && <p className="hint">Enter your name to play</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
