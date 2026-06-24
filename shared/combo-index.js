/**
 * Browser + shared 1326 combo index (matches scripts/full-tree/combos.js).
 */
const ComboIndex = (() => {
  const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
  const SUITS = ["c", "d", "h", "s"];

  const DECK = [];
  for (const r of RANKS) for (const s of SUITS) DECK.push(`${r}${s}`);

  const COMBOS = [];
  const LOOKUP = new Map();

  for (let i = 0; i < DECK.length; i += 1) {
    for (let j = i + 1; j < DECK.length; j += 1) {
      const id = COMBOS.length;
      const pair = [DECK[i], DECK[j]];
      COMBOS.push(pair);
      LOOKUP.set(`${DECK[i]}:${DECK[j]}`, id);
      LOOKUP.set(`${DECK[j]}:${DECK[i]}`, id);
    }
  }

  function fromSolverCard(card) {
    return `${card.rank}${card.suit}`;
  }

  function fromHand(hand) {
    const a = fromSolverCard(hand[0]);
    const b = fromSolverCard(hand[1]);
    const ai = DECK.indexOf(a);
    const bi = DECK.indexOf(b);
    const lo = ai < bi ? a : b;
    const hi = ai < bi ? b : a;
    return LOOKUP.get(`${hi}:${lo}`);
  }

  return {
    COUNT: COMBOS.length,
    COMBOS,
    fromHand,
    fromSolverCard,
  };
})();