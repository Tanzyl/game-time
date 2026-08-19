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
