import { useState } from 'react';
import Doodles from '../Doodles';

function Logo() {
  return (
    <div className="logo">
      <span className="crown">👑</span>
      <span className="l1">Guess</span>
      <span className="l2">Their</span>
      <span className="l3">Answer</span>
    </div>
  );
}

export default function Home({ onCreate, onJoin, error, pendingCode }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState(() => localStorage.getItem('gt_name') || '');
  const saveName = () => localStorage.setItem('gt_name', name.trim());
  const ready = name.trim().length > 0;

  if (pendingCode) {
    const go = () => { saveName(); onJoin(pendingCode); };
    return (
      <div className="screen home">
        <Doodles />
        <Logo />
        <p className="tagline">You've been invited to room <b className="hl">{pendingCode}</b>!</p>
        <input value={name} maxLength={20} placeholder="Your name"
          onChange={(e) => setName(e.target.value)} autoFocus
          onKeyDown={(e) => e.key === 'Enter' && ready && go()} />
        <button className="primary big" disabled={!ready} onClick={go}>▶ Join game</button>
        {!ready && <p className="hint">Enter your name to play</p>}
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="screen home">
      <Doodles />
      <Logo />
      <p className="tagline">Guess the most popular answers. Beat your friend!</p>
      <input value={name} maxLength={20} placeholder="Your name"
        onChange={(e) => setName(e.target.value)} autoFocus />
      <button className="primary big" disabled={!ready}
        onClick={() => { saveName(); onCreate(); }}>▶ Play</button>
      <div className="join-row">
        <input value={code} maxLength={6} placeholder="Room code"
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && ready && code.length === 6 && (saveName(), onJoin(code))} />
        <button className="accent" disabled={!ready || code.length !== 6}
          onClick={() => { saveName(); onJoin(code); }}>Join</button>
      </div>
      {!ready && <p className="hint">Enter your name to play</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
