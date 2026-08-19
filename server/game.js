const ROUNDS = 3;

const normalize = (s) =>
  String(s).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim()
    .replace(/^(a|an|the|my|to) /, '');

// classic Levenshtein distance (strings here are short, full DP is fine)
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

const singular = (s) => (s.length > 3 && s.endsWith('s') ? s.slice(0, -1) : s);

// forgiving comparison: exact, singular/plural, then length-scaled typo distance
function fuzzyEq(c, g) {
  if (c === g || singular(c) === singular(g)) return true;
  const minLen = Math.min(c.length, g.length);
  const maxDist = minLen >= 7 ? 2 : minLen >= 4 ? 1 : 0;
  return maxDist > 0 && levenshtein(c, g) <= maxDist;
}

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
    const hit = cands.some((c) => fuzzyEq(c, g));
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
