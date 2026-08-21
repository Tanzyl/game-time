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

test('normalize lowercases, strips punctuation, collapses whitespace, drops leading articles', () => {
  assert.equal(normalize('  Check   PHONE!! '), 'check phone');
  assert.equal(normalize('The Beach'), 'beach');
  assert.equal(normalize('a dog'), 'dog');
});

test('within1 allows one edit only', () => {
  assert.ok(within1('coffee', 'cofee'));   // deletion
  assert.ok(within1('coffee', 'coffey'));  // substitution
  assert.ok(!within1('coffee', 'tea'));
});

test('plural/singular and bigger typos are forgiven', () => {
  const m = createMatch(QS);
  startRound(m);
  assert.equal(submitGuess(m, 0, 'showers').result, 'claimed');      // plural of Shower
  assert.equal(submitGuess(m, 1, 'brsh teet').result, 'claimed');    // 2 edits, long phrase
  assert.equal(submitGuess(m, 0, 'the coffee').result, 'claimed');   // leading article
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

test('a key word of a multi-word answer claims it', () => {
  const m = createMatch(QS);
  startRound(m);
  assert.equal(submitGuess(m, 0, 'teeth').result, 'claimed');        // word of "Brush teeth"
  assert.equal(submitGuess(m, 0, 'get a coffee').result, 'claimed'); // extra words around "Coffee"
});

test('exact match beats fuzzy; ambiguous one-word guesses miss', () => {
  const m = createMatch([q('Qx', [
    { text: 'Basketball', aliases: [], points: 30 },
    { text: 'Baseball', aliases: [], points: 24 },
    { text: 'Ice skating', aliases: [], points: 18 },
    { text: 'Ice hockey', aliases: [], points: 12 },
    { text: 'Golf', aliases: [], points: 9 },
    { text: 'Tennis', aliases: [], points: 7 },
  ])]);
  startRound(m);
  assert.equal(submitGuess(m, 0, 'baseball').slot, 1);    // not the fuzzier Basketball in slot 0
  assert.equal(submitGuess(m, 0, 'ice').result, 'miss');  // fits two answers: be specific
  assert.equal(submitGuess(m, 0, 'skating').result, 'claimed');
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
