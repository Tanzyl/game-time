# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install && cd client && npm install     # one-time setup (two package.json files)
npm test                                    # node --test, discovers server/*.test.js
node --test server/game.test.js            # single test file
npm run build                               # vite-builds client into client/dist
node server/index.js                        # serve game on :4560 (PORT env overrides)
node server/smoke.js                        # full 3-round match E2E against a local throwaway server
node server/smoke.js https://guess-their-answer.onrender.com   # same, against production
```

Dev with hot reload: `npm run dev:server` plus `cd client && npm run dev` (Vite on :5173 proxies `/socket.io` to :4560).

Do not use `node --test server/` — directory args break on Windows; bare `node --test` works.

Before starting a local server, make sure no stale `node` process already owns port 4560 — a second instance crashes silently (hidden window) and you end up testing against old code.

## Deployment

Push to `master` on github.com/Tanzyl/game-time → Render auto-deploys to https://guess-their-answer.onrender.com (config in `render.yaml`, free tier: sleeps after ~15 idle minutes). Verify a deploy landed by checking the hashed bundle name from `client/dist/assets/` appears in the live HTML, then run the smoke script against the URL.

## Architecture

Two-player realtime "Guess Their Answer" (Family Feud–style). One Node process serves everything; no database — all state is in-memory and dies with the process.

**Server-authoritative:** clients only send typed guesses and render what the server broadcasts. Hidden answers never reach a browser before reveal. Round timers run server-side only (`round_start` carries an `endsAt` timestamp; clients render a countdown but only the server ends a round).

Three layers, strictly separated:

- `server/game.js` — pure rules, zero socket imports, fully unit-tested. Match state machine (3 rounds, x1/x2/x3 multipliers), guess matching (normalize → strip leading articles → plural/singular → Levenshtein ≤1 for 4–6 chars, ≤2 for 7+), claim-once board semantics.
- `server/index.js` — Express static serving + SPA fallback (`/room/:code`) + Socket.IO wiring. Owns the room `Map` (6-char codes), timers, reconnect tokens (15s grace then forfeit), rate limiting (3 guesses/sec, 60-char cap), and cross-rematch series stats (`room.series`: wins/points/matches, sent in `match_end`).
- `client/src/` — React (Vite). `App.jsx` is the single state machine keyed off socket events; screens (`screens/Home|Lobby|Game.jsx`) are presentational. The socket protocol event names live in the Interfaces block of `docs/superpowers/plans/2026-08-19-guess-their-answer.md`.

**Session storage split (deliberate):** `gt_name` lives in `localStorage` (shared default across tabs), but `gt_session` (room code + reconnect token) lives in `sessionStorage` — per-tab, so opening a room link in a second tab of the same browser doesn't steal the first tab's seat and destroy the room. Don't "simplify" this back to localStorage.

**Websocket-first transport (deliberate):** `client/src/socket.js` and `server/smoke.js` pass `transports: ['websocket', 'polling']` because Render's proxy breaks Socket.IO's default polling handshake (`xhr poll error`). Keep this on any new socket client.

## Question dataset

`server/questions.json` — 233 questions, each exactly 6 answers, integer points summing to exactly 100, non-increasing order, unique question texts. `server/questions.test.js` enforces all of this; run it after any dataset edit. Answer `aliases` arrays are optional extra synonyms — spelling variants are unnecessary (fuzzy matching covers them), but genuinely different words belong there.
