/**
 * Style bots v2 — archetype preflop charts + postflop line engine (7 personalities).
 */
const BotEngine = (() => {
  const STYLES = {
    lin: {
      tag: "紧凶",
      openGate: 0.06,
      defendBias: -0.04,
      threeBetBoost: 0.1,
      cbetBoost: 0.14,
      barrelBoost: -0.06,
      bluffMult: 0.32,
      callWide: -0.06,
      trapMult: 1.25,
      sizeMult: 1.05,
      foldTight: 0.08,
      heroPressure: 0.06,
    },
    chen: {
      tag: "赔率派",
      openGate: -0.02,
      defendBias: 0.1,
      threeBetBoost: -0.02,
      cbetBoost: -0.04,
      barrelBoost: -0.02,
      bluffMult: 0.55,
      callWide: 0.14,
      trapMult: 0.85,
      sizeMult: 0.92,
      foldTight: -0.08,
      heroPressure: -0.02,
      potOddsBias: 0.12,
    },
    mei: {
      tag: "混合",
      openGate: -0.1,
      defendBias: 0.02,
      threeBetBoost: 0.08,
      cbetBoost: 0.1,
      barrelBoost: 0.12,
      bluffMult: 1.15,
      callWide: 0.04,
      trapMult: 1.35,
      sizeMult: 1.12,
      foldTight: -0.06,
      heroPressure: 0.04,
    },
    gao: {
      tag: "冷静价值",
      openGate: 0.04,
      defendBias: -0.02,
      threeBetBoost: 0.04,
      cbetBoost: -0.08,
      barrelBoost: -0.1,
      bluffMult: 0.22,
      callWide: -0.04,
      trapMult: 1.45,
      sizeMult: 0.88,
      foldTight: 0.06,
      heroPressure: -0.04,
    },
    xu: {
      tag: "跟注站",
      openGate: -0.08,
      defendBias: 0.16,
      threeBetBoost: -0.12,
      cbetBoost: -0.18,
      barrelBoost: -0.2,
      bluffMult: 0.18,
      callWide: 0.22,
      trapMult: 0.55,
      sizeMult: 1.08,
      foldTight: -0.18,
      heroPressure: -0.08,
      station: true,
    },
    qiao: {
      tag: "松凶",
      openGate: -0.14,
      defendBias: 0.04,
      threeBetBoost: 0.14,
      cbetBoost: 0.18,
      barrelBoost: 0.16,
      bluffMult: 1.35,
      callWide: 0.08,
      trapMult: 0.9,
      sizeMult: 1.18,
      foldTight: -0.12,
      heroPressure: 0.1,
    },
    song: {
      tag: "平衡派",
      openGate: 0,
      defendBias: 0,
      threeBetBoost: 0.02,
      cbetBoost: 0.02,
      barrelBoost: 0,
      bluffMult: 0.82,
      callWide: 0,
      trapMult: 1,
      sizeMult: 1,
      foldTight: 0,
      heroPressure: 0,
    },
  };

  function styleOf(player) {
    return STYLES[player.id] || STYLES.song;
  }

  function roll(seed, threshold) {
    return GtoCore.seededUnit(seed) < GtoCore.clamp(threshold, 0, 1);
  }

  function preflopLabel(ctx) {
    if (ctx.streetIndex !== 0) return ctx.currentBet > 0 ? "加注到" : "下注";
    if (ctx.raisesThisRound === 0) return ctx.currentBet > 0 ? "加注到" : "下注";
    if (ctx.raisesThisRound === 1) return "3Bet 到";
    if (ctx.raisesThisRound === 2) return "4Bet 到";
    if (ctx.raisesThisRound === 3) return "5Bet 到";
    return "再加注到";
  }

  function betSize(player, ctx, frac, style, mode = "value") {
    const call = ctx.callAmount(player);
    const basis = Math.max(ctx.pot + call, ctx.bigBlind * 3);
    let mult = style.sizeMult;
    if (mode === "bluff") mult *= 1.05 + (style.bluffMult - 0.5) * 0.08;
    if (mode === "premium") mult *= 1.12;
    if (ctx.currentBet === 0) {
      return ctx.roundToBlind(GtoCore.clamp(basis * frac * mult, ctx.bigBlind, ctx.maxTargetFor(player)));
    }
    const part = ctx.roundToBlind(Math.max(ctx.minRaise, basis * frac * mult));
    return ctx.roundToBlind(GtoCore.clamp(ctx.currentBet + part, ctx.minTargetFor(player), ctx.maxTargetFor(player)));
  }

  function preflopSize(player, ctx, style, spot) {
    const role = GtoCore.roleOf(player, ctx);
    if (spot.startsWith("rfi:")) {
      const mult = role === "BTN" ? 2.2 : role === "CO" ? 2.35 : 2.5;
      return ctx.roundToBlind(GtoCore.clamp(ctx.bigBlind * mult * style.sizeMult, ctx.bigBlind * 2, ctx.maxTargetFor(player)));
    }
    if (ctx.raisesThisRound === 1) {
      return ctx.roundToBlind(GtoCore.clamp(ctx.currentBet * (2.8 + style.threeBetBoost), ctx.minTargetFor(player), ctx.maxTargetFor(player)));
    }
    return betSize(player, ctx, 0.55, style, "premium");
  }

  function chartAction(chart, key, seed) {
    if (!chart?.[key]) return null;
    const f = chart[key];
    const r = GtoCore.seededUnit(seed);
    let c = f.f || 0;
    if (r < c) return "fold";
    c += f.c || 0;
    if (r < c) return "call";
    c += f.r || 0;
    if (r < c) return "raise";
    return "jam";
  }

  function shouldOpen(key, player, style, ctx) {
    const pct = GtoCore.HAND_PERCENTILE.get(key) || 0.5;
    const role = GtoCore.roleOf(player, ctx);
    let gate = role === "BTN" ? 0.38 : role === "CO" ? 0.42 : role === "HJ" ? 0.48 : 0.54;
    gate += style.openGate;
    gate -= (player.tightness || 0.5) * 0.12;
    gate += (1 - (player.tightness || 0.5)) * 0.06;
    return pct >= gate;
  }

  function resolveEquity(player, ctx, samples = 320) {
    let eq = ctx.estimateEquity(player, samples);
    if (typeof GtoEquity !== "undefined" && ctx.community.length >= 3 && ctx.community.length < 5) {
      eq += GtoEquity.drawEquity(player, ctx) * 0.8;
    }
    return GtoCore.clamp(eq, 0, 1);
  }

  function boardInfo(ctx) {
    return typeof GtoSolver !== "undefined"
      ? GtoSolver.analyzeBoard(ctx.community)
      : { cat: "dry_high", wetness: ctx.boardTexture?.() || 0.2, paired: false, monotone: false };
  }

  function wasPreflopAggressor(player, ctx) {
    return ctx.preflopAggressor === player.id;
  }

  function decidePreflop(player, ctx, style) {
    const call = ctx.callAmount(player);
    const key = GtoCore.handKeyFromCards(player.hand);
    const role = GtoCore.roleOf(player, ctx);
    const canRaise = player.stack > call + ctx.minRaise;
    const seed = `bot:${ctx.handNumber}:${player.id}:${key}:${ctx.raisesThisRound}`;
    const eq = resolveEquity(player, ctx, 220);
    const position = ctx.positionQuality(player);
    const noise = ctx.rand(-0.04, 0.04) + (player.mood || 0);

    let chart = null;
    let chartAct = null;
    if (typeof GtoCharts !== "undefined") {
      const spot = GtoCharts.spotFor(player, ctx);
      chart = GtoCharts.buildChart(spot);
      chartAct = chartAction(chart, key, `${seed}:chart`);
    }

    if (ctx.raisesThisRound === 0 && call <= ctx.bigBlind && canRaise && shouldOpen(key, player, style, ctx)) {
      if (roll(seed, 0.48 + (player.aggression || 0.5) * 0.35 - style.openGate)) {
        const target = preflopSize(player, ctx, style, `rfi:${role}`);
        return {
          type: "raise",
          target,
          label: "开池",
          read: `${style.tag}·开池`,
          reason: `${style.tag} ${role} 开池 ${key} · 位置${Math.round(position * 100)}%`,
        };
      }
    }

    if (chartAct === "raise" && canRaise && roll(`${seed}:chr`, 0.42 + (player.aggression || 0.5) * 0.3)) {
      const spot = GtoCharts.spotFor(player, ctx);
      return {
        type: "raise",
        target: preflopSize(player, ctx, style, spot),
        label: preflopLabel(ctx),
        read: `${style.tag}·图表进攻`,
        reason: `${style.tag} 图表加注 ${key} @ ${spot}`,
      };
    }

    if (ctx.raisesThisRound === 1 && canRaise && eq > 0.58 + style.threeBetBoost * 0.3) {
      if (roll(`${seed}:3b`, 0.35 + style.threeBetBoost + (player.aggression || 0.5) * 0.2)) {
        return {
          type: "raise",
          target: preflopSize(player, ctx, style, "vs3"),
          label: "3Bet 到",
          read: `${style.tag}·3Bet`,
          reason: `${style.tag} 3Bet ${key} · EQ${Math.round(eq * 100)}%`,
        };
      }
    }

    if (style.station && call > 0 && eq > 0.28 + style.callWide) {
      return { type: "call", read: `${style.tag}·跟注站`, reason: `${style.tag} 宽跟 ${key} · EQ${Math.round(eq * 100)}%` };
    }

    if (call > 0) {
      const potOdds = call / Math.max(1, ctx.pot + call);
      const heroAdj = ctx.heroProfile();
      const facingHero = ctx.lastAggressor === ctx.hero?.id;
      const heroFactor = facingHero ? heroAdj.aggression * style.heroPressure - heroAdj.foldToBet * 0.05 : 0;
      const need = potOdds * (0.74 - (player.calling || 0.5) * 0.2 - (style.potOddsBias || 0)) + style.foldTight - style.callWide + heroFactor;
      const continueScore = eq - need + position * 0.06 + noise;

      if (chartAct === "call" || continueScore > 0.02) {
        return { type: "call", read: `${style.tag}·防守`, reason: `${style.tag} 跟注 ${key} · 需${Math.round(need * 100)}% 有${Math.round(eq * 100)}%` };
      }
      if (eq > 0.7 && canRaise && !style.station && roll(`${seed}:val`, 0.55 + style.threeBetBoost)) {
        return {
          type: "raise",
          target: preflopSize(player, ctx, style, "value"),
          label: preflopLabel(ctx),
          read: `${style.tag}·价值加注`,
          reason: `${style.tag} 价值加注 ${key}`,
        };
      }
      return { type: "fold", read: `${style.tag}·弃牌`, reason: `${style.tag} 翻前弃牌 ${key}` };
    }

    if (call === 0 && role === "BB") {
      if (canRaise && style.trapMult > 1.1 && shouldOpen(key, player, style, ctx) && roll(`${seed}:iso`, 0.35 * style.trapMult)) {
        return {
          type: "raise",
          target: betSize(player, ctx, 0.5, style, "premium"),
          label: "隔离",
          read: `${style.tag}·ISO`,
          reason: `${style.tag} BB 隔离 limp 池`,
        };
      }
      return { type: "check", read: player.style, reason: `${style.tag} BB 过牌` };
    }

    return { type: "fold", read: `${style.tag}·弃牌`, reason: `${style.tag} 未入池 ${key}` };
  }

  function facingBet(player, ctx, style, sit) {
    const { eq, made, call, board, multiway, heroAdj, facingHero } = sit;
    const po = GtoCore.potOdds(call, ctx.pot);
    const mdf = GtoCore.mdf(call, ctx.pot);
    const canRaise = player.stack > call + ctx.minRaise;
    const seed = `botf:${ctx.handNumber}:${player.id}:${ctx.streetIndex}`;

    let defendNeed = po * (ctx.streetIndex >= 3 ? 0.96 : 0.9) - style.callWide - (style.potOddsBias || 0) + style.foldTight;
    defendNeed += multiway * 0.04;
    if (style.station) defendNeed -= 0.12;
    if (facingHero) defendNeed -= heroAdj.aggression * style.heroPressure * 0.5;

    const premium = eq > 0.72 + multiway * 0.04;
    const trapLine = premium && roll(`${seed}:trap`, (player.trap || 0.15) * style.trapMult * (sit.spr > 3 ? 1.1 : 0.6));

    if (canRaise && premium && !trapLine && !style.station) {
      return {
        type: "raise",
        target: betSize(player, ctx, 0.62, style, "premium"),
        label: preflopLabel(ctx),
        read: `${style.tag}·价值加注`,
        reason: `${style.tag} 价值加注 · ${made.name} EQ${Math.round(eq * 100)}%`,
      };
    }

    const bluffRaise = canRaise && eq > 0.3 && eq < 0.48
      && roll(`${seed}:br`, (player.bluff || 0.18) * style.bluffMult * (0.7 + board.wetness * 0.3))
      && !multiway && !style.station;
    if (bluffRaise) {
      return {
        type: "raise",
        target: betSize(player, ctx, 0.52, style, "bluff"),
        label: preflopLabel(ctx),
        read: `${style.tag}·诈唬加注`,
        reason: `${style.tag} 诈唬加注 · EQ${Math.round(eq * 100)}%`,
      };
    }

    if (eq >= defendNeed || (eq >= po * mdf * 0.88 && made.power >= 3) || (style.station && eq > 0.22)) {
      return {
        type: "call",
        read: trapLine ? `${style.tag}·慢打` : `${style.tag}·跟注`,
        reason: `${style.tag} 跟注 · MDF${Math.round(mdf * 100)}% EQ${Math.round(eq * 100)}%`,
      };
    }

    return { type: "fold", read: `${style.tag}·弃牌`, reason: `${style.tag} 弃牌 · EQ${Math.round(eq * 100)}% < ${Math.round(defendNeed * 100)}%` };
  }

  function betting(player, ctx, style, sit) {
    const { eq, made, board, multiway, wasAgg, spr, blockers } = sit;
    const seed = `botb:${ctx.handNumber}:${player.id}:${ctx.streetIndex}`;
    const street = ctx.streetIndex;

    const valueLine = 0.54 + (player.tightness || 0.5) * 0.08 + multiway * 0.04 - style.callWide * 0.3;
    const isValue = eq > valueLine || made.power >= 5.5;
    const isBluff = eq > 0.14 && eq < 0.36 && roll(`${seed}:bl`, (player.bluff || 0.18) * style.bluffMult);
    const checkMid = eq > 0.36 && eq < 0.54 && !isValue;

    if (street === 1) {
      let cbetFreq = (wasAgg ? 0.58 : 0.12) + style.cbetBoost;
      if (multiway) cbetFreq *= 0.55;
      if (board.wetness > 0.5) cbetFreq *= 0.82;
      if (style.station && !wasAgg) cbetFreq = 0.08;

      if (checkMid && style.trapMult > 1.2 && roll(`${seed}:trap`, 0.45)) {
        return { type: "check", read: `${style.tag}·陷阱`, reason: `${style.tag} 翻牌慢打 ${made.name}` };
      }

      if (roll(`${seed}:cb`, cbetFreq) && (isValue || isBluff) && player.stack > ctx.bigBlind) {
        const mode = isValue ? "value" : "bluff";
        return {
          type: "raise",
          target: betSize(player, ctx, wasAgg ? 0.48 : 0.42, style, mode),
          label: wasAgg ? "C-Bet" : "下注",
          read: isValue ? `${style.tag}·C-Bet价值` : `${style.tag}·C-Bet诈唬`,
          reason: `${style.tag} ${wasAgg ? "C-Bet" : "Donk"} · EQ${Math.round(eq * 100)}%`,
        };
      }

      if (!wasAgg && isValue && made.power >= 6 && roll(`${seed}:xr`, 0.22 * style.trapMult)) {
        return {
          type: "raise",
          target: betSize(player, ctx, 0.58, style, "premium"),
          label: "Check-Raise",
          read: `${style.tag}·XR`,
          reason: `${style.tag} Check-Raise · ${made.name}`,
        };
      }
      return { type: "check", read: player.style, reason: `${style.tag} 翻牌过牌` };
    }

    if (street === 2) {
      let barrel = (wasAgg ? 0.48 : 0.22) + style.barrelBoost;
      if (multiway) barrel *= 0.5;
      if (checkMid && !isValue) {
        return { type: "check", read: `${style.tag}·控池`, reason: `${style.tag} 转牌控池 EQ${Math.round(eq * 100)}%` };
      }
      if (roll(`${seed}:tb`, barrel) && (isValue || isBluff)) {
        return {
          type: "raise",
          target: betSize(player, ctx, 0.55, style, isValue ? "value" : "bluff"),
          label: "转牌下注",
          read: isValue ? `${style.tag}·转牌价值` : `${style.tag}·转牌诈唬`,
          reason: `${style.tag} 转牌 ${isValue ? "价值" : "诈唬"} · EQ${Math.round(eq * 100)}%`,
        };
      }
      return { type: "check", read: player.style, reason: `${style.tag} 转牌过牌` };
    }

    if (street === 3) {
      if (isValue && player.stack > ctx.bigBlind) {
        const thin = eq < valueLine + 0.08 && style.station;
        const frac = thin ? 0.42 : spr < 1.2 && eq > 0.78 ? 0.85 : 0.62;
        return {
          type: "raise",
          target: betSize(player, ctx, frac, style, "value"),
          label: thin ? "薄价值" : "河牌价值",
          read: `${style.tag}·河牌价值`,
          reason: `${style.tag} 河牌${thin ? "薄" : ""}价值 · ${made.name} EQ${Math.round(eq * 100)}%`,
        };
      }
      const alpha = GtoCore.alpha(ctx.bigBlind * 3, ctx.pot);
      if (isBluff && blockers > 0.04 && roll(`${seed}:rb`, alpha * style.bluffMult * 1.2)) {
        return {
          type: "raise",
          target: betSize(player, ctx, 0.68, style, "bluff"),
          label: "河牌诈唬",
          read: `${style.tag}·河牌诈唬`,
          reason: `${style.tag} 河牌诈唬 · 阻断${Math.round(blockers * 100)}%`,
        };
      }
      return { type: "check", read: player.style, reason: `${style.tag} 河牌过牌 EQ${Math.round(eq * 100)}%` };
    }

    return { type: "check", read: player.style, reason: `${style.tag} 过牌` };
  }

  function decidePostflop(player, ctx, style) {
    const call = ctx.callAmount(player);
    const eq = resolveEquity(player, ctx, ctx.streetIndex >= 3 ? 420 : 340);
    const board = boardInfo(ctx);
    const made = typeof GtoEquity !== "undefined" ? GtoEquity.madeHandTier(player, ctx) : { name: "?", power: 0 };
    const blockers = typeof GtoEquity !== "undefined" ? GtoEquity.blockerScore(player, ctx, board) : 0;
    const multiway = ctx.activePlayers().length > 2;
    const spr = ctx.sprFor(player);
    const heroAdj = ctx.heroProfile();
    const facingHero = ctx.lastAggressor === ctx.hero?.id;
    const sit = { eq, made, call, board, multiway, spr, blockers, heroAdj, facingHero, wasAgg: wasPreflopAggressor(player, ctx) };

    if (call > 0) return facingBet(player, ctx, style, sit);
    return betting(player, ctx, style, sit);
  }

  function decide(player, ctx) {
    if (!player?.hand?.length) return { type: "check", read: player.style, reason: "等待发牌" };
    const style = styleOf(player);
    if (ctx.streetIndex === 0) return decidePreflop(player, ctx, style);
    return decidePostflop(player, ctx, style);
  }

  return { decide, STYLES, styleOf };
})();