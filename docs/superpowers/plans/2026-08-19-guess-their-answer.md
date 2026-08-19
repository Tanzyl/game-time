# Guess Their Answer 1v1 Multiplayer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A browser-based 1v1 "Guess Their Answer" clone: private-room multiplayer, 3 rounds, shared first-to-claim answer board, server-authoritative.

**Architecture:** One Node.js process (Express + Socket.IO) holds all game state in memory; a pure game-engine module (`server/game.js`) contains all rules and is unit-tested without sockets. A Vite/React client (three screens: Home, Lobby, Game) renders only what the server broadcasts.

**Tech Stack:** Node.js, Express, Socket.IO, React (Vite), node:test for server tests.

**Spec:** `docs/superpowers/specs/2026-08-19-guess-their-answer-design.md`

## Global Constraints

- 150 questions, exactly 6 answers each, points sum to exactly 100 per question, non-increasing order.
- 3 rounds per match, multipliers x1/x2/x3, 30s server-side timer per round.
- Shared board, first-to-claim; answers never sent to clients before reveal.
- Typo tolerance: Levenshtein distance ≤ 1 when both normalized strings are ≥ 5 chars; exact match otherwise.
- Disconnect grace: 15s, then forfeit. Guess rate limit: 3/second/socket, max length 60.
- CommonJS on the server (no build step server-side). Client built by Vite into `client/dist`, served by Express with SPA fallback for `/room/:code`.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json` (root, server deps + scripts)
- Create: `client/` via `npm create vite@latest client -- --template react`
- Create: `.gitignore`
- Modify: `client/vite.config.js` (dev proxy for socket.io)

**Interfaces:**
- Produces: `npm run dev:server` (node server), `npm run build` (client build), `npm test` (node --test server/*.test.js). Directory layout `server/` + `client/`.

- [ ] **Step 1: Root package.json + .gitignore**

```json
{
  "name": "game-time",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "dev:server": "node server/index.js",
    "build": "cd client && npm run build",
    "test": "node --test server/"
  },
  "dependencies": {
    "express": "^4.19.0",
    "socket.io": "^4.7.0"
  },
  "devDependencies": {
    "socket.io-client": "^4.7.0"
  }
}
```

`.gitignore`: `node_modules/`, `client/dist/`.

- [ ] **Step 2: `npm install` at root; scaffold Vite React app in `client/`; `npm install` in client (add `socket.io-client` as client dependency).**

- [ ] **Step 3: Dev proxy in `client/vite.config.js`**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/socket.io': { target: 'http://localhost:3000', ws: true } }
  }
})
```

- [ ] **Step 4: Commit** `chore: scaffold server + vite react client`

---

### Task 2: Pure game engine with tests

**Files:**
- Create: `server/game.js`
- Test: `server/game.test.js`

**Interfaces:**
- Produces (all CommonJS exports from `server/game.js`):
  - `normalize(s: string): string`
  - `within1(a: string, b: string): boolean`
  - `createMatch(questions: Question[3]): Match` where `Match = { questions, round: number, scores: [number, number], board: { claimed: (0|1|null)[6] } | null }`
  - `startRound(match): { questionText, answerCount: 6, multiplier: 1|2|3 }`
  - `submitGuess(match, playerIdx: 0|1, text): { result: 'claimed', slot, text, points, boardComplete } | { result: 'taken', slot } | { result: 'miss' }`
  - `endRound(match): { unclaimed: {slot, text, points}[], matchOver: boolean }`
  - `ROUNDS = 3`

- [ ] **Step 1: Write failing tests in `server/game.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert');
const { normalize, within1, createMatch, startRound, submitGuess, endRound, ROUNDS } = require('./game');

const q = (text, answers) => ({ text, answers });
const QS = [
  q('Q1', [
    { text: 'Check phone', aliases: ['look at phone', 'phone'], points: 30 },
    { text: 'Brush teeth', aliases: ['brush'], points: 24 },
    { text: 'Coffee', aliases: ['drink coffee', 'make coffee'], points: 18 },
    { text: 'Shower', aliases: [], points: 12 },
    { text: 'Pee', aliases: ['toilet', 'bathroom'], points: 9 },
    { text: 'Stretch', aliases: [], points: 7 },
  ]),
  q('Q2', [
    { text: 'Dog', aliases: [], points: 30 }, { text: 'Cat', aliases: [], points: 24 },
    { text: 'Fish', aliases: [], points: 18 }, { text: 'Bird', aliases: [], points: 12 },
    { text: 'Hamster', aliases: [], points: 9 }, { text: 'Rabbit', aliases: ['bunny'], points: 7 },
  ]),
  q('Q3', [
    { text: 'Red', aliases: [], points: 30 }, { text: 'Blue', aliases: [], points: 24 },
    { text: 'Green', aliases: [], points: 18 }, { text: 'Black', aliases: [], points: 12 },
    { text: 'White', aliases: [], points: 9 }, { text: 'Purple', aliases: [], points: 7 },
  ]),
];

test('normalize lowercases, strips punctuation, collapses whitespace', () => {
  assert.equal(normalize('  Check   PHONE!! '), 'check phone');
});

test('within1 allows one edit only', () => {
  assert.ok(within1('coffee', 'cofee'));   // deletion
  assert.ok(within1('coffee', 'coffey'));  // substitution
  assert.ok(!within1('coffee', 'tea'));
});

test('exact match claims answer and scores points x multiplier', () => {
  const m = createMatch(QS);
  startRound(m);
  const r = submitGuess(m, 0, 'check phone');
  assert.equal(r.result, 'claimed');
  assert.equal(r.slot, 0);
  assert.equal(r.points, 30); // round 1, x1
  assert.deepEqual(m.scores, [30, 0]);
});

test('alias and typo matching', () => {
  const m = createMatch(QS);
  startRound(m);
  assert.equal(submitGuess(m, 1, 'look at phone').result, 'claimed'); // alias
  assert.equal(submitGuess(m, 0, 'coffe').result, 'claimed');         // typo, len>=5
  assert.equal(submitGuess(m, 0, 'peee').result, 'miss');             // short word: no fuzz ('pee' is 3 chars)
  assert.equal(submitGuess(m, 0, 'pee').result, 'claimed');
});

test('claimed answers cannot be re-claimed', () => {
  const m = createMatch(QS);
  startRound(m);
  submitGuess(m, 0, 'shower');
  const r = submitGuess(m, 1, 'shower');
  assert.equal(r.result, 'taken');
  assert.deepEqual(m.scores, [12, 0]);
});

test('boardComplete true when all six claimed', () => {
  const m = createMatch(QS);
  startRound(m);
  const answers = ['check phone', 'brush teeth', 'coffee', 'shower', 'pee', 'stretch'];
  let last;
  for (const a of answers) last = submitGuess(m, 0, a);
  assert.equal(last.boardComplete, true);
});

test('multipliers escalate x1 x2 x3 and endRound reports unclaimed + matchOver', () => {
  const m = createMatch(QS);
  startRound(m);
  submitGuess(m, 0, 'check phone'); // 30
  let e = endRound(m);
  assert.equal(e.unclaimed.length, 5);
  assert.equal(e.matchOver, false);
  startRound(m);
  submitGuess(m, 0, 'dog'); // 30 x2 = 60
  endRound(m);
  startRound(m);
  submitGuess(m, 1, 'red'); // 30 x3 = 90
  e = endRound(m);
  assert.equal(e.matchOver, true);
  assert.deepEqual(m.scores, [90, 90]);
  assert.equal(ROUNDS, 3);
});
```

- [ ] **Step 2: Run `node --test server/` — expect FAIL (module not found).**

- [ ] **Step 3: Implement `server/game.js`**

