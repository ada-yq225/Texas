const CfrBoardMap = (() => {
  function classify(community) {
    if (community.length < 3) return "dry_ahigh";
    const suits = community.reduce((a, c) => { a[c.suit] = (a[c.suit] || 0) + 1; return a; }, {});
    const maxS = Math.max(...Object.values(suits));
    const ranks = community.map((c) => c.rank);
    const paired = new Set(ranks).size < ranks.length;
    const high = ranks.some((r) => ["A", "K", "Q"].includes(r));
    if (maxS >= 3) return "monotone";
    if (paired) return "paired";
    if (maxS >= 2 && high) return "wet";
    if (high) return "dry_ahigh";
    return "dry_low";
  }

  const FLOP = { dry_ahigh: "Ah72r", dry_low: "low765", wet: "JhT9ss", paired: "paired88K", monotone: "T95mono" };
  const TURN = { dry_ahigh: "Ah72_4", dry_low: "low765_4", wet: "JhT9_J", paired: "pr88K_A", monotone: "T95m_8" };
  const RIVER = { dry_ahigh: "Ah72_4_9", dry_low: "Kh95_T_2", wet: "JhT9_J_8", paired: "pr88K_A_5", monotone: "T95m_8_2" };

  function flopKey(community) {
    return FLOP[classify(community)] || "Ah72r";
  }
  function turnKey(community) {
    return TURN[classify(community)] || "Ah72_4";
  }
  function riverKey(community) {
    return RIVER[classify(community)] || "Ah72_4_9";
  }

  function subgamePrefix(profile, streetIndex) {
    const ip = profile.isIp;
    const pot = profile.pot;
    if (streetIndex === 3) {
      if (pot === "3bet" || pot === "4bet") return ip ? "river_3bp_ip" : "river_srp_oop";
      return ip ? "river_srp_ip" : "river_srp_oop";
    }
    if (streetIndex === 2) return pot === "3bet" ? "turn_3bp_ip" : "turn_srp_ip";
    if (streetIndex === 1) return pot === "3bet" ? "flop_3bp_oop" : "flop_srp_ip";
    return null;
  }

  return { flopKey, turnKey, riverKey, subgamePrefix, classify };
})();