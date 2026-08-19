import { useState } from 'react';

export default function Home({ onCreate, onJoin, error }) {
  const [code, setCode] = useState('');
  return (
    <div className="screen home">
      <h1>Guess Their Answer</h1>
      <p className="tagline">Guess the most popular answers. Beat your friend.</p>
      <button className="primary" onClick={onCreate}>Create room</button>
      <div className="join-row">
        <input value={code} maxLength={6} placeholder="Room code"
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && code.length === 6 && onJoin(code)} />
        <button disabled={code.length !== 6} onClick={() => onJoin(code)}>Join</button>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