```js
const ROUNDS = 3;

const normalize = (s) =>
  String(s).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();

// true iff Levenshtein distance <= 1
function within1(a, b) {
  if (a === b) return true;
  const [s, t] = a.length <= b.length ? [a, b] : [b, a];
  if (t.length - s.length > 1) return false;
  if (s.length === t.length) {
    let diff = 0;
    for (let i = 0; i < s.length; i++) if (s[i] !== t[i] && ++diff > 1) return false;
    return true;
  }
  let i = 0, j = 0, skipped = false;
  while (i < s.length) {
    if (s[i] === t[j]) { i++; j++; }
    else if (skipped) return false;
    else { skipped = true; j++; }
  }
  return true;
}

function createMatch(questions) {
  return { questions, round: 0, scores: [0, 0], board: null };
}

function startRound(match) {
  match.board = { claimed: Array(6).fill(null) };
  return {
    questionText: match.questions[match.round].text,
    answerCount: 6,
    multiplier: match.round + 1,
  };
}

function submitGuess(match, playerIdx, text) {
  const g = normalize(text);
  if (!g || !match.board) return { result: 'miss' };
  const q = match.questions[match.round];
  for (let slot = 0; slot < q.answers.length; slot++) {
    const a = q.answers[slot];
    const cands = [a.text, ...(a.aliases || [])].map(normalize);
    const hit = cands.some(
      (c) => c === g || (c.length >= 5 && g.length >= 5 && within1(c, g))
    );
    if (!hit) continue;
    if (match.board.claimed[slot] !== null) return { result: 'taken', slot };
    match.board.claimed[slot] = playerIdx;
    const points = a.points * (match.round + 1);
    match.scores[playerIdx] += points;
    return {
      result: 'claimed', slot, text: a.text, points,
      boardComplete: match.board.claimed.every((c) => c !== null),
    };
  }
  return { result: 'miss' };
}

function endRound(match) {
  const q = match.questions[match.round];
  const unclaimed = q.answers
    .map((a, slot) => (match.board.claimed[slot] === null ? { slot, text: a.text, points: a.points } : null))
    .filter(Boolean);
  match.round++;
  match.board = null;
  return { unclaimed, matchOver: match.round >= ROUNDS };
}

module.exports = { ROUNDS, normalize, within1, createMatch, startRound, submitGuess, endRound };
```

- [ ] **Step 4: Run `node --test server/` — expect all PASS.**

- [ ] **Step 5: Commit** `feat: pure game engine with matching, scoring, rounds`

---

### Task 3: Question dataset (150 × 6) + schema test

**Files:**
- Create: `server/questions.json`
- Test: `server/questions.test.js`

**Interfaces:**
- Produces: `server/questions.json` — array of `{ text: string, answers: [{ text, aliases: string[], points: number }] }`, consumed by Task 4 via `require('./questions.json')`.

- [ ] **Step 1: Write failing schema test `server/questions.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert');
const questions = require('./questions.json');

test('150 questions, 6 answers each, points sum 100 non-increasing, unique texts', () => {
  assert.equal(questions.length, 150);
  const seen = new Set();
  for (const q of questions) {
    assert.ok(typeof q.text === 'string' && q.text.length > 8, q.text);
    assert.ok(!seen.has(q.text.toLowerCase()), `duplicate: ${q.text}`);
    seen.add(q.text.toLowerCase());
    assert.equal(q.answers.length, 6, q.text);
    let sum = 0, prev = Infinity;
    const answerTexts = new Set();
    for (const a of q.answers) {
      assert.ok(typeof a.text === 'string' && a.text.length > 0);
      assert.ok(Array.isArray(a.aliases));
      assert.ok(Number.isInteger(a.points) && a.points >= 1);
      assert.ok(a.points <= prev, `not sorted in ${q.text}`);
      assert.ok(!answerTexts.has(a.text.toLowerCase()), `dup answer in ${q.text}`);
      answerTexts.add(a.text.toLowerCase());
      prev = a.points;
      sum += a.points;
    }
    assert.equal(sum, 100, `points sum ${sum} in ${q.text}`);
  }
});
```

- [ ] **Step 2: Run test — expect FAIL (file missing).**

