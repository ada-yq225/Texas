/**
 * Professional GTO solver — preflop charts + postflop strategy trees (SRP / 3BP).
 */
const GtoSolver = (() => {
  const POSTFLOP = {
    srp_ip: {
      flop: {
        dry_high: { cbet: 0.78, sizes: [[0.25, 0.55], [0.33, 0.3], [0.5, 0.15]], xr: 0.08, check: 0.22 },
        dry_low: { cbet: 0.72, sizes: [[0.33, 0.5], [0.5, 0.35], [0.66, 0.15]], xr: 0.1, check: 0.28 },
        wet: { cbet: 0.48, sizes: [[0.5, 0.3], [0.66, 0.45], [0.75, 0.25]], xr: 0.14, check: 0.52 },
        paired: { cbet: 0.42, sizes: [[0.33, 0.45], [0.5, 0.35], [0.75, 0.2]], xr: 0.09, check: 0.58 },
        monotone: { cbet: 0.35, sizes: [[0.33, 0.4], [0.5, 0.35], [0.66, 0.25]], xr: 0.12, check: 0.65 },
      },
      turn: { barrel: 0.58, sizes: [[0.5, 0.35], [0.66, 0.4], [0.75, 0.25]], probe: 0.32, check: 0.42 },
      river: { value: 0.55, bluffAlpha: true, sizes: [[0.66, 0.4], [0.75, 0.35], [1.0, 0.25]], check: 0.45 },
    },
    srp_oop: {
      flop: {
        dry_high: { cbet: 0.35, sizes: [[0.33, 0.5], [0.5, 0.35], [0.66, 0.15]], xr: 0.16, check: 0.65, donk: 0.08 },
        dry_low: { cbet: 0.28, sizes: [[0.33, 0.45], [0.5, 0.4], [0.66, 0.15]], xr: 0.18, check: 0.72, donk: 0.1 },
        wet: { cbet: 0.22, sizes: [[0.5, 0.35], [0.66, 0.45], [0.75, 0.2]], xr: 0.2, check: 0.78, donk: 0.12 },
        paired: { cbet: 0.18, sizes: [[0.33, 0.4], [0.5, 0.4], [0.75, 0.2]], xr: 0.14, check: 0.82, donk: 0.06 },
        monotone: { cbet: 0.12, sizes: [[0.33, 0.45], [0.5, 0.35], [0.66, 0.2]], xr: 0.16, check: 0.88, donk: 0.05 },
      },
      turn: { barrel: 0.42, sizes: [[0.5, 0.4], [0.66, 0.35], [0.75, 0.25]], probe: 0.22, check: 0.58 },
      river: { value: 0.48, bluffAlpha: true, sizes: [[0.66, 0.45], [0.75, 0.35], [1.0, 0.2]], check: 0.52 },
    },
    threebet_ip: {
      flop: {
        dry_high: { cbet: 0.68, sizes: [[0.25, 0.4], [0.33, 0.35], [0.5, 0.25]], xr: 0.06, check: 0.32 },
        wet: { cbet: 0.45, sizes: [[0.33, 0.25], [0.5, 0.35], [0.66, 0.4]], xr: 0.1, check: 0.55 },
        paired: { cbet: 0.38, sizes: [[0.25, 0.35], [0.33, 0.35], [0.5, 0.3]], xr: 0.08, check: 0.62 },
        monotone: { cbet: 0.28, sizes: [[0.25, 0.4], [0.33, 0.35], [0.5, 0.25]], xr: 0.1, check: 0.72 },
      },
      turn: { barrel: 0.52, sizes: [[0.5, 0.35], [0.66, 0.4], [0.75, 0.25]], probe: 0.25, check: 0.48 },
      river: { value: 0.5, bluffAlpha: true, sizes: [[0.5, 0.3], [0.66, 0.35], [0.75, 0.35]], check: 0.5 },
    },
    threebet_oop: {
      flop: {
        dry_high: { cbet: 0.42, sizes: [[0.33, 0.45], [0.5, 0.35], [0.66, 0.2]], xr: 0.12, check: 0.58 },
        wet: { cbet: 0.28, sizes: [[0.33, 0.3], [0.5, 0.4], [0.66, 0.3]], xr: 0.15, check: 0.72 },
        paired: { cbet: 0.22, sizes: [[0.25, 0.4], [0.33, 0.35], [0.5, 0.25]], xr: 0.1, check: 0.78 },
        monotone: { cbet: 0.15, sizes: [[0.25, 0.45], [0.33, 0.35], [0.5, 0.2]], xr: 0.12, check: 0.85 },
      },
      turn: { barrel: 0.38, sizes: [[0.5, 0.4], [0.66, 0.35], [0.75, 0.25]], probe: 0.18, check: 0.62 },
      river: { value: 0.45, bluffAlpha: true, sizes: [[0.5, 0.35], [0.66, 0.4], [0.75, 0.25]], check: 0.55 },
    },
  };

  function analyzeBoard(community) {
    if (community.length < 3) return { cat: "dry_high", wetness: 0.2, paired: false, monotone: false, flushPossible: false, highBoard: true };
    const suits = community.reduce((a, c) => { a[c.suit] = (a[c.suit] || 0) + 1; return a; }, {});
    const values = community.map((c) => GtoCore.RANK_VAL[c.rank]).sort((a, b) => a - b);
    const uniq = [...new Set(values)];
    const paired = uniq.length < community.length;
    const maxS = Math.max(...Object.values(suits));
    const monotone = maxS >= 3;
    const flushPossible = maxS >= 2;
    const highBoard = values.some((v) => v >= 12);
    const lowBoard = values.every((v) => v <= 10);
    let wetness = 0.12;
    if (monotone) wetness += 0.38;
    if (maxS === 2) wetness += 0.14;
    if (paired) wetness += 0.16;
    const gaps = uniq.slice(1).map((v, i) => v - uniq[i]);
    if (gaps.filter((g) => g <= 2).length >= 2) wetness += 0.2;

    let cat = "dry_high";
    if (monotone) cat = "monotone";
    else if (paired) cat = "paired";
    else if (wetness > 0.48) cat = "wet";
    else if (lowBoard && !highBoard) cat = "dry_low";

    return { cat, wetness: GtoCore.clamp(wetness, 0.08, 0.95), paired, monotone, flushPossible, highBoard, lowBoard };
  }

  function potProfile(line, player, ctx) {
    const role = GtoCore.heroLineRole(player, line);
    const pot = line.potType || "srp";
    const isIp = (() => {
      const agg = ctx.players.find((p) => p.id === ctx.preflopAggressor);
      if (!agg) return GtoCore.roleOf(player, ctx) === "BTN" || GtoCore.roleOf(player, ctx) === "CO";
      return GtoCore.isInPosition(player, agg, ctx);
    })();
    const key = pot === "3bet" || pot === "4bet" ? (isIp ? "threebet_ip" : "threebet_oop") : (isIp ? "srp_ip" : "srp_oop");
    return { key, role, isIp, pot };
  }

  function pickSize(sizes, seed) {
    const roll = GtoCore.seededUnit(seed);
    let c = 0;
    for (const [frac, w] of sizes) {
      c += w;
      if (roll < c) return frac;
    }
    return sizes[0][0];
  }

  function betTo(player, ctx, fraction) {
    const call = ctx.callAmount(player);
    const basis = Math.max(ctx.pot + call, ctx.bigBlind * 3);
    if (ctx.currentBet === 0) {
      return GtoCore.clamp(ctx.roundToBlind(basis * fraction), ctx.bigBlind, ctx.maxTargetFor(player));
    }
    const part = ctx.roundToBlind(Math.max(ctx.minRaise, basis * fraction));
    return GtoCore.clamp(ctx.currentBet + part, ctx.minTargetFor(player), ctx.maxTargetFor(player));
  }

  function openSize(ctx) {
    const limps = ctx.players.filter((p) => p.lastAction.includes("跟注")).length;
    return ctx.roundToBlind(Math.max(ctx.bigBlind * 2.2, ctx.bigBlind * 2 + limps * ctx.bigBlind));
  }

  function threeBetSize(ctx, player, spot) {
    const ip = spot.includes("IP");
    const mult = player.position === "BB" || GtoCore.roleOf(player, ctx) === "BB" ? 3.75 : ip ? 3.0 : 3.45;
    return ctx.roundToBlind(Math.max(ctx.currentBet * mult, ctx.currentBet + ctx.minRaise));
  }

  function fourBetSize(ctx, player, jam = false) {
    if (jam) return ctx.maxTargetFor(player);
    const ip = spotIp(player, ctx);
    return GtoCore.clamp(ctx.roundToBlind(ctx.currentBet * (ip ? 2.2 : 2.4)), ctx.minTargetFor(player), ctx.maxTargetFor(player));
  }

  function spotIp(player, ctx) {
    const agg = ctx.players.find((p) => p.id === ctx.lastAggressor);
    return agg ? GtoCore.isInPosition(player, agg, ctx) : true;
  }

  function villainRange(ctx, line) {
    const villain = ctx.players.find((p) => p.id === ctx.lastAggressor)
      || ctx.players.find((p) => p.id === ctx.preflopAggressor);
    if (!villain) return GtoCharts.rangeWeights("rfi:BTN", "raise");

    if (line.potType === "3bet" || line.potType === "4bet") {
      const ip = ctx.preflopAggressor
        ? GtoCore.isInPosition(villain, ctx.players.find((p) => p.id === ctx.preflopAggressor) || villain, ctx)
        : true;
      return GtoCharts.rangeWeights(ip ? "vs3:IP" : "vs3:OOP", "raise");
    }
    if (line.potType === "srp") {
      const role = GtoCore.roleOf(villain, ctx);
      return GtoCharts.rangeWeights(`rfi:${role}`, "raise");
    }
    return GtoCharts.rangeWeights("rfi:CO", "raise");
  }

  function decidePreflop(player, ctx) {
    const cfrDecision = CfrBridge.tryPreflopHu(player, ctx);
    if (cfrDecision) return cfrDecision;

    const key = GtoCore.handKeyFromCards(player.hand);
    const spot = GtoCharts.spotFor(player, ctx);
    const f = GtoCharts.frequencies(spot, key);
    const seed = `pf:${ctx.handNumber}:${player.id}:${key}:${spot}:${ctx.raisesThisRound}`;
    const action = GtoCore.pickAction(seed, f);
    const call = ctx.callAmount(player);
    const canRaise = player.stack > call + ctx.minRaise;

    if (action === "fold") {
      if (call === 0 && GtoCore.roleOf(player, ctx) === "BB") return { type: "check", reason: `[${spot}] BB check` };
      return { type: "fold", reason: `[${spot}] fold ${key}` };
    }
    if (action === "call") {
      if (call === 0) return { type: "check", reason: `[${spot}] check` };
      return { type: "call", reason: `[${spot}] call ${key}` };
    }
    if (!canRaise) return call > 0 ? { type: "call", reason: "call (short)" } : { type: "check", reason: "check" };

    if (spot === "bb:option") {
      const iso = GtoCore.pickAction(`${seed}:iso`, GtoCharts.frequencies("bb:iso", key));
      if (iso === "raise" || iso === "jam") {
        return { type: "raise", target: ctx.roundToBlind(ctx.bigBlind * 3.5), label: "GTO ISO", reason: `BB iso ${key}` };
      }
      return { type: "check", reason: "BB check" };
    }

    let target;
    let label;
    let reason;
    if (spot.startsWith("rfi:")) {
      target = openSize(ctx);
      label = "GTO RFI";
      reason = `${spot} raise ${key} (${Math.round((f.r || 0) * 100)}%)`;
    } else if (spot === "vs5" || action === "jam") {
      target = ctx.maxTargetFor(player);
      label = "GTO Jam";
      reason = `5bet jam ${key}`;
    } else if (spot.startsWith("vs4:")) {
      target = fourBetSize(ctx, player, (f.j || 0) > 0.25);
      label = (f.j || 0) > 0.25 ? "GTO Jam" : "GTO 4Bet";
      reason = `4bet ${key}`;
    } else if (spot.startsWith("vs3:")) {
      target = fourBetSize(ctx, player, false);
      label = "GTO 4Bet";
      reason = `4bet vs 3bet ${key}`;
    } else {
      target = threeBetSize(ctx, player, spot);
      label = "GTO 3Bet";
      reason = `3bet ${key} @ ${spot}`;
    }
    return { type: "raise", target, label, reason };
  }

  function facingBet(player, ctx, line, equity, boardInfo, made, blockers, profile, seed) {
    const call = ctx.callAmount(player);
    const po = GtoCore.potOdds(call, ctx.pot);
    const mdf = GtoCore.mdf(call, ctx.pot);
    const spr = GtoCore.spr(player, ctx);
    const canRaise = player.stack > call + ctx.minRaise;
    const multi = (ctx.activePlayers().length - 2) * 0.045;

    const defendEq = po * (ctx.streetIndex >= 3 ? 0.98 : 0.94) - multi + blockers * 0.5;
    if (equity < defendEq && GtoCore.pickAction(`${seed}:fold`, GtoCore.freqs(0.92, 0.08)) === "fold") {
      return { type: "fold", reason: `fold · eq ${(equity * 100).toFixed(0)}% < need ${(defendEq * 100).toFixed(0)}% · MDF ${(mdf * 100).toFixed(0)}%` };
    }

    const raiseFreq = made.power >= 7 && equity > 0.7 ? 0.38 : equity > 0.28 && equity < 0.45 ? 0.12 : 0;
    if (canRaise && spr > 0.75 && GtoCore.pickAction(`${seed}:xr`, GtoCore.freqs(1 - raiseFreq, 0, raiseFreq)) === "raise") {
      const frac = pickSize(profile.turn?.sizes || [[0.66, 1]], `${seed}:rsize`);
      return {
        type: "raise",
        target: betTo(player, ctx, frac),
        label: made.power >= 6 ? "GTO 加注" : "GTO 诈唬加注",
        reason: `raise ${(frac * 100).toFixed(0)}% pot · eq ${(equity * 100).toFixed(0)}%`,
      };
    }

    if (equity >= defendEq || (equity >= po * mdf * 0.9 && made.power >= 3)) {
      return { type: "call", reason: `call · MDF ${(mdf * 100).toFixed(0)}% · eq ${(equity * 100).toFixed(0)}%` };
    }
    return { type: "fold", reason: `fold · outside range` };
  }

  function betting(player, ctx, line, equity, boardInfo, made, blockers, tree, profile, seed) {
    const street = ctx.streetIndex;
    const multi = ctx.activePlayers().length > 2;
    const spr = GtoCore.spr(player, ctx);
    const heroRole = GtoCore.heroLineRole(player, line);
    const wasAgg = ctx.preflopAggressor === player.id || heroRole === "opener" || heroRole === "3bettor";

    if (street === 1) {
      const node = tree.flop[boardInfo.cat] || tree.flop.dry_high;
      let betFreq = wasAgg ? node.cbet : node.donk || 0;
      if (multi) betFreq *= 0.58;
      if (!wasAgg && equity < 0.52) betFreq = node.donk || 0.12;

      const isValue = equity > 0.58 || made.power >= 5.5;
      const isBluff = equity > 0.15 && equity < 0.32 && blockers > 0.06;
      const checkMid = equity > 0.38 && equity < 0.54;

      if (checkMid && !isValue && GtoCore.pickAction(`${seed}:chk`, GtoCore.freqs(node.check, 0, 0)) !== "raise") {
        return { type: "check", reason: `check · medium ${(equity * 100).toFixed(0)}%` };
      }

      if (GtoCore.pickAction(`${seed}:bet`, GtoCore.freqs(node.check, 0, betFreq)) === "raise" && (isValue || isBluff)) {
        const frac = pickSize(node.sizes, `${seed}:fsize`);
        if (spr < 1.1 && isValue && equity > 0.72) {
          return { type: "raise", target: ctx.maxTargetFor(player), label: "GTO Jam", reason: `jam low SPR · eq ${(equity * 100).toFixed(0)}%` };
        }
        return {
          type: "raise",
          target: betTo(player, ctx, frac),
          label: wasAgg ? "GTO C-Bet" : "GTO Donk",
          reason: `${wasAgg ? "cbet" : "donk"} ${(frac * 100).toFixed(0)}% · eq ${(equity * 100).toFixed(0)}%`,
        };
      }

      if (!wasAgg && equity > 0.62 && GtoCore.pickAction(`${seed}:xr`, GtoCore.freqs(1 - node.xr, 0, node.xr)) === "raise") {
        const frac = pickSize(node.sizes, `${seed}:xrsize`);
        return { type: "raise", target: betTo(player, ctx, frac), label: "GTO XR", reason: `check-raise ${(frac * 100).toFixed(0)}%` };
      }
      return { type: "check", reason: `check · freq ${((1 - betFreq) * 100).toFixed(0)}%` };
    }

    if (street === 2) {
      const node = tree.turn;
      let barrel = wasAgg ? node.barrel : node.probe;
      if (multi) barrel *= 0.52;
      const polarValue = equity > 0.65 || made.power >= 6;
      const polarBluff = equity > 0.14 && equity < 0.3;
      const checkControl = equity > 0.4 && equity < 0.56;

      if (checkControl && !polarValue) return { type: "check", reason: `turn check · pot control ${(equity * 100).toFixed(0)}%` };

      if (GtoCore.pickAction(`${seed}:tbet`, GtoCore.freqs(node.check, 0, barrel)) === "raise" && (polarValue || polarBluff)) {
        const frac = pickSize(node.sizes, `${seed}:tsize`);
        return { type: "raise", target: betTo(player, ctx, frac), label: "GTO Turn", reason: `turn barrel ${(frac * 100).toFixed(0)}% · eq ${(equity * 100).toFixed(0)}%` };
      }
      return { type: "check", reason: "turn check" };
    }

    const node = tree.river;
    const valueBet = equity > node.value || made.power >= 6.5;
    const alpha = GtoCore.alpha(ctx.bigBlind * 3, ctx.pot);
    const bluffFreq = node.bluffAlpha ? alpha : 0.28;
    const bluff = equity > 0.12 && equity < 0.28 && blockers > 0.05;

    if (valueBet && player.stack > ctx.bigBlind) {
      const frac = pickSize(node.sizes, `${seed}:vsize`);
      return { type: "raise", target: betTo(player, ctx, frac), label: "GTO Value", reason: `river value ${(frac * 100).toFixed(0)}% · eq ${(equity * 100).toFixed(0)}%` };
    }
    if (bluff && GtoCore.pickAction(`${seed}:bluff`, GtoCore.freqs(1 - bluffFreq, 0, bluffFreq)) === "raise") {
      const frac = pickSize(node.sizes, `${seed}:bsize`);
      return { type: "raise", target: betTo(player, ctx, frac), label: "GTO Bluff", reason: `river bluff ${(frac * 100).toFixed(0)}% · α=${(alpha * 100).toFixed(0)}%` };
    }
    return { type: "check", reason: `river check · eq ${(equity * 100).toFixed(0)}%` };
  }

  function decidePostflop(player, ctx) {
    const line = ctx.gtoLine || GtoCore.createLine();
    const boardInfo = analyzeBoard(ctx.community);
    const profile = potProfile(line, player, ctx);

    const cfrDecision = CfrBridge.tryPostflop(player, ctx, profile);
    if (cfrDecision) return cfrDecision;
    const tree = POSTFLOP[profile.key] || POSTFLOP.srp_ip;
    const vRange = villainRange(ctx, line);
    const samples = ctx.gtoSamples || 280;
    const equity = GtoEquity.rangeEquity(player, ctx, vRange, samples) + GtoEquity.drawEquity(player, ctx) * (ctx.community.length < 5 ? 0.85 : 0);
    const eq = GtoCore.clamp(equity, 0, 1);
    const made = GtoEquity.madeHandTier(player, ctx);
    const blockers = GtoEquity.blockerScore(player, ctx, boardInfo);
    const seed = `sf:${ctx.handNumber}:${player.id}:${ctx.streetIndex}:${ctx.community.map((c) => c.solver).join("")}`;

    if (ctx.callAmount(player) > 0) {
      return facingBet(player, ctx, line, eq, boardInfo, made, blockers, tree, profile, seed);
    }
    return betting(player, ctx, line, eq, boardInfo, made, blockers, tree, profile, seed);
  }

  function decide(player, ctx) {
    if (!player.hand.length) return { type: "check", reason: "no hand" };
    if (ctx.streetIndex === 0) return decidePreflop(player, ctx);
    return decidePostflop(player, ctx);
  }

  return {
    decide,
    analyzeBoard,
    POSTFLOP,
  };
})();

const GtoEngine = GtoSolver;