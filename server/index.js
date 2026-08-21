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
  // open CORS so the itch.io-hosted client (html.itch.zone iframe) can connect;
  // safe here: server-authoritative game, no auth, room codes + rate limiting
  const io = new Server(server, { cors: { origin: true } });

  const dist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(dist));
  app.get('/room/:code', (_req, res) => res.sendFile(path.join(dist, 'index.html')));

  const rooms = new Map();
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const newCode = () => Array.from(crypto.randomBytes(6), (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');

  // Global no-repeat window: a question can't be dealt again (in any room,
  // match, or rematch) until nearly every other question has been played.
  const recent = []; // dealt question indices, oldest first
  const pickQuestions = () => {
    const inRecent = new Set(recent);
    const avail = questions.map((_, i) => i).filter((i) => !inRecent.has(i));
    const picked = [];
    for (let k = 0; k < game.ROUNDS; k++) {
      picked.push(avail.splice(Math.floor(Math.random() * avail.length), 1)[0]);
    }
    recent.push(...picked);
    recent.splice(0, Math.max(0, recent.length - (questions.length - game.ROUNDS)));
    return picked.map((i) => questions[i]);
  };

  const cleanName = (name, fallback) => {
    const n = String(name || '').trim().slice(0, 20);
    return n || fallback;
  };

  const roomState = (room) => ({
    state: room.state,
    players: room.players.map((p) => ({ name: p.name, connected: p.connected, ready: p.ready })),
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
    room.series.matches++;
    room.series.points[0] += a;
    room.series.points[1] += b;
    if (winner !== null) room.series.wins[winner]++;
    emitRoom(room, 'match_end', {
      scores: room.match.scores, winner, forfeit: forfeitWinner !== null,
      series: room.series,
      names: room.players.map((p) => p.name),
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

    socket.on('create_room', (payload, ack) => {
      if (typeof payload === 'function') { ack = payload; payload = {}; }
      if (typeof ack !== 'function') return;
      let code;
      do { code = newCode(); } while (rooms.has(code));
      const token = crypto.randomBytes(16).toString('hex');
      room = {
        code, state: 'lobby', match: null, timer: null, revealed: [],
        roundEndsAt: 0,
        series: { wins: [0, 0], points: [0, 0], matches: 0 },
        players: [{ token, socketId: socket.id, connected: true, ready: false, guessTimes: [], graceTimer: null, name: cleanName(payload && payload.name, 'Player 1') }],
      };
      rooms.set(code, room);
      playerIdx = 0;
      ack({ code, token, playerIdx: 0 });
      emitRoom(room, 'room_state', roomState(room));
    });

    socket.on('join_room', ({ code, token, name } = {}, ack) => {
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
          socket.emit('match_end', {
            scores: r.match.scores, winner: a === b ? null : a > b ? 0 : 1, forfeit: false,
            series: r.series, names: r.players.map((q) => q.name),
          });
        }
        return;
      }
      if (r.players.length >= 2) return ack({ ok: false, error: 'Room is full' });
      if (r.state !== 'lobby') return ack({ ok: false, error: 'Game already in progress' });
      const newToken = crypto.randomBytes(16).toString('hex');
      r.players.push({ token: newToken, socketId: socket.id, connected: true, ready: false, guessTimes: [], graceTimer: null, name: cleanName(name, 'Player 2') });
      room = r; playerIdx = 1;
      ack({ ok: true, code: r.code, token: newToken, playerIdx: 1 });
      emitRoom(r, 'room_state', roomState(r));
    });

    socket.on('ready', () => {
      if (!room || room.state !== 'lobby' || playerIdx === -1) return;
      room.players[playerIdx].ready = true;
      emitRoom(room, 'room_state', roomState(room));
      if (room.players.length === 2 && room.players.every((p) => p.ready)) {
        room.match = game.createMatch(pickQuestions());
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
      room.players[playerIdx].ready = true;
      emitRoom(room, 'room_state', roomState(room));
      if (room.players.length === 2 && room.players.every((p) => p.connected && p.ready)) {
        room.match = game.createMatch(pickQuestions());
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
      if (room.state === 'lobby') {
        if (playerIdx === 1) room.players.pop(); // guest left lobby; host keeps room
        emitRoom(room, 'room_state', roomState(room));
        return;
      }
      emitRoom(room, 'room_state', roomState(room));
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
  const os = require('os');
  const { server } = createServer();
  const port = process.env.PORT || 4560;
  server.listen(port, () => {
    console.log(`Game-Time listening on:`);
    console.log(`  Local:   http://localhost:${port}`);
    for (const ifaces of Object.values(os.networkInterfaces())) {
      for (const i of ifaces) {
        if (i.family === 'IPv4' && !i.internal) {
          console.log(`  Network: http://${i.address}:${port}  <- open this on other devices (same Wi-Fi)`);
        }
      }
    }
    // packaged .exe double-click: open the game in the default browser
    if (process.pkg && process.platform === 'win32' && !process.env.PORT) {
      require('child_process').exec(`start http://localhost:${port}`);
    }
  });
}