- [ ] **Step 3: Author `server/questions.json`.** 150 survey-style questions across everyday-life categories (morning routines, food, travel, school, work, pets, sports, movies, phones, weather, holidays, chores, money, health, kids' answers, etc.). Use these point templates (all sum to 100, non-increasing): `[30,24,18,12,9,7]`, `[28,22,17,13,11,9]`, `[34,25,15,11,8,7]`, `[26,21,18,14,11,10]`, `[38,24,14,10,8,6]`. 1–3 aliases per answer where natural synonyms exist. Example entry:

```json
{
  "text": "Name something people do first thing in the morning",
  "answers": [
    { "text": "Check phone", "aliases": ["look at phone", "phone"], "points": 30 },
    { "text": "Brush teeth", "aliases": ["brush their teeth"], "points": 24 },
    { "text": "Drink coffee", "aliases": ["coffee", "make coffee"], "points": 18 },
    { "text": "Shower", "aliases": ["take a shower"], "points": 12 },
    { "text": "Use the bathroom", "aliases": ["pee", "toilet"], "points": 9 },
    { "text": "Stretch", "aliases": ["stretching"], "points": 7 }
  ]
}
```

- [ ] **Step 4: Run test — expect PASS.**

- [ ] **Step 5: Commit** `feat: 150-question dataset with schema test`

---

### Task 4: Socket.IO room server

**Files:**
- Create: `server/index.js`
- Test: `server/rooms.test.js` (integration via socket.io-client)

**Interfaces:**
- Consumes: Task 2 engine exports; Task 3 `questions.json`.
- Produces the socket protocol used by Task 5:
  - C→S: `create_room` (ack `{code, token, playerIdx}`), `join_room {code, token?}` (ack `{ok, code?, token?, playerIdx?, error?}`), `ready`, `guess {text}`, `rematch`.
  - S→C: `room_state {players: [{connected, ready}], state}`, `round_start {round, questionText, answerCount, multiplier, endsAt, scores, revealed}`, `answer_revealed {slot, text, points, byPlayer, scores}`, `guess_feedback {result, slot?}` (guesser only), `round_end {unclaimed, scores}`, `match_end {scores, winner, forfeit?}` (`winner`: 0|1|null for draw), `opponent_disconnected`, `opponent_reconnected`.

- [ ] **Step 1: Write failing integration test `server/rooms.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert');
const { once } = require('node:events');
const { createServer } = require('./index');
const Client = require('socket.io-client');

test('two players create/join/ready and receive round_start', async () => {
  const { server } = createServer();
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const url = `http://localhost:${port}`;
  const c1 = Client(url);
  const c2 = Client(url);
  try {
    const created = await c1.emitWithAck('create_room');
    assert.match(created.code, /^[A-Z2-9]{6}$/);
    assert.equal(created.playerIdx, 0);
    const joined = await c2.emitWithAck('join_room', { code: created.code });
    assert.equal(joined.ok, true);
    assert.equal(joined.playerIdx, 1);
    const rs1 = once(c1, 'round_start');
    const rs2 = once(c2, 'round_start');
    c1.emit('ready');
    c2.emit('ready');
    const [[e1]] = await Promise.all([rs1, rs2]);
    assert.equal(e1.round, 1);
    assert.equal(e1.answerCount, 6);
    assert.equal(e1.multiplier, 1);
    assert.ok(e1.endsAt > Date.now());
    assert.ok(!('answers' in e1)); // answers never sent pre-reveal
  } finally {
    c1.close(); c2.close(); server.close();
  }
});

