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
