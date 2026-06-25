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

const {
  nearestFlopKey,
  nearestTurnKey,
  nearestRiverKey,
} = require("./board-scoring");

module.exports = {
  FLOP_BOARDS,
  TURN_BOARDS,
  RIVER_BOARDS,
  boardKey,
  nearestFlopKey,
  nearestTurnKey,
  nearestRiverKey,
};