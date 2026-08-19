# Guess Their Answer — 1v1 Multiplayer Clone — Design Spec

**Date:** 2026-08-19
**Status:** Approved scope, pending spec review

## Summary

A browser-based, two-player clone of "Guess Their Answer" (Family Feud–style
survey game). One player creates a private room and shares a link/code; a
friend joins; they compete head-to-head over 3 rounds to guess the most
popular answers to survey questions. No AI opponent, no matchmaking, no
accounts (all explicitly out of scope for v1).

## Tech Stack

- **Server:** Node.js, Express, Socket.IO. Single process.
- **Client:** React (Vite build), served as static files by the same Express
  server. Socket.IO client for realtime.
- **State:** In-memory only. A `Map<roomCode, Room>`. No database.
- **Content:** `questions.json` bundled with the server.

## Architecture

Server-authoritative. The server holds all game state: current question,
hidden answers, claimed answers, scores, and the round timer. Clients send
only typed guesses and render state broadcast by the server. Answers never
reach the browser before they are revealed (prevents trivial cheating and
desync).

The game rules live in a pure module (`server/game.js` — matching, scoring,
round progression) with no Socket.IO imports, so it is unit-testable. Socket
wiring (`server/index.js`) translates socket events to game-engine calls and
broadcasts resulting state.

### Client screens

1. **Home** — "Create room" button; "Join room" input for a code.
2. **Lobby** — shows room code and shareable URL (`/room/ABC123`), waits for
   opponent, both players ready-up, game starts.
3. **Game** — question text, answer board (6 slots), text input, both scores,
   countdown timer, round indicator. End of match: winner screen with a
   rematch button.

## Game Rules

- **Match:** 3 rounds, one question per round. Round score multipliers:
  x1, x2, x3.
- **Timer:** 30 seconds per question, run server-side only. Clients render a
  countdown from the server's broadcast end-timestamp.
- **Board:** Shared, first-to-claim. Both players guess against the same six
  hidden answers. When a player's guess matches an unclaimed answer, it is
  revealed to both players in that player's color and the finder scores
  `answer.points × round multiplier`. An answer can be claimed once.
- **Round end:** timer reaches 0 or all six answers claimed. Unclaimed
  answers are revealed grey. Short intermission, then next round.
- **Match end:** after round 3, highest total wins (ties are declared a
  draw). Rematch button restarts with fresh questions in the same room.

### Guess matching

- Normalize: lowercase, trim, collapse whitespace, strip punctuation.
- Match against each answer's canonical text and its `aliases` list.
- Typo tolerance: Levenshtein distance ≤ 1 for words of 5+ characters
  (exact match required for shorter words).
- A guess that matches an already-claimed answer or nothing gets brief
  "already taken" / "nope" feedback to the guesser only.

## Content

`questions.json`: **150 questions, exactly 6 answers each.** Schema:

```json
{
  "text": "Name something people do first thing in the morning",
  "answers": [
    { "text": "Check phone", "aliases": ["look at phone", "phone"], "points": 32 },
    ...
  ]
}
```

- Points per question sum to ~100, descending by popularity.
- Each match samples 3 questions without replacement from the pool;
  a rematch in the same room excludes questions already used in that room.

## Socket Protocol (summary)

Client → server: `create_room`, `join_room {code}`, `ready`,
`guess {text}`, `rematch`.

Server → client: `room_state` (lobby membership/ready flags),
`round_start {questionText, answerCount, multiplier, endsAt}`,
`answer_revealed {slot, text, points, byPlayer}`,
`guess_feedback {result}` (to guesser only),
`round_end {unclaimed[]}`, `match_end {scores, winner}`,
`opponent_disconnected`, `opponent_reconnected`, `error {message}`.

## Edge Cases

- **Disconnect mid-game:** 15-second grace period. The client stores the
  room code and a reconnect token in `localStorage`; on reconnect it resumes
  seamlessly. If the grace period lapses, the remaining player wins by
  forfeit.
- **Dead/full rooms:** joining a nonexistent, full, or finished room returns
  a clear error and routes back to Home. Rooms are garbage-collected after
  the match ends or both players leave.
- **Input validation:** guesses capped in length, rate-limited per socket
  (e.g. max ~3/second) — trust-boundary validation, not skipped.
- **Timer authority:** only the server ends a round; a client whose local
  countdown drifts still waits for `round_end`.

## Testing

- Unit tests for the pure game engine: normalization/alias/typo matching,
  claim-once semantics, scoring with multipliers, round/match progression,
  forfeit logic. (Vitest or node:test — whichever the scaffold makes free.)
- A schema check over `questions.json`: 150 questions, 6 answers each,
  unique texts, points sane.
- Manual two-browser-tab playtest for the realtime flow.

## Out of Scope (v1)

AI/bot opponent, random matchmaking, accounts/persistence, leaderboards,
skins/cosmetics, mobile apps, spectators, more than 2 players.
