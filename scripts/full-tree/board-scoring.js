/**
 * Board nearest-neighbor scoring — keep in sync with cfr/board-map.js.
 */
const RANK_VAL = { A: 14, K: 13, Q: 12, J: 11, T: 10, 9: 9, 8: 8, 7: 7, 6: 6, 5: 5, 4: 4, 3: 3, 2: 2 };

const FLOP_KEYS = [
  "Ah72r", "Kh95r", "Qh86tw", "JhT9ss", "T95mono", "paired88K", "low765", "Aq5ss", "KJTss", "Q72r", "J84r", "A96r",
];
const TURN_KEYS = [
  "Ah72_4", "Kh95_T", "Qh86_9", "JhT9_J", "T95m_8", "pr88K_A", "low765_4", "Aq5s_K",
];
const RIVER_KEYS = [
  "Ah72_4_9", "Kh95_T_2", "Qh86_9_3", "JhT9_J_8", "T95m_8_2", "pr88K_A_5",
];

const FLOP_RANKS = {
  Ah72r: ["A", "7", "2"],
  Kh95r: ["K", "9", "5"],
  Qh86tw: ["Q", "8", "6"],
  JhT9ss: ["J", "T", "9"],
  T95mono: ["T", "9", "5"],
  paired88K: ["8", "8", "K"],
  low765: ["7", "6", "5"],
  Aq5ss: ["A", "Q", "5"],
  KJTss: ["K", "J", "T"],
  Q72r: ["Q", "7", "2"],
  J84r: ["J", "8", "4"],
  A96r: ["A", "9", "6"],
};

const TURN_RANKS = {
  Ah72_4: ["A", "7", "2", "4"],
  Kh95_T: ["K", "9", "5", "T"],
  Qh86_9: ["Q", "8", "6", "9"],
  JhT9_J: ["J", "T", "9", "J"],
  T95m_8: ["T", "9", "5", "8"],
  pr88K_A: ["8", "8", "K", "A"],
  low765_4: ["7", "6", "5", "4"],
  Aq5s_K: ["A", "Q", "5", "K"],
};

const RIVER_RANKS = {
  Ah72_4_9: ["A", "7", "2", "4", "9"],
  Kh95_T_2: ["K", "9", "5", "T", "2"],
  Qh86_9_3: ["Q", "8", "6", "9", "3"],
  JhT9_J_8: ["J", "T", "9", "J", "8"],
  T95m_8_2: ["T", "9", "5", "8", "2"],
  pr88K_A_5: ["8", "8", "K", "A", "5"],
};

function rankCounts(ranks) {
  const counts = new Map();
  ranks.forEach((r) => counts.set(r, (counts.get(r) || 0) + 1));
  return counts;
}

function isPaired(ranks) {
  return [...rankCounts(ranks).values()].some((n) => n >= 2);
}

function isMonotone(community) {
  const suits = community.reduce((a, c) => { a[c.suit || c[1]] = (a[c.suit || c[1]] || 0) + 1; return a; }, {});
  return Math.max(...Object.values(suits), 0) >= 3;
}

function isTwoTone(community) {
  const suits = community.reduce((a, c) => { a[c.suit || c[1]] = (a[c.suit || c[1]] || 0) + 1; return a; }, {});
  return Math.max(...Object.values(suits), 0) === 2;
}

function hasBroadway(ranks) {
  return ranks.some((r) => ["A", "K", "Q", "J"].includes(r));
}

function hasHighCard(ranks) {
  return ranks.some((r) => ["A", "K", "Q"].includes(r));
}

function connectivity(ranks) {
  const vals = [...new Set(ranks.map((r) => RANK_VAL[r] || 0))].sort((a, b) => a - b);
  let score = 0;
  for (let i = 1; i < vals.length; i += 1) {
    if (vals[i] - vals[i - 1] <= 2) score += 1;
  }
  return score;
}

function normalizeCommunity(community) {
  return community.map((c) => (typeof c === "string" ? { rank: c[0], suit: c[1] } : c));
}

function analyze(community) {
  const cards = normalizeCommunity(community);
  const ranks = cards.map((c) => c.rank);
  return {
    ranks,
    paired: isPaired(ranks),
    monotone: isMonotone(cards),
    twoTone: isTwoTone(cards),
    broadway: hasBroadway(ranks),
    high: hasHighCard(ranks),
    low: ranks.every((r) => !["A", "K", "Q", "J"].includes(r)),
    conn: connectivity(ranks),
    vals: ranks.map((r) => RANK_VAL[r] || 0).sort((a, b) => b - a),
  };
}

function templateFeatures(rankList) {
  return {
    ranks: rankList,
    paired: isPaired(rankList),
    monotone: false,
    twoTone: false,
    broadway: hasBroadway(rankList),
    high: hasHighCard(rankList),
    low: rankList.every((r) => !["A", "K", "Q", "J"].includes(r)),
    conn: connectivity(rankList),
    vals: rankList.map((r) => RANK_VAL[r] || 0).sort((a, b) => b - a),
  };
}

function rankOverlap(liveRanks, tmplRanks) {
  const liveCounts = rankCounts(liveRanks);
  const tmplCounts = rankCounts(tmplRanks);
  let score = 0;
  tmplCounts.forEach((need, rank) => {
    score += Math.min(liveCounts.get(rank) || 0, need);
  });
  return score;
}

function valDistance(liveVals, tmplVals) {
  const len = Math.min(liveVals.length, tmplVals.length);
  let d = 0;
  for (let i = 0; i < len; i += 1) d += Math.abs((liveVals[i] || 0) - (tmplVals[i] || 0));
  return d;
}

function scoreTemplate(live, tmpl) {
  let s = 0;
  if (live.paired === tmpl.paired) s += 8;
  else s -= 12;
  if (live.monotone === tmpl.monotone) s += 3;
  if (live.twoTone === tmpl.twoTone) s += 1.5;
  if (live.high === tmpl.high) s += 2;
  if (live.low === tmpl.low) s += 2;
  if (live.broadway === tmpl.broadway) s += 1;
  s += rankOverlap(live.ranks, tmpl.ranks) * 3;
  s += Math.max(0, 3 - Math.abs(live.conn - tmpl.conn));
  s -= valDistance(live.vals, tmpl.vals) * 0.15;
  return s;
}

function nearestKey(community, keys, rankMap) {
  if (!community?.length) return keys[0];
  const live = analyze(community);
  let best = keys[0];
  let bestScore = -Infinity;
  keys.forEach((key) => {
    const tmpl = templateFeatures(rankMap[key] || []);
    const sc = scoreTemplate(live, tmpl);
    if (sc > bestScore) {
      bestScore = sc;
      best = key;
    }
  });
  return best;
}

function nearestFlopKey(community) {
  return nearestKey(community, FLOP_KEYS, FLOP_RANKS);
}

function nearestTurnKey(community) {
  return nearestKey(community, TURN_KEYS, TURN_RANKS);
}

function nearestRiverKey(community) {
  return nearestKey(community, RIVER_KEYS, RIVER_RANKS);
}

module.exports = {
  FLOP_KEYS,
  TURN_KEYS,
  RIVER_KEYS,
  nearestFlopKey,
  nearestTurnKey,
  nearestRiverKey,
  nearestKey,
  scoreTemplate,
  analyze,
};