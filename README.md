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
node server/index.js     # http://localhost:4560  (PORT env to override)
```

## Playing from two devices

Both devices must reach the server. On the same Wi-Fi:

1. Start the server — it prints a `Network: http://192.168.x.x:4560` URL.
2. Open that **Network** URL on BOTH devices (not `localhost`), create the
   room on one, and share the link with the other.
3. If the other device can't connect, allow Node.js through Windows
   Firewall (Windows prompts the first time, or: Settings → Firewall →
   Allow an app), and make sure the network is set to "Private".

To play over the internet (different networks), expose the port with a
tunnel. The most reliable no-signup option (uses the SSH client built
into Windows):

```bash
node server/index.js                                 # terminal 1
ssh -R 80:localhost:4560 nokey@localhost.run         # terminal 2
```

It prints an `https://xxxx.lhr.life` URL — open that on both devices and
play. The URL changes each run. (`npm run tunnel` / localtunnel and
cloudflared quick tunnels also work in principle but proved unreliable
on some networks — localhost.run is the one verified working here.)

## Run (development)

Two terminals:

```bash
npm run dev:server       # API/socket server on :4560
cd client && npm run dev # Vite dev server on :5173, proxies socket.io to :4560
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
