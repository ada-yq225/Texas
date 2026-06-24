/**
 * Professional range-vs-range equity (Monte Carlo + exact river).
 */
const GtoEquity = (() => {
  const { RANK_VAL, handKeyFromCards, clamp, seededUnit } = GtoCore;

  function cardFromKey(rank, suit) {
    const red = suit === "h" || suit === "d";
    const sym = { s: "♠", h: "♥", d: "♦", c: "♣" }[suit];
    return { rank, suit, symbol: sym, red, solver: `${rank}${suit}` };
  }

  function combosForKey(key) {
    const suits = ["s", "h", "d", "c"];
    const list = [];
    if (key.length === 2) {
      for (let i = 0; i < suits.length; i += 1) {
        for (let j = i + 1; j < suits.length; j += 1) {
          list.push([cardFromKey(key[0], suits[i]), cardFromKey(key[1], suits[j])]);
        }
      }
      return list;
    }
    const suited = key.endsWith("s");
    const hi = key[0];
    const lo = key[1];
    if (suited) {
      suits.forEach((s) => list.push([cardFromKey(hi, s), cardFromKey(lo, s)]));
      return list;
    }
    suits.forEach((s1) => suits.forEach((s2) => {
      if (s1 !== s2) list.push([cardFromKey(hi, s1), cardFromKey(lo, s2)]);
    }));
    return list;
  }

  function blockedCombos(key, known) {
    return combosForKey(key).filter(([a, b]) => !known.has(a.solver) && !known.has(b.solver));
  }

  function sampleWeightedCombo(weights, known, seed) {
    const entries = [...weights.entries()]
      .map(([key, w]) => {
        const combos = blockedCombos(key, known);
        return { key, w, combos };
      })
      .filter((e) => e.combos.length > 0);
    if (!entries.length) return null;
    const total = entries.reduce((s, e) => s + e.w * e.combos.length, 0);
    let roll = seededUnit(seed) * total;
    for (const e of entries) {
      const part = e.w * e.combos.length;
      if (roll < part) {
        const idx = Math.floor(seededUnit(`${seed}:c`) * e.combos.length);
        return e.combos[idx];
      }
      roll -= part;
    }
    return entries[0].combos[0];
  }

  function remainingDeck(known) {
    const suits = ["s", "h", "d", "c"];
    const ranks = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
    const deck = [];
    ranks.forEach((r) => suits.forEach((s) => {
      const code = `${r}${s}`;
      if (!known.has(code)) deck.push(cardFromKey(r, s));
    }));
    return deck;
  }

  function drawN(deck, n, seed) {
    const cards = [...deck];
    const out = [];
    for (let i = 0; i < n && cards.length; i += 1) {
      const idx = Math.floor(seededUnit(`${seed}:d${i}`) * cards.length);
      out.push(cards.splice(idx, 1)[0]);
    }
    return out;
  }

  function solve(hand, board) {
    if (typeof Hand === "undefined") return null;
    return Hand.solve([...hand, ...board].map((c) => c.solver));
  }

  function exactRiver(heroHand, villainHands, board) {
    const hero = solve(heroHand, board);
    const villains = villainHands.map((vh) => solve(vh, board)).filter(Boolean);
    if (!hero || !villains.length) return null;
    const all = [hero, ...villains];
    all.forEach((h, i) => { h.owner = i; });
    const winners = Hand.winners(all);
    if (winners.some((w) => w.owner === 0)) return 1 / winners.filter((w) => w.owner === 0).length;
    return 0;
  }

  function rangeEquity(player, ctx, villainWeights, samples = 240) {
    if (ctx.getExactEquity) {
      const exact = ctx.getExactEquity(player);
      if (exact != null) return exact;
    }

    const known = new Set([...ctx.community, ...player.hand].map((c) => c.solver));
    const heroHand = player.hand;
    let wins = 0;

    const villains = ctx.activePlayers().filter((p) => p.id !== player.id);
    const villainCount = villains.length;

    for (let t = 0; t < samples; t += 1) {
      const seed = `eq:${ctx.handNumber}:${player.id}:${t}:${ctx.community.map((c) => c.solver).join("")}`;
      const k = new Set(known);
      const vHands = [];

      if (villainCount === 1 && villainWeights && villainWeights.size) {
        const combo = sampleWeightedCombo(villainWeights, k, `${seed}:v0`);
        if (!combo) continue;
        combo.forEach((c) => k.add(c.solver));
        vHands.push(combo);
      } else {
        for (let v = 0; v < villainCount; v += 1) {
          const deck = remainingDeck(k);
          const combo = drawN(deck, 2, `${seed}:v${v}`);
          combo.forEach((c) => k.add(c.solver));
          vHands.push(combo);
        }
      }

      let board = [...ctx.community];
      if (board.length < 5) {
        const deck = remainingDeck(k);
        board = [...board, ...drawN(deck, 5 - board.length, `${seed}:b`)];
      }

      if (board.length === 5) {
        const eq = exactRiver(heroHand, vHands, board);
        wins += eq ?? 0;
      }
    }
    return clamp(wins / samples, 0, 1);
  }

  function drawEquity(player, ctx) {
    if (ctx.community.length < 3 || ctx.community.length >= 5) return 0;
    const cards = [...player.hand, ...ctx.community];
    const suits = cards.reduce((a, c) => { a[c.suit] = (a[c.suit] || 0) + 1; return a; }, {});
    const flushDraw = Object.values(suits).some((n) => n === 4) ? 0.19 : Object.values(suits).some((n) => n === 3) ? 0.06 : 0;
    const values = [...new Set(cards.map((c) => RANK_VAL[c.rank]))].sort((a, b) => a - b);
    let oesd = 0;
    let gut = 0;
    for (let high = 14; high >= 6; high -= 1) {
      const seq = [high, high - 1, high - 2, high - 3, high - 4];
      const have = seq.filter((v) => values.includes(v)).length;
      if (have === 4) oesd = 0.15;
      else if (have === 3 && high >= 10) gut = 0.07;
    }
    return clamp(flushDraw + oesd + gut, 0, 0.32);
  }

  function madeHandTier(player, ctx) {
    if (ctx.community.length < 3 || typeof Hand === "undefined") return { name: "unknown", power: 0 };
    const solved = solve(player.hand, ctx.community);
    const power = {
      "Royal Flush": 10, "Straight Flush": 9.8, "Four of a Kind": 9.2, "Full House": 8.2,
      Flush: 7.2, Straight: 6.5, "Three of a Kind": 5.8, "Two Pair": 4.8, Pair: 3.2, "High Card": 1,
    }[solved.name] || 1;
    return { name: solved.name, power, solved };
  }

  function blockerScore(player, ctx, boardInfo) {
    const heroRanks = player.hand.map((c) => c.rank);
    const hasA = heroRanks.includes("A");
    const hasK = heroRanks.includes("K");
    let score = 0;
    if (boardInfo.monotone && hasA) score += 0.12;
    if (boardInfo.flushPossible && hasA) score += 0.08;
    if (boardInfo.paired && hasK) score += 0.05;
    if (boardInfo.wetness > 0.5 && (hasA || hasK)) score += 0.04;
    return score;
  }

  return {
    rangeEquity,
    drawEquity,
    madeHandTier,
    blockerScore,
    sampleWeightedCombo,
    combosForKey,
  };
})();