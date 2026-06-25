/**
 * Professional GTO core: 169 notation, combo weights, positions, action lines, RNG.
 * Calibrated for 6-max 100bb (GTO Wizard / PIO baseline).
 */
const GtoCore = (() => {
  const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
  const RANK_VAL = { A: 14, K: 13, Q: 12, J: 11, T: 10, 9: 9, 8: 8, 7: 7, 6: 6, 5: 5, 4: 4, 3: 3, 2: 2 };
  const TOTAL_COMBOS = 1326;

  function allHandKeys() {
    const keys = [];
    for (let i = 0; i < RANKS.length; i += 1) {
      for (let j = i; j < RANKS.length; j += 1) {
        if (i === j) keys.push(`${RANKS[i]}${RANKS[j]}`);
        else {
          keys.push(`${RANKS[i]}${RANKS[j]}s`);
          keys.push(`${RANKS[i]}${RANKS[j]}o`);
        }
      }
    }
    return keys;
  }

  const HAND_KEYS = allHandKeys();

  function handKeyFromCards(hand) {
    const values = hand.map((c) => RANK_VAL[c.rank]).sort((a, b) => b - a);
    const suited = hand[0].suit === hand[1].suit;
    const hi = RANKS[14 - values[0]];
    const lo = RANKS[14 - values[1]];
    if (values[0] === values[1]) return `${hi}${lo}`;
    return `${hi}${lo}${suited ? "s" : "o"}`;
  }

  function comboCount(key) {
    if (key.length === 2) return 6;
    return key.endsWith("s") ? 4 : 12;
  }

  function handStrength(key) {
    const pair = key.length === 2;
    const suited = key.endsWith("s");
    const hi = RANK_VAL[key[0]];
    const lo = RANK_VAL[key[1]];
    const gap = hi - lo;
    let s = hi * 19 + lo * 10;
    if (pair) s += 120 + hi * 3.2;
    if (suited) s += 12 + (gap <= 2 ? 8 : gap <= 4 ? 2 : -5);
    else s += gap <= 1 ? 5 : gap <= 3 ? 0 : -8;
    if (hi === 14 && !pair) s += suited ? 11 : lo >= 10 ? 7 : lo >= 7 ? 1 : -6;
    return s;
  }

  const HAND_ORDER = [...HAND_KEYS].sort((a, b) => handStrength(b) - handStrength(a));
  const HAND_INDEX = new Map(HAND_ORDER.map((k, i) => [k, i]));
  const HAND_PERCENTILE = new Map(HAND_ORDER.map((k, i) => [k, 1 - i / (HAND_KEYS.length - 1)]));

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function seededUnit(seed) {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i += 1) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function pickAction(seed, freqs) {
    const roll = seededUnit(seed);
    let c = 0;
    for (const [key, action, weight] of [
      ["f", "fold", freqs.f || 0],
      ["c", "call", freqs.c || 0],
      ["r", "raise", freqs.r || 0],
      ["j", "jam", freqs.j || 0],
    ]) {
      c += weight;
      if (roll < c) return action;
    }
    return "fold";
  }

  function freqs(f = 0, c = 0, r = 0, j = 0) {
    const t = f + c + r + j || 1;
    return { f: f / t, c: c / t, r: r / t, j: j / t };
  }

  function seatRoles(ctx) {
    const n = ctx.players.length;
    const d = ctx.dealerIndex;
    const map = new Map();
    if (n === 2) {
      ctx.players.forEach((p, idx) => {
        map.set(p.id, idx === d ? "BTN" : "BB");
      });
      return map;
    }
    const order = [];
    for (let i = 1; i <= n; i += 1) order.push((d + i) % n);
    const sb = order[0];
    const bb = order[1];
    ctx.players.forEach((p, idx) => {
      if (idx === d) map.set(p.id, "BTN");
      else if (idx === sb) map.set(p.id, "SB");
      else if (idx === bb) map.set(p.id, "BB");
      else {
        const dist = (idx - d + n) % n;
        if (n <= 5) map.set(p.id, dist <= 2 ? "UTG" : "CO");
        else if (n === 6) map.set(p.id, dist === 3 ? "UTG" : dist === 4 ? "HJ" : dist === 5 ? "CO" : "MP");
        else if (n === 7) map.set(p.id, dist === 3 ? "UTG" : dist === 4 ? "UTG1" : dist === 5 ? "MP" : dist === 6 ? "HJ" : "CO");
        else map.set(p.id, dist === 3 ? "UTG" : dist === 4 ? "UTG1" : dist === 5 ? "MP" : dist === 6 ? "HJ" : dist === 7 ? "CO" : "MP");
      }
    });
    return map;
  }

  function roleOf(player, ctx) {
    return seatRoles(ctx).get(player.id) || "MP";
  }

  function isInPosition(hero, villain, ctx) {
    const hi = ctx.players.indexOf(hero);
    const vi = ctx.players.indexOf(villain);
    return hi > vi;
  }

  function effectiveStackBb(player, ctx) {
    const stacks = ctx.activePlayers().map((p) => p.stack + p.bet);
    const eff = Math.min(player.stack + player.bet, Math.max(...stacks));
    return eff / ctx.bigBlind;
  }

  function spr(player, ctx) {
    const opp = ctx.activePlayers().filter((p) => p.id !== player.id).map((p) => p.stack);
    const eff = Math.min(player.stack, opp.length ? Math.max(...opp) : player.stack);
    return eff / Math.max(1, ctx.pot);
  }

  function alpha(call, pot) {
    const pb = Math.max(1, pot - call);
    return call / (pb + call);
  }

  function mdf(call, pot) {
    return 1 - alpha(call, pot);
  }

  function potOdds(call, pot) {
    return call / Math.max(1, pot + call);
  }

  function createLine() {
    return {
      preflop: [],
      flop: [],
      turn: [],
      river: [],
      potType: "unopened",
      openRole: null,
      threeBetRole: null,
      fourBetRole: null,
      callers: [],
      squeeze: false,
    };
  }

  function analyzeLine(line) {
    const raises = line.preflop.filter((a) => a.type === "raise" || a.type === "jam");
    if (raises.length === 0) return { potType: line.preflop.some((a) => a.type === "call") ? "limped" : "unopened" };
    if (raises.length === 1) return { potType: "srp", openRole: raises[0].role, openId: raises[0].id };
    if (raises.length === 2) {
      return { potType: "3bet", openRole: raises[0].role, threeBetRole: raises[1].role, openId: raises[0].id, threeBetId: raises[1].id };
    }
    if (raises.length === 3) {
      return { potType: "4bet", openRole: raises[0].role, threeBetRole: raises[1].role, fourBetRole: raises[2].role };
    }
    return { potType: "5bet", openRole: raises[0].role };
  }

  function recordAction(line, street, player, decision, ctx) {
    const bucket = street === 0 ? "preflop" : street === 1 ? "flop" : street === 2 ? "turn" : "river";
    line[bucket].push({
      id: player.id,
      role: roleOf(player, ctx),
      type: decision.type,
      target: decision.target || 0,
      label: decision.label || "",
    });
    if (street === 0) {
      const meta = analyzeLine(line);
      line.potType = meta.potType;
      line.openRole = meta.openRole || line.openRole;
      line.threeBetRole = meta.threeBetRole || line.threeBetRole;
      line.fourBetRole = meta.fourBetRole || line.fourBetRole;
    }
  }

  function heroLineRole(player, line) {
    const pid = player.id;
    const pre = line.preflop;
    const raises = pre.filter((a) => (a.id === pid) && (a.type === "raise" || a.type === "jam"));
    const calls = pre.filter((a) => a.id === pid && a.type === "call");
    if (raises.length >= 2) return "4bettor";
    if (raises.length === 1 && line.potType === "3bet") return "3bettor";
    if (raises.length === 1) return "opener";
    if (calls.length && line.potType === "3bet") return "3bet_caller";
    if (calls.length && line.potType === "srp") return "caller";
    if (roleOf(player, { players: [player], dealerIndex: 0, activePlayers: () => [player] }) === "BB") return "bb_defender";
    return "folded_preflop";
  }

  return {
    RANKS,
    RANK_VAL,
    TOTAL_COMBOS,
    HAND_KEYS,
    HAND_ORDER,
    HAND_INDEX,
    HAND_PERCENTILE,
    handKeyFromCards,
    comboCount,
    handStrength,
    clamp,
    seededUnit,
    pickAction,
    freqs,
    roleOf,
    seatRoles,
    isInPosition,
    effectiveStackBb,
    spr,
    alpha,
    mdf,
    potOdds,
    createLine,
    analyzeLine,
    recordAction,
    heroLineRole,
  };
})();