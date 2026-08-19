# Guess Their Answer — 1v1

A two-player, Family Feud–style browser game. Guess the most popular answers
to survey questions before your opponent claims them.

## How to play

1. One player clicks **Create room** and shares the link (or 6-letter code).
2. The other player opens the link and both click **Ready**.
3. 3 rounds, one question each, 30 seconds per round. Type as many answers
   as you can — a matched answer is claimed by whoever finds it first and
   scores its popularity points times the round multiplier (x1, x2, x3).
4. Highest total after round 3 wins. Rematch anytime.

If you disconnect mid-game you have 15 seconds to reload and resume;
otherwise your opponent wins by forfeit.

## Setup

```bash
npm install
cd client && npm install && cd ..
```

## Run (production)

```bash
npm run build
node server/index.js     # http://localhost:3000  (PORT env to override)
```

## Run (development)

Two terminals:

```bash
npm run dev:server       # API/socket server on :3000
cd client && npm run dev # Vite dev server on :5173, proxies socket.io to :3000
```

## Tests

```bash
npm test                 # engine + dataset + socket integration tests
node server/smoke.js     # plays a full 3-round match end to end (~20s)
```

## Layout

- `server/game.js` — pure game rules (matching, scoring, rounds); no socket code
- `server/index.js` — Express + Socket.IO rooms, timers, reconnect/forfeit
- `server/questions.json` — 150 questions, 6 weighted answers each
- `client/` — React (Vite) app: Home, Lobby, Game screens
