const test = require('node:test');
const assert = require('node:assert');
const questions = require('./questions.json');

test('150+ questions, 6 answers each, points sum 100 non-increasing, unique texts', () => {
  assert.ok(questions.length >= 150, `only ${questions.length} questions`);
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