test('joining a nonexistent room errors', async () => {
  const { server } = createServer();
  await new Promise((r) => server.listen(0, r));
  const c = Client(`http://localhost:${server.address().port}`);
  try {
    const res = await c.emitWithAck('join_room', { code: 'NOPE22' });
    assert.equal(res.ok, false);
    assert.ok(res.error);
  } finally {
    c.close(); server.close();
  }
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement `server/index.js`**

```js
const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { Server } = require('socket.io');
const questions = require('./questions.json');
const game = require('./game');

const ROUND_MS = 30_000;
const INTERMISSION_MS = 4_000;
const GRACE_MS = 15_000;

function createServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);

  const dist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(dist));
  app.get('/room/:code', (_req, res) => res.sendFile(path.join(dist, 'index.html')));

  const rooms = new Map();
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const newCode = () => Array.from(crypto.randomBytes(6), (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');

  const pickQuestions = (used) => {
    const avail = questions.map((_, i) => i).filter((i) => !used.has(i));
    const picked = [];
    for (let k = 0; k < game.ROUNDS; k++) {
      const idx = avail.splice(Math.floor(Math.random() * avail.length), 1)[0];
      used.add(idx);
      picked.push(questions[idx]);
    }
    return picked;
  };

  const roomState = (room) => ({
    state: room.state,
    players: room.players.map((p) => ({ connected: p.connected, ready: p.ready })),
  });

  const emitRoom = (room, ev, data) => {
    for (const p of room.players) if (p.socketId) io.to(p.socketId).emit(ev, data);
  };

  function startRoundFlow(room) {
    room.state = 'playing';
    room.revealed = [];
    const info = game.startRound(room.match);
    room.roundEndsAt = Date.now() + ROUND_MS;
    emitRoom(room, 'round_start', {
      round: room.match.round + 1,
      ...info,
      endsAt: room.roundEndsAt,
      scores: room.match.scores,
      revealed: [],
    });
    room.timer = setTimeout(() => finishRound(room), ROUND_MS);
  }

  function finishRound(room) {
    clearTimeout(room.timer);
    room.state = 'round_end';
    const { unclaimed, matchOver } = game.endRound(room.match);
    emitRoom(room, 'round_end', { unclaimed, scores: room.match.scores });
    room.timer = setTimeout(() => {
      if (matchOver) endMatch(room, null);
      else startRoundFlow(room);
    }, INTERMISSION_MS);
  }

  function endMatch(room, forfeitWinner) {
    clearTimeout(room.timer);
    room.state = 'over';
    const [a, b] = room.match.scores;
    const winner = forfeitWinner !== null ? forfeitWinner : a === b ? null : a > b ? 0 : 1;
    room.players.forEach((p) => (p.ready = false));
    emitRoom(room, 'match_end', {
      scores: room.match.scores, winner, forfeit: forfeitWinner !== null,
    });
  }

  function destroyRoom(room) {
    clearTimeout(room.timer);
    room.players.forEach((p) => clearTimeout(p.graceTimer));
    rooms.delete(room.code);
  }

  io.on('connection', (socket) => {
    let room = null;
    let playerIdx = -1;

    socket.on('create_room', (ack) => {
      if (typeof ack !== 'function') return;
      let code;
      do { code = newCode(); } while (rooms.has(code));
      const token = crypto.randomBytes(16).toString('hex');
      room = {
        code, state: 'lobby', match: null, timer: null, revealed: [],
        used: new Set(), roundEndsAt: 0,
        players: [{ token, socketId: socket.id, connected: true, ready: false, guessTimes: [], graceTimer: null }],
      };
      rooms.set(code, room);
      playerIdx = 0;
      ack({ code, token, playerIdx: 0 });
      emitRoom(room, 'room_state', roomState(room));
    });

    socket.on('join_room', ({ code, token } = {}, ack) => {
      if (typeof ack !== 'function') return;
      const r = rooms.get(String(code || '').toUpperCase());
      if (!r) return ack({ ok: false, error: 'Room not found' });
      // reconnect path
      const existingIdx = r.players.findIndex((p) => token && p.token === token);
      if (existingIdx !== -1) {
        room = r; playerIdx = existingIdx;
        const p = r.players[playerIdx];
        clearTimeout(p.graceTimer);
        p.socketId = socket.id;
        p.connected = true;
        ack({ ok: true, code: r.code, token: p.token, playerIdx });
        emitRoom(r, 'room_state', roomState(r));
        const other = r.players[1 - playerIdx];
        if (other && other.socketId) io.to(other.socketId).emit('opponent_reconnected');
        if (r.state === 'playing') {
          socket.emit('round_start', {
            round: r.match.round + 1,
            questionText: r.match.questions[r.match.round].text,
            answerCount: 6, multiplier: r.match.round + 1,
            endsAt: r.roundEndsAt, scores: r.match.scores, revealed: r.revealed,
          });
        } else if (r.state === 'over') {
          const [a, b] = r.match.scores;
          socket.emit('match_end', { scores: r.match.scores, winner: a === b ? null : a > b ? 0 : 1, forfeit: false });
        }
        return;
      }
      if (r.players.length >= 2) return ack({ ok: false, error: 'Room is full' });
      if (r.state !== 'lobby') return ack({ ok: false, error: 'Game already in progress' });
      const newToken = crypto.randomBytes(16).toString('hex');
      r.players.push({ token: newToken, socketId: socket.id, connected: true, ready: false, guessTimes: [], graceTimer: null });
      room = r; playerIdx = 1;
      ack({ ok: true, code: r.code, token: newToken, playerIdx: 1 });
      emitRoom(r, 'room_state', roomState(r));
    });

    socket.on('ready', () => {
      if (!room || room.state !== 'lobby' || playerIdx === -1) return;
      room.players[playerIdx].ready = true;
      emitRoom(room, 'room_state', roomState(room));
      if (room.players.length === 2 && room.players.every((p) => p.ready)) {
        room.match = game.createMatch(pickQuestions(room.used));
        startRoundFlow(room);
      }
    });

    socket.on('guess', ({ text } = {}) => {
      if (!room || room.state !== 'playing' || playerIdx === -1) return;
      if (typeof text !== 'string' || text.length === 0 || text.length > 60) return;
      const p = room.players[playerIdx];
      const now = Date.now();
      p.guessTimes = p.guessTimes.filter((t) => now - t < 1000);
      if (p.guessTimes.length >= 3) return;
      p.guessTimes.push(now);
      const res = game.submitGuess(room.match, playerIdx, text);
      if (res.result === 'claimed') {
        const reveal = { slot: res.slot, text: res.text, points: res.points, byPlayer: playerIdx };
        room.revealed.push(reveal);
        emitRoom(room, 'answer_revealed', { ...reveal, scores: room.match.scores });
        if (res.boardComplete) finishRound(room);
      } else {
        socket.emit('guess_feedback', { result: res.result, slot: res.slot });
      }
    });

    socket.on('rematch', () => {
      if (!room || room.state !== 'over' || playerIdx === -1) return;
      if (questions.length - room.used.size < game.ROUNDS) room.used.clear();
      room.players[playerIdx].ready = true;
      emitRoom(room, 'room_state', roomState(room));
      if (room.players.length === 2 && room.players.every((p) => p.connected && p.ready)) {
        room.match = game.createMatch(pickQuestions(room.used));
        startRoundFlow(room);
      }
    });

    socket.on('disconnect', () => {
      if (!room || playerIdx === -1) return;
      const p = room.players[playerIdx];
      if (p.socketId !== socket.id) return; // stale socket after reconnect
      p.connected = false;
      p.socketId = null;
      const anyConnected = room.players.some((q) => q.connected);
      if (!anyConnected) return destroyRoom(room);
      emitRoom(room, 'room_state', roomState(room));
      if (room.state === 'lobby') {
        if (playerIdx === 1) room.players.pop(); // guest left lobby; host keeps room
        emitRoom(room, 'room_state', roomState(room));
        return;
      }
      if (room.state === 'over') return;
      emitRoom(room, 'opponent_disconnected', {});
      p.graceTimer = setTimeout(() => {
        if (!p.connected && room.state !== 'over') endMatch(room, 1 - playerIdx);
      }, GRACE_MS);
    });
  });

  return { app, server, io, rooms };
}

module.exports = { createServer };

if (require.main === module) {
  const { server } = createServer();
  const port = process.env.PORT || 3000;
  server.listen(port, () => console.log(`Game-Time listening on http://localhost:${port}`));
}
```

- [ ] **Step 4: Run `node --test server/` — expect all PASS (engine, questions, rooms).**

- [ ] **Step 5: Commit** `feat: socket.io room server with rounds, reconnect, forfeit`

---

### Task 5: React client

**Files:**
- Create: `client/src/socket.js`, `client/src/App.jsx` (replace scaffold), `client/src/screens/Home.jsx`, `client/src/screens/Lobby.jsx`, `client/src/screens/Game.jsx`, `client/src/index.css` (replace scaffold)
- Delete: scaffold cruft (`client/src/App.css`, logo assets)

**Interfaces:**
- Consumes: full socket protocol from Task 4.
- Produces: SPA where `App.jsx` owns one `session` state object and screen switching; screens are presentational + emit events.

- [ ] **Step 1: `client/src/socket.js`**

```js
import { io } from 'socket.io-client';
export const socket = io({ autoConnect: true });
```

- [ ] **Step 2: `client/src/App.jsx`** — state machine keyed off server events.

```jsx
import { useEffect, useState, useCallback } from 'react';
import { socket } from './socket';
import Home from './screens/Home';
import Lobby from './screens/Lobby';
import Game from './screens/Game';

const stored = () => { try { return JSON.parse(localStorage.getItem('gt_session')) || null; } catch { return null; } };

export default function App() {
  const [screen, setScreen] = useState('home'); // home | lobby | game
  const [session, setSession] = useState(null); // {code, token, playerIdx}
  const [roomInfo, setRoomInfo] = useState(null); // room_state payload
  const [gameState, setGameState] = useState(null); // accumulated round/game payload
  const [error, setError] = useState('');

  const join = useCallback((code, token) => {
    socket.emit('join_room', { code, token }, (res) => {
      if (!res.ok) { setError(res.error); localStorage.removeItem('gt_session'); return; }
      const s = { code: res.code, token: res.token, playerIdx: res.playerIdx };
      localStorage.setItem('gt_session', JSON.stringify(s));
      setSession(s); setScreen('lobby'); setError('');
    });
  }, []);

  const create = useCallback(() => {
    socket.emit('create_room', (res) => {
      const s = { code: res.code, token: res.token, playerIdx: res.playerIdx };
      localStorage.setItem('gt_session', JSON.stringify(s));
      setSession(s); setScreen('lobby');
    });
  }, []);

  useEffect(() => {
    const onRoomState = (rs) => setRoomInfo(rs);
    const onRoundStart = (p) => { setScreen('game'); setGameState({ phase: 'playing', ...p, revealed: p.revealed || [], feedback: null, roundEnd: null, matchEnd: null }); };
    const onRevealed = (p) => setGameState((g) => g && { ...g, scores: p.scores, revealed: [...g.revealed, p] });
    const onFeedback = (p) => setGameState((g) => g && { ...g, feedback: { ...p, at: Date.now() } });
    const onRoundEnd = (p) => setGameState((g) => g && { ...g, phase: 'round_end', scores: p.scores, roundEnd: p });
    const onMatchEnd = (p) => setGameState((g) => ({ ...(g || {}), phase: 'match_end', scores: p.scores, matchEnd: p }));
    const onOppDisc = () => setGameState((g) => g && { ...g, oppDisconnected: true });
    const onOppRecon = () => setGameState((g) => g && { ...g, oppDisconnected: false });
    socket.on('room_state', onRoomState);
    socket.on('round_start', onRoundStart);
    socket.on('answer_revealed', onRevealed);
    socket.on('guess_feedback', onFeedback);
    socket.on('round_end', onRoundEnd);
    socket.on('match_end', onMatchEnd);
    socket.on('opponent_disconnected', onOppDisc);
    socket.on('opponent_reconnected', onOppRecon);
    return () => {
      socket.off('room_state', onRoomState); socket.off('round_start', onRoundStart);
      socket.off('answer_revealed', onRevealed); socket.off('guess_feedback', onFeedback);
      socket.off('round_end', onRoundEnd); socket.off('match_end', onMatchEnd);
      socket.off('opponent_disconnected', onOppDisc); socket.off('opponent_reconnected', onOppRecon);
    };
  }, []);

  // Auto-join: /room/CODE in URL, or stored session (reconnect)
  useEffect(() => {
    const m = window.location.pathname.match(/^\/room\/([A-Za-z2-9]{6})$/);
    const s = stored();
    if (m) join(m[1].toUpperCase(), s && s.code === m[1].toUpperCase() ? s.token : undefined);
    else if (s) join(s.code, s.token);
  }, [join]);

  const leave = () => { localStorage.removeItem('gt_session'); window.location.href = '/'; };

  if (screen === 'game' && gameState) {
    return <Game session={session} game={gameState} onGuess={(text) => socket.emit('guess', { text })}
      onRematch={() => socket.emit('rematch')} onLeave={leave} roomInfo={roomInfo} />;
  }
  if (screen === 'lobby' && session) {
    return <Lobby session={session} roomInfo={roomInfo} onReady={() => socket.emit('ready')} onLeave={leave} />;
  }
  return <Home onCreate={create} onJoin={(code) => join(code)} error={error} />;
}
```

- [ ] **Step 3: `client/src/screens/Home.jsx`**

```jsx
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
```

- [ ] **Step 4: `client/src/screens/Lobby.jsx`**

```jsx
export default function Lobby({ session, roomInfo, onReady, onLeave }) {
  const url = `${window.location.origin}/room/${session.code}`;
  const me = roomInfo?.players?.[session.playerIdx];
  const bothHere = (roomInfo?.players?.length || 0) === 2;
  return (
    <div className="screen lobby">
      <h2>Room {session.code}</h2>
      <p>Share this link with your opponent:</p>
      <div className="share-row">
        <code>{url}</code>
        <button onClick={() => navigator.clipboard.writeText(url)}>Copy</button>
      </div>
      <ul className="players">
        {(roomInfo?.players || []).map((p, i) => (
          <li key={i} className={`p${i}`}>
            Player {i + 1}{i === session.playerIdx ? ' (you)' : ''} — {p.ready ? 'Ready' : p.connected ? 'Waiting' : 'Disconnected'}
          </li>
        ))}
        {!bothHere && <li className="empty">Waiting for opponent…</li>}
      </ul>
      <button className="primary" disabled={!bothHere || me?.ready} onClick={onReady}>
        {me?.ready ? 'Waiting for opponent…' : 'Ready'}
      </button>
      <button className="link" onClick={onLeave}>Leave</button>
    </div>
  );
}
```

- [ ] **Step 5: `client/src/screens/Game.jsx`** — board, timer, input, scores, round/match end.

```jsx
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
```

- [ ] **Step 6: `client/src/index.css`** — replace scaffold with a compact dark theme: centered `.screen` column (max-width 480px), player colors `.p0 { color:#4fc3f7 }` `.p1 { color:#ffb74d }`, board slots as rows with reveal styling (`.revealed` filled, `.missed` grey, `.hidden` dashed), red pulsing `.timer.low`, simple button styles. Also update `client/src/main.jsx` to drop scaffold imports and `client/index.html` title to "Guess Their Answer".

- [ ] **Step 7: Build check.** Run `npm run build` in `client/` — expect success. Fix any import errors.

- [ ] **Step 8: Commit** `feat: react client (home, lobby, game screens)`

---

### Task 6: End-to-end verification

**Files:**
- Modify: none expected (fixes only if smoke test finds bugs)
- Create: `README.md`

**Interfaces:** none — verification and docs.

- [ ] **Step 1: Full test suite.** `node --test server/` — all pass.

- [ ] **Step 2: Serve check.** `npm run build`, start `node server/index.js`, verify `GET /` returns the app HTML and `GET /room/ABC123` returns the same HTML (SPA fallback), then a scripted two-client smoke: run a small Node script using `socket.io-client` that plays a full match (create, join, ready, both guess, receive `match_end`) against the running server. Script asserts final `match_end` arrives with numeric scores. Delete the script afterwards or keep as `server/smoke.js` (keep — it's the runnable check for the socket flow).

- [ ] **Step 3: `README.md`** — how to install, run dev (two terminals: `npm run dev:server` + `cd client && npm run dev`), run prod (`npm run build && node server/index.js`), run tests, and how to play.

- [ ] **Step 4: Final commit** `feat: e2e smoke script + readme`

---

## Self-Review Notes

- Spec coverage: rooms/link (T4/T5), rules+matching (T2), 150×6 dataset (T3), reconnect/forfeit/rate-limit (T4), screens (T5), SPA fallback + tests (T4/T6). Rematch covered in T4/T5. No gaps found.
- Types consistent: protocol names in T4 Step 3 match T5 handlers; engine signatures in T2 match T4 usage.
