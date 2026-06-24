/**
 * Canonical board templates for full-combo CFR training.
 */
const FLOP_BOARDS = {
  Ah72r: ["As", "7h", "2d"],
  Kh95r: ["Ks", "9h", "5d"],
  Qh86tw: ["Qh", "8s", "6d"],
  JhT9ss: ["Jh", "Ts", "9d"],
  T95mono: ["Ts", "9s", "5s"],
  paired88K: ["8h", "8d", "Kc"],
  low765: ["7h", "6d", "5c"],
  Aq5ss: ["Ah", "Qh", "5d"],
  KJTss: ["Kh", "Jh", "Td"],
  Q72r: ["Qs", "7h", "2c"],
  J84r: ["Jc", "8h", "4d"],
  A96r: ["Ad", "9h", "6c"],
};

const TURN_BOARDS = {
  Ah72_4: ["As", "7h", "2d", "4c"],
  Kh95_T: ["Ks", "9h", "5d", "Tc"],
  Qh86_9: ["Qh", "8s", "6d", "9c"],
  JhT9_J: ["Jh", "Ts", "9d", "Jc"],
  T95m_8: ["Ts", "9s", "5s", "8h"],
  pr88K_A: ["8h", "8d", "Kc", "As"],
  low765_4: ["7h", "6d", "5c", "4s"],
  Aq5s_K: ["Ah", "Qh", "5d", "Kc"],
};

const RIVER_BOARDS = {
  Ah72_4_9: ["As", "7h", "2d", "4c", "9s"],
  Kh95_T_2: ["Ks", "9h", "5d", "Tc", "2h"],
  Qh86_9_3: ["Qh", "8s", "6d", "9c", "3h"],
  JhT9_J_8: ["Jh", "Ts", "9d", "Jc", "8s"],
  T95m_8_2: ["Ts", "9s", "5s", "8h", "2d"],
  pr88K_A_5: ["8h", "8d", "Kc", "As", "5h"],
};

function boardKey(cards) {
  return cards.join("");
}

function classifyLiveBoard(community) {
  if (community.length < 3) return "unknown";
  const suits = community.reduce((a, c) => { a[c.suit || c[1]] = (a[c.suit || c[1]] || 0) + 1; return a; }, {});
  const maxS = Math.max(...Object.values(suits));
  const ranks = community.map((c) => c.rank || c[0]);
  const paired = new Set(ranks).size < ranks.length;
  const high = ranks.some((r) => ["A", "K", "Q"].includes(r));
  if (maxS >= 3) return "monotone";
  if (paired) return "paired";
  if (maxS >= 2 && high) return "wet";
  if (high) return "dry_ahigh";
  return "dry_low";
}

function nearestFlopKey(community) {
  const cat = classifyLiveBoard(community);
  const map = {
    dry_ahigh: "Ah72r",
    dry_low: "low765",
    wet: "JhT9ss",
    paired: "paired88K",
    monotone: "T95mono",
  };
  return map[cat] || "Ah72r";
}

function nearestTurnKey(community) {
  const cat = classifyLiveBoard(community);
  const map = {
    dry_ahigh: "Ah72_4",
    dry_low: "low765_4",
    wet: "JhT9_J",
    paired: "pr88K_A",
    monotone: "T95m_8",
  };
  return map[cat] || "Ah72_4";
}

function nearestRiverKey(community) {
  const cat = classifyLiveBoard(community);
  const map = {
    dry_ahigh: "Ah72_4_9",
    dry_low: "Kh95_T_2",
    wet: "JhT9_J_8",
    paired: "pr88K_A_5",
    monotone: "T95m_8_2",
  };
  return map[cat] || "Ah72_4_9";
}

module.exports = {
  FLOP_BOARDS,
  TURN_BOARDS,
  RIVER_BOARDS,
  boardKey,
  classifyLiveBoard,
  nearestFlopKey,
  nearestTurnKey,
  nearestRiverKey,
};