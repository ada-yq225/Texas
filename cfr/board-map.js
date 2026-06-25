/**
 * Map live community cards → nearest trained CFR board template (12 flop / 8 turn / 6 river).
 */
const CfrBoardMap = (() => {
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
    const suits = community.reduce((a, c) => { a[c.suit] = (a[c.suit] || 0) + 1; return a; }, {});
    return Math.max(...Object.values(suits), 0) >= 3;
  }

  function isTwoTone(community) {
    const suits = community.reduce((a, c) => { a[c.suit] = (a[c.suit] || 0) + 1; return a; }, {});
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

  function analyze(community) {
    const ranks = community.map((c) => c.rank);
    return {
      ranks,
      paired: isPaired(ranks),
      monotone: isMonotone(community),
      twoTone: isTwoTone(community),
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
      const have = liveCounts.get(rank) || 0;
      score += Math.min(have, need);
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

  const MIN_BOARD_SCORE = { flop: 12, turn: 11, river: 10 };
  const MIN_BOARD_MARGIN = 1.5;

  function nearestKeyWithScore(community, keys, rankMap) {
    if (!community?.length) return { key: keys[0], score: 0, margin: 0, live: analyze([]) };
    const live = analyze(community);
    let best = keys[0];
    let bestScore = -Infinity;
    let secondScore = -Infinity;
    keys.forEach((key) => {
      const tmpl = templateFeatures(rankMap[key] || []);
      const sc = scoreTemplate(live, tmpl);
      if (sc > bestScore) {
        secondScore = bestScore;
        bestScore = sc;
        best = key;
      } else if (sc > secondScore) {
        secondScore = sc;
      }
    });
    return {
      key: best,
      score: bestScore,
      margin: bestScore - (Number.isFinite(secondScore) ? secondScore : bestScore),
      live,
      tmpl: templateFeatures(rankMap[best] || []),
    };
  }

  function nearestKey(community, keys, rankMap) {
    return nearestKeyWithScore(community, keys, rankMap).key;
  }

  function streetMeta(streetIndex) {
    if (streetIndex === 1) return { street: "flop", keys: FLOP_KEYS, rankMap: FLOP_RANKS };
    if (streetIndex === 2) return { street: "turn", keys: TURN_KEYS, rankMap: TURN_RANKS };
    return { street: "river", keys: RIVER_KEYS, rankMap: RIVER_RANKS };
  }

  function evaluateCfrLookup(community, streetIndex, subgameKey, availableFiles) {
    const { street, keys, rankMap } = streetMeta(streetIndex);
    if (!subgameKey) return { use: false, reason: "no_subgame" };
    if (!TRAINED_SUBGAMES[street]?.has(subgameKey)) return { use: false, reason: "untrained_subgame" };

    const prefix = `${subgameKey}_`;
    const suffixes = (availableFiles || [])
      .filter((f) => f.startsWith(prefix) && f.endsWith(".json"))
      .map((f) => f.slice(prefix.length, -5));
    const allowed = keys.filter((k) => suffixes.includes(k));
    const pool = allowed.length ? allowed : keys;
    if (!pool.length) return { use: false, reason: "no_board_pool" };

    const match = nearestKeyWithScore(community, pool, rankMap);
    const minScore = MIN_BOARD_SCORE[street] || 11;
    const boardInfo = { live: formatBoard(community), tmpl: match.key, approx: formatBoard(community) !== match.key };

    if (match.live.paired !== match.tmpl.paired) {
      return { use: false, boardKey: match.key, score: match.score, margin: match.margin, boardInfo, reason: "paired_mismatch" };
    }
    if (match.score < minScore) {
      return { use: false, boardKey: match.key, score: match.score, margin: match.margin, boardInfo, reason: "low_board_score" };
    }
    if (pool.length > 1 && match.margin < MIN_BOARD_MARGIN) {
      return { use: false, boardKey: match.key, score: match.score, margin: match.margin, boardInfo, reason: "ambiguous_board" };
    }
    return { use: true, boardKey: match.key, score: match.score, margin: match.margin, boardInfo, reason: "ok" };
  }

  function classify(community) {
    if (community.length < 3) return "dry_ahigh";
    const live = analyze(community);
    if (live.monotone) return "monotone";
    if (live.paired) return "paired";
    if (live.twoTone && live.high) return "wet";
    if (live.high) return "dry_ahigh";
    return "dry_low";
  }

  function formatBoard(community) {
    if (!community?.length) return "—";
    return community.map((c) => `${(c.rank || "").replace("T", "10")}${c.symbol || ""}`).join("");
  }

  function flopKey(community) {
    return nearestKey(community, FLOP_KEYS, FLOP_RANKS);
  }

  function turnKey(community) {
    return nearestKey(community, TURN_KEYS, TURN_RANKS);
  }

  function riverKey(community) {
    return nearestKey(community, RIVER_KEYS, RIVER_RANKS);
  }

  function lookupLabel(community, streetIndex) {
    const live = formatBoard(community);
    const tmpl = streetIndex === 1 ? flopKey(community) : streetIndex === 2 ? turnKey(community) : riverKey(community);
    return { live, tmpl, approx: live !== tmpl };
  }

  const TRAINED_SUBGAMES = {
    flop: new Set(["flop_srp_ip", "flop_3bp_oop"]),
    turn: new Set(["turn_srp_ip", "turn_3bp_ip"]),
    river: new Set(["river_srp_ip", "river_srp_oop", "river_3bp_ip"]),
  };

  function subgamePrefix(profile, streetIndex) {
    const ip = profile.isIp;
    const is3bp = profile.pot === "3bet" || profile.pot === "4bet";
    let key = null;
    if (streetIndex === 1) {
      if (is3bp) key = "flop_3bp_oop";
      else if (ip) key = "flop_srp_ip";
    } else if (streetIndex === 2) {
      if (is3bp) key = "turn_3bp_ip";
      else if (ip) key = "turn_srp_ip";
    } else if (streetIndex === 3) {
      if (is3bp) key = ip ? "river_3bp_ip" : null;
      else key = ip ? "river_srp_ip" : "river_srp_oop";
    }
    if (!key) return null;
    const street = streetIndex === 1 ? "flop" : streetIndex === 2 ? "turn" : "river";
    return TRAINED_SUBGAMES[street].has(key) ? key : null;
  }

  function boardKeyForSubgame(community, streetIndex, subgameKey, availableFiles) {
    const lookup = evaluateCfrLookup(community, streetIndex, subgameKey, availableFiles);
    if (lookup.use) return lookup.boardKey;
    const { keys, rankMap } = streetMeta(streetIndex);
    return nearestKey(community, keys, rankMap);
  }

  return {
    flopKey,
    turnKey,
    riverKey,
    nearestKey,
    nearestKeyWithScore,
    classify,
    formatBoard,
    lookupLabel,
    subgamePrefix,
    boardKeyForSubgame,
    evaluateCfrLookup,
    TRAINED_SUBGAMES,
    FLOP_KEYS,
    MIN_BOARD_SCORE,
  };
})();