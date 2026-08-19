// Runnable end-to-end check: boots the server, plays a full 3-round match
// with two socket clients, asserts match_end arrives with numeric scores.
// Usage: node server/smoke.js
const assert = require('node:assert');
const { createServer } = require('./index');
const questions = require('./questions.json');
const Client = require('socket.io-client');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const { server } = createServer();
  await new Promise((r) => server.listen(0, r));
  const url = `http://localhost:${server.address().port}`;
  const c1 = Client(url);
  const c2 = Client(url);

  const created = await c1.emitWithAck('create_room');
  const joined = await c2.emitWithAck('join_room', { code: created.code });
  assert.equal(joined.ok, true);

  let rounds = 0;
  const onRoundStart = async (p) => {
    rounds++;
    console.log(`round ${p.round} (x${p.multiplier}): ${p.questionText}`);
    const q = questions.find((x) => x.text === p.questionText);
    assert.ok(q, 'question found in dataset');
    // each client claims half the board, paced under the 3/sec rate limit
    for (let i = 0; i < 6; i++) {
      (i < 3 ? c1 : c2).emit('guess', { text: q.answers[i].text });
      await sleep(400);
    }
  };
  c1.on('round_start', onRoundStart);

  const matchEnd = new Promise((resolve) => c1.on('match_end', resolve));
  c1.emit('ready');
  c2.emit('ready');

  const end = await Promise.race([
    matchEnd,
    sleep(120_000).then(() => { throw new Error('timed out waiting for match_end'); }),
  ]);

  assert.equal(rounds, 3, 'played 3 rounds');
  assert.ok(Number.isInteger(end.scores[0]) && Number.isInteger(end.scores[1]));
  assert.ok([0, 1, null].includes(end.winner));
  console.log('match_end:', JSON.stringify(end));
  console.log('SMOKE PASS');
  c1.close(); c2.close(); server.close();
  process.exit(0);
}

main().catch((e) => { console.error('SMOKE FAIL:', e); process.exit(1); });
