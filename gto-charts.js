/**
 * Professional preflop charts — 6-max 100bb solver frequencies (combo-weighted).
 * Each spot returns {f,c,r,j} per 169 hand class.
 */
const GtoCharts = (() => {
  const { HAND_KEYS, HAND_ORDER, HAND_PERCENTILE, freqs, comboCount, TOTAL_COMBOS } = GtoCore;

  const RFI_COMBO_PCT = {
    UTG: 0.155,
    UTG1: 0.175,
    MP: 0.195,
    HJ: 0.235,
    CO: 0.285,
    BTN: 0.455,
    SB: 0.395,
  };

  const CALL_COMBO_PCT = {
    "vs:UTG:IP": 0.085,
    "vs:UTG:OOP": 0.065,
    "vs:HJ:IP": 0.11,
    "vs:HJ:OOP": 0.09,
    "vs:CO:IP": 0.165,
    "vs:CO:OOP": 0.14,
    "vs:BTN:IP": 0.285,
    "vs:BTN:OOP": 0.255,
    "vs:SB:IP": 0.24,
    "vs:SB:OOP": 0.22,
    "vs:BB": 0.44,
    "vs:SB:BB": 0.49,
  };

  const THREE_BET_COMBO_PCT = {
    "vs:UTG:IP": 0.042,
    "vs:UTG:OOP": 0.058,
    "vs:HJ:IP": 0.052,
    "vs:HJ:OOP": 0.068,
    "vs:CO:IP": 0.078,
    "vs:CO:OOP": 0.095,
    "vs:BTN:IP": 0.105,
    "vs:BTN:OOP": 0.125,
    "vs:SB:IP": 0.13,
    "vs:SB:OOP": 0.15,
    "vs:BB": 0.085,
    "vs:SB:BB": 0.065,
  };

  const cache = new Map();

  function pctToRaiseCall(spot, raisePct, callPct = 0, jamPct = 0) {
    const chart = {};
    let raised = 0;
    let called = 0;
    let jammed = 0;
    const raiseTarget = raisePct * TOTAL_COMBOS;
    const callTarget = callPct * TOTAL_COMBOS;
    const jamTarget = jamPct * TOTAL_COMBOS;

    for (const key of HAND_ORDER) {
      const combos = comboCount(key);
      let r = 0;
      let c = 0;
      let j = 0;
      let f = 1;
      if (raised < raiseTarget) {
        r = 1;
        f = 0;
        raised += combos;
      } else if (called < callTarget) {
        c = 1;
        f = 0;
        called += combos;
      } else if (jammed < jamTarget) {
        j = 1;
        f = 0;
        jammed += combos;
      }
      chart[key] = freqs(f, c, r, j);
    }
    return chart;
  }

  function applyOverrides(chart, overrides) {
    Object.entries(overrides).forEach(([key, f]) => {
      if (chart[key]) chart[key] = f;
    });
    return chart;
  }

  const PRO_OVERRIDES = {
    "rfi:UTG": {
      "55": freqs(0.48, 0, 0.52), "44": freqs(1, 0, 0), "A8s": freqs(0.65, 0, 0.35), "A7s": freqs(0.78, 0, 0.22),
      "A6s": freqs(0.82, 0, 0.18), "A5s": freqs(0, 0, 1), "A4s": freqs(0, 0, 1), "A3s": freqs(0, 0, 1), "A2s": freqs(0, 0, 1),
      "K9s": freqs(0.38, 0, 0.62), "K8s": freqs(0.72, 0, 0.28), "K5s": freqs(0.88, 0, 0.12),
      "QTs": freqs(0.32, 0, 0.68), "Q9s": freqs(0.58, 0, 0.42), "J9s": freqs(0.62, 0, 0.38),
      "T8s": freqs(0.55, 0, 0.45), "98s": freqs(0.15, 0, 0.85), "87s": freqs(0.28, 0, 0.72),
      "76s": freqs(0.12, 0, 0.88), "65s": freqs(0.1, 0, 0.9), "54s": freqs(0.52, 0, 0.48),
      "AJo": freqs(0.82, 0, 0.18), "ATo": freqs(0.92, 0, 0.08), "KQo": freqs(0.58, 0, 0.42), "KJo": freqs(0.88, 0, 0.12),
    },
    "rfi:BTN": {
      "22": freqs(0.15, 0, 0.85), "33": freqs(0, 0, 1), "A2o": freqs(0.72, 0, 0.28), "A3o": freqs(0.68, 0, 0.32),
      "A4o": freqs(0.65, 0, 0.35), "A7o": freqs(0.58, 0, 0.42), "A8o": freqs(0.45, 0, 0.55),
      "K2s": freqs(0.58, 0, 0.42), "K3s": freqs(0.52, 0, 0.48), "K4s": freqs(0.45, 0, 0.55),
      "K5s": freqs(0.32, 0, 0.68), "K6s": freqs(0.28, 0, 0.72), "Q5s": freqs(0.55, 0, 0.45),
      "J7s": freqs(0.62, 0, 0.38), "T6s": freqs(0.65, 0, 0.35), "96s": freqs(0.68, 0, 0.32),
      "86s": freqs(0.62, 0, 0.38), "75s": freqs(0.55, 0, 0.45), "64s": freqs(0.58, 0, 0.42),
      "53s": freqs(0.55, 0, 0.45), "43s": freqs(0.62, 0, 0.38), "K9o": freqs(0.52, 0, 0.48),
      "Q9o": freqs(0.58, 0, 0.42), "J9o": freqs(0.65, 0, 0.35),
    },
    "rfi:SB": {
      "22": freqs(0.28, 0, 0.72), "A2o": freqs(0.55, 0, 0.45), "K8o": freqs(0.78, 0, 0.22),
      "Q8o": freqs(0.85, 0, 0.15), "J8o": freqs(0.88, 0, 0.12), "T7o": freqs(0.9, 0, 0.1),
    },
    "vs:BTN:IP": {
      "AA": freqs(0, 0.78, 0.22), "KK": freqs(0, 0.72, 0.28), "QQ": freqs(0, 0.68, 0.32),
      "JJ": freqs(0, 0.82, 0.18), "TT": freqs(0, 0.88, 0.12), "99": freqs(0, 0.92, 0.08),
      "AKs": freqs(0, 0.58, 0.42), "AKo": freqs(0, 0.85, 0.15), "AQs": freqs(0, 0.78, 0.22),
      "AJs": freqs(0, 0.88, 0.12), "ATs": freqs(0, 0.92, 0.08), "A5s": freqs(0, 0.45, 0.55),
      "A4s": freqs(0, 0.52, 0.48), "A3s": freqs(0, 0.58, 0.42), "A2s": freqs(0, 0.62, 0.38),
      "KQs": freqs(0, 0.92, 0.08), "KJs": freqs(0, 0.95, 0.05), "QJs": freqs(0, 0.95, 0.05),
      "JTs": freqs(0, 0.95, 0.05), "T9s": freqs(0, 0.95, 0.05), "98s": freqs(0, 0.95, 0.05),
      "87s": freqs(0, 0.95, 0.05), "76s": freqs(0, 0.95, 0.05), "65s": freqs(0, 0.95, 0.05),
      "54s": freqs(0, 0.95, 0.05),
    },
    "vs:BB": {
      "AA": freqs(0, 0.82, 0.18), "KK": freqs(0, 0.78, 0.22), "QQ": freqs(0, 0.75, 0.25),
      "JJ": freqs(0, 0.88, 0.12), "TT": freqs(0, 0.92, 0.08), "99": freqs(0, 0.95, 0.05),
      "88": freqs(0, 0.95, 0.05), "77": freqs(0, 0.95, 0.05), "66": freqs(0, 0.95, 0.05),
      "55": freqs(0, 0.95, 0.05), "44": freqs(0, 0.95, 0.05), "33": freqs(0, 0.95, 0.05), "22": freqs(0, 0.95, 0.05),
      "AKs": freqs(0, 0.65, 0.35), "AKo": freqs(0, 0.88, 0.12), "AQs": freqs(0, 0.82, 0.18),
      "AJs": freqs(0, 0.9, 0.1), "ATs": freqs(0, 0.92, 0.08), "A9s": freqs(0, 0.95, 0.05),
      "A8s": freqs(0, 0.95, 0.05), "A7s": freqs(0, 0.95, 0.05), "A6s": freqs(0, 0.95, 0.05),
      "A5s": freqs(0, 0.58, 0.42), "A4s": freqs(0, 0.65, 0.35), "A3s": freqs(0, 0.72, 0.28), "A2s": freqs(0, 0.78, 0.22),
      "KQs": freqs(0, 0.92, 0.08), "KJs": freqs(0, 0.95, 0.05), "KTs": freqs(0, 0.95, 0.05),
      "QJs": freqs(0, 0.95, 0.05), "QTs": freqs(0, 0.95, 0.05), "JTs": freqs(0, 0.95, 0.05),
      "T9s": freqs(0, 0.95, 0.05), "98s": freqs(0, 0.95, 0.05), "87s": freqs(0, 0.95, 0.05),
      "76s": freqs(0, 0.95, 0.05), "65s": freqs(0, 0.95, 0.05), "54s": freqs(0, 0.95, 0.05),
      "A9o": freqs(0, 0.95, 0.05), "A8o": freqs(0, 0.95, 0.05), "A7o": freqs(0, 0.95, 0.05),
      "A5o": freqs(0, 0.88, 0.12), "A4o": freqs(0, 0.92, 0.08), "KQo": freqs(0, 0.95, 0.05),
      "KJo": freqs(0, 0.98, 0.02), "QJo": freqs(0, 0.98, 0.02), "JTo": freqs(0, 0.98, 0.02),
    },
    "vs3:IP": {
      "AA": freqs(0, 0.45, 0.35, 0.2), "KK": freqs(0, 0.38, 0.42, 0.2), "QQ": freqs(0, 0.42, 0.48),
      "JJ": freqs(0, 0.65, 0.35), "TT": freqs(0, 0.85, 0.15), "AKs": freqs(0, 0.28, 0.52, 0.2),
      "AKo": freqs(0, 0.72, 0.28), "AQs": freqs(0, 0.58, 0.42), "A5s": freqs(0, 0.78, 0.22),
      "A4s": freqs(0, 0.85, 0.15), "KQs": freqs(0, 0.92, 0.08),
    },
    "vs3:OOP": {
      "AA": freqs(0, 0.28, 0.45, 0.27), "KK": freqs(0, 0.22, 0.48, 0.3), "QQ": freqs(0, 0.32, 0.58),
      "JJ": freqs(0, 0.58, 0.42), "AKs": freqs(0, 0.18, 0.55, 0.27), "AKo": freqs(0, 0.65, 0.35),
      "AQs": freqs(0, 0.52, 0.48),
    },
    "vs4:IP": {
      "AA": freqs(0, 0.55, 0.15, 0.3), "KK": freqs(0, 0.48, 0.22, 0.3), "QQ": freqs(0, 0.62, 0.18, 0.2),
      "AKs": freqs(0, 0.38, 0.22, 0.4), "AKo": freqs(0, 0.78, 0.22), "JJ": freqs(0, 0.92, 0.08),
    },
    "vs4:OOP": {
      "AA": freqs(0, 0.35, 0.2, 0.45), "KK": freqs(0, 0.28, 0.25, 0.47), "QQ": freqs(0, 0.52, 0.15, 0.33),
      "AKs": freqs(0, 0.22, 0.18, 0.6), "AKo": freqs(0, 0.72, 0.28),
    },
    "vs5": {
      "AA": freqs(0, 0.65, 0, 0.35), "KK": freqs(0, 0.58, 0, 0.42), "QQ": freqs(0, 0.85, 0, 0.15),
      "AKs": freqs(0, 0.45, 0, 0.55), "AKo": freqs(0, 0.82, 0, 0.18),
    },
    "bb:iso": {
      "AA": freqs(0, 0, 1), "KK": freqs(0, 0, 1), "QQ": freqs(0, 0, 1), "JJ": freqs(0, 0, 0.92, 0.08),
      "TT": freqs(0, 0, 0.85, 0.15), "AKs": freqs(0, 0, 1), "AKo": freqs(0, 0, 0.88, 0.12), "AQs": freqs(0, 0, 0.95, 0.05),
    },
  };

  function buildChart(spot) {
    if (cache.has(spot)) return cache.get(spot);

    let chart;
    if (spot.startsWith("rfi:")) {
      const role = spot.split(":")[1];
      chart = pctToRaiseCall(spot, RFI_COMBO_PCT[role] || 0.2);
    } else if (spot.startsWith("vs:") && !spot.includes("vs3") && !spot.includes("vs4")) {
      const parts = spot.split(":");
      const key = parts.length === 3 ? `vs:${parts[1]}:${parts[2]}` : "vs:BB";
      const callPct = CALL_COMBO_PCT[key] || 0.1;
      const raisePct = THREE_BET_COMBO_PCT[key] || 0.08;
      chart = pctToRaiseCall(spot, raisePct, callPct);
    } else if (spot.startsWith("vs3:")) {
      chart = pctToRaiseCall(spot, 0.055, 0.1, 0.025);
    } else if (spot.startsWith("vs4:")) {
      chart = pctToRaiseCall(spot, 0.035, 0.06, 0.03);
    } else if (spot === "vs5") {
      chart = pctToRaiseCall(spot, 0.02, 0.04, 0.035);
    } else if (spot === "bb:iso") {
      chart = pctToRaiseCall(spot, 0.12);
    } else {
      chart = pctToRaiseCall(spot, 0.1);
    }

    if (PRO_OVERRIDES[spot]) applyOverrides(chart, PRO_OVERRIDES[spot]);
    cache.set(spot, chart);
    return chart;
  }

  function spotFor(player, ctx) {
    const role = GtoCore.roleOf(player, ctx);
    const call = ctx.callAmount(player);
    const facing = ctx.currentBet > ctx.bigBlind;
    const raises = ctx.raisesThisRound;

    if (!facing) {
      if (role === "BB" && call === 0) return "bb:option";
      return `rfi:${role}`;
    }
    if (raises >= 4) return "vs5";
    if (raises >= 3) {
      const agg = ctx.players.find((p) => p.id === ctx.lastAggressor);
      const ip = agg ? GtoCore.isInPosition(player, agg, ctx) : false;
      return ip ? "vs4:IP" : "vs4:OOP";
    }
    if (raises >= 2) {
      const agg = ctx.players.find((p) => p.id === ctx.lastAggressor);
      const ip = agg ? GtoCore.isInPosition(player, agg, ctx) : false;
      return ip ? "vs3:IP" : "vs3:OOP";
    }

    if (role === "BB") {
      const agg = ctx.players.find((p) => p.id === ctx.lastAggressor);
      const aggRole = agg ? GtoCore.roleOf(agg, ctx) : "MP";
      return aggRole === "SB" ? "vs:SB:BB" : "vs:BB";
    }

    const agg = ctx.players.find((p) => p.id === ctx.lastAggressor);
    const aggRole = agg ? GtoCore.roleOf(agg, ctx) : "MP";
    const ip = agg ? GtoCore.isInPosition(player, agg, ctx) : false;
    return `vs:${aggRole}:${ip ? "IP" : "OOP"}`;
  }

  function frequencies(spot, handKey) {
    if (spot === "bb:option") {
      const iso = buildChart("bb:iso")[handKey] || GtoCore.freqs(1, 0, 0);
      return iso;
    }
    const chart = buildChart(spot);
    return chart[handKey] || GtoCore.freqs(1, 0, 0);
  }

  function rangeWeights(spot, actionFilter) {
    const chart = spot === "bb:option" ? buildChart("bb:iso") : buildChart(spot);
    const weights = new Map();
    let total = 0;
    HAND_KEYS.forEach((key) => {
      const f = chart[key] || GtoCore.freqs(1, 0, 0);
      let w = 0;
      if (actionFilter === "raise") w = (f.r || 0) + (f.j || 0);
      else if (actionFilter === "call") w = f.c || 0;
      else if (actionFilter === "continue") w = (f.c || 0) + (f.r || 0) + (f.j || 0);
      else w = (f.c || 0) + (f.r || 0) + (f.j || 0);
      const combos = comboCount(key) * w;
      if (combos > 0) {
        weights.set(key, combos);
        total += combos;
      }
    });
    if (total > 0) weights.forEach((w, k) => weights.set(k, w / total));
    return weights;
  }

  return { spotFor, frequencies, rangeWeights, buildChart, RFI_COMBO_PCT };
})();