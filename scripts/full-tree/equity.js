/**
 * Exact HU showdown equity via pokersolver (Node).
 */
const vm = require("vm");
const fs = require("fs");
const path = require("path");
const { ALL_COMBOS, COMBO_COUNT } = require("./combos");

let HandSolve = null;

function loadSolver() {
  if (HandSolve) return HandSolve;
  const code = fs.readFileSync(path.join(__dirname, "../../vendor/pokersolver.js"), "utf8");
  const sandbox = { exports: {}, module: { exports: {} }, console };
  vm.runInNewContext(code, sandbox);
  HandSolve = sandbox.exports.Hand;
  return HandSolve;
}

const CACHE_MAX = 120000;
const cache = new Map();

function cacheGet(key) {
  if (!cache.has(key)) return null;
  const v = cache.get(key);
  cache.delete(key);
  cache.set(key, v);
  return v;
}

function cacheSet(key, value) {
  if (cache.size >= CACHE_MAX) {
    const first = cache.keys().next().value;
    cache.delete(first);
  }
  cache.set(key, value);
}

function showdownEquity(combo0, combo1, boardCards) {
  const key = `${combo0}|${combo1}|${boardCards.join(",")}`;
  const hit = cacheGet(key);
  if (hit != null) return hit;

  const Hand = loadSolver();
  const h0 = ALL_COMBOS[combo0];
  const h1 = ALL_COMBOS[combo1];
  const cards = [...h0, ...h1, ...boardCards];
  if (new Set(cards).size !== cards.length) return 0.5;

  const s0 = Hand.solve([...h0, ...boardCards]);
  const s1 = Hand.solve([...h1, ...boardCards]);
  s0.owner = 0;
  s1.owner = 1;
  const winners = Hand.winners([s0, s1]);
  const eq0 = winners.some((w) => w.owner === 0) ? 1 / winners.filter((w) => w.owner === 0).length : 0;
  if (boardCards.length === 5) cacheSet(key, eq0);
  return eq0;
}

function mcEquityIncomplete(combo0, combo1, boardCards, rng, samples = 24) {
  if (boardCards.length === 5) return showdownEquity(combo0, combo1, boardCards);
  const blocked = new Set([...ALL_COMBOS[combo0], ...ALL_COMBOS[combo1], ...boardCards]);
  const deck = [];
  const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
  const suits = ["c", "d", "h", "s"];
  ranks.forEach((r) => suits.forEach((s) => {
    const c = `${r}${s}`;
    if (!blocked.has(c)) deck.push(c);
  }));
  let wins = 0;
  for (let i = 0; i < samples; i += 1) {
    const cards = [...deck];
    const runout = [];
    const need = 5 - boardCards.length;
    for (let k = 0; k < need; k += 1) {
      const idx = Math.floor(rng() * cards.length);
      runout.push(cards.splice(idx, 1)[0]);
    }
    wins += showdownEquity(combo0, combo1, [...boardCards, ...runout]);
  }
  return wins / samples;
}

module.exports = { showdownEquity, mcEquityIncomplete, loadSolver };