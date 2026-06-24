/**
 * Full 1326 combo enumeration (standard deck indexing).
 */
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
const SUITS = ["c", "d", "h", "s"];

function buildDeck() {
  const deck = [];
  for (const r of RANKS) for (const s of SUITS) deck.push(`${r}${s}`);
  return deck;
}

const DECK = buildDeck();
const DECK_SET = new Set(DECK);

function canonicalPair(a, b) {
  const ai = DECK.indexOf(a);
  const bi = DECK.indexOf(b);
  return ai < bi ? [a, b] : [b, a];
}

function buildCombos() {
  const combos = [];
  const idMap = new Map();
  for (let i = 0; i < DECK.length; i += 1) {
    for (let j = i + 1; j < DECK.length; j += 1) {
      const id = combos.length;
      const cards = [DECK[i], DECK[j]];
      combos.push(cards);
      idMap.set(`${cards[0]}:${cards[1]}`, id);
      idMap.set(`${cards[1]}:${cards[0]}`, id);
    }
  }
  return { combos, idMap, count: combos.length };
}

const { combos: ALL_COMBOS, idMap: COMBO_ID_MAP, count: COMBO_COUNT } = buildCombos();

function comboIdFromCards(cards) {
  const [a, b] = canonicalPair(cards[0], cards[1]);
  return COMBO_ID_MAP.get(`${a}:${b}`);
}

function handClassKey(cards) {
  const rankVal = (r) => RANKS.indexOf(r);
  const parse = (c) => ({ r: c[0], s: c[1], v: rankVal(c[0]) });
  const x = parse(cards[0]);
  const y = parse(cards[1]);
  const hi = x.v >= y.v ? x : y;
  const lo = x.v >= y.v ? y : x;
  if (hi.v === lo.v) return `${hi.r}${lo.r}`;
  const suited = x.s === y.s;
  return `${hi.r}${lo.r}${suited ? "s" : "o"}`;
}

function conflicts(a, b) {
  const set = new Set([...a, ...b]);
  return set.size < 4;
}

function sampleComboPair(rng, blocked = new Set()) {
  for (let t = 0; t < 200; t += 1) {
    const c0 = Math.floor(rng() * COMBO_COUNT);
    const c1 = Math.floor(rng() * COMBO_COUNT);
    if (c0 === c1) continue;
    const cards = [...ALL_COMBOS[c0], ...ALL_COMBOS[c1]];
    if (cards.some((c) => blocked.has(c))) continue;
    if (conflicts(ALL_COMBOS[c0], ALL_COMBOS[c1])) continue;
    return [c0, c1];
  }
  return [0, 1];
}

module.exports = {
  RANKS,
  SUITS,
  DECK,
  ALL_COMBOS,
  COMBO_ID_MAP,
  COMBO_COUNT,
  comboIdFromCards,
  handClassKey,
  conflicts,
  sampleComboPair,
};