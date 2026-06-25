/**
 * Bridges offline CFR+ (8-bucket + full 1326-combo) into live solver decisions.
 */
const CfrBridge = (() => {
  function isHeadsUp(ctx) {
    return ctx.activePlayers().length === 2;
  }

  function heroComboId(player) {
    if (typeof ComboIndex !== "undefined" && player.hand.length === 2) {
      const id = ComboIndex.fromHand(player.hand);
      if (id != null) return id;
    }
    return null;
  }

  function streetHistory(ctx) {
    const line = ctx.gtoLine || { flop: [], turn: [], river: [] };
    const street = ctx.streetIndex === 1 ? "flop" : ctx.streetIndex === 2 ? "turn" : "river";
    const acts = line[street] || [];
    const parts = [];
    acts.forEach((act) => {
      if (act.type === "fold") parts.push("fold");
      else if (act.type === "check") parts.push("check");
      else if (act.type === "call") parts.push("call");
      else if (act.type === "raise") {
        const pot = Math.max(ctx.pot, ctx.bigBlind * 3);
        const frac = act.target ? act.target / pot : 0.66;
        if (frac <= 0.3) parts.push("bet25");
        else if (frac <= 0.42) parts.push("bet33");
        else if (frac <= 0.58) parts.push("bet50");
        else if (frac <= 0.72) parts.push("bet66");
        else parts.push("bet100");
      }
    });
    return parts.join("/");
  }

  function cfrToDecision(action, player, ctx, tag) {
    const call = ctx.callAmount(player);
    const seed = `cfr:${ctx.handNumber}:${player.id}:${tag}:${action}`;

    if (action === "fold") return { type: "fold", reason: `${tag} · fold` };
    if (action === "check") return { type: "check", reason: `${tag} · check` };
    if (action === "call") return { type: "call", reason: `${tag} · call` };

    const fracMap = { bet25: 0.25, bet33: 0.33, bet50: 0.5, bet66: 0.66, bet100: 1.0, raise: 0.66 };
    const fraction = fracMap[action] || 0.66;
    const basis = Math.max(ctx.pot + call, ctx.bigBlind * 3);
    let target;
    if (ctx.currentBet === 0) {
      target = ctx.clamp(ctx.roundToBlind(basis * fraction), ctx.bigBlind, ctx.maxTargetFor(player));
    } else if (action === "raise") {
      const part = ctx.roundToBlind(Math.max(ctx.minRaise, basis * fraction));
      target = ctx.clamp(ctx.currentBet + part, ctx.minTargetFor(player), ctx.maxTargetFor(player));
    } else {
      target = ctx.clamp(ctx.roundToBlind(basis * fraction), ctx.minTargetFor(player), ctx.maxTargetFor(player));
    }

    return {
      type: "raise",
      target,
      label: action.startsWith("bet") || action === "raise" ? "CFR+ Bet" : "CFR+",
      reason: `${tag} · #${heroComboId(player)} · ${action} (${Math.round(fraction * 100)}%)`,
      cfr: true,
    };
  }

  function tryFullPostflop(player, ctx, profile) {
    if (typeof CfrFullLoader === "undefined" || !CfrFullLoader.isReady()) return null;
    const comboId = heroComboId(player);
    if (comboId == null) return null;

    const street = ctx.streetIndex === 1 ? "flop" : ctx.streetIndex === 2 ? "turn" : "river";
    const boardKey = street === "flop"
      ? CfrBoardMap.flopKey(ctx.community)
      : street === "turn"
        ? CfrBoardMap.turnKey(ctx.community)
        : CfrBoardMap.riverKey(ctx.community);
    const subgameKey = CfrBoardMap.subgamePrefix(profile, ctx.streetIndex);
    if (!subgameKey) return null;

    const action = CfrFullLoader.lookupComboSync({
      street,
      subgameKey,
      boardKey,
      comboId,
      history: streetHistory(ctx),
      seed: `full:${ctx.handNumber}:${comboId}:${streetHistory(ctx)}`,
    });
    if (!action) return null;
    return cfrToDecision(action, player, ctx, `CFR1326 ${subgameKey}/${boardKey}`);
  }

  function preflopRaiseTarget(player, ctx, action) {
    const facing = ctx.raisesThisRound > 0 || ctx.currentBet > ctx.bigBlind;
    if (action === "jam") return ctx.maxTargetFor(player);
    if (!facing) {
      if (action === "raise22" || action === "raise") return ctx.roundToBlind(ctx.bigBlind * 2.2);
      if (action === "raise30") return ctx.roundToBlind(ctx.bigBlind * 3);
      if (action === "raise45") return ctx.roundToBlind(ctx.bigBlind * 4.5);
    }
    const mult = ctx.raisesThisRound >= 3 ? 2.2 : ctx.raisesThisRound >= 2 ? 2.5 : 3;
    return ctx.roundToBlind(GtoCore.clamp(ctx.currentBet * mult, ctx.minTargetFor(player), ctx.maxTargetFor(player)));
  }

  function tryFullPreflop(player, ctx) {
    if (typeof CfrFullLoader === "undefined" || !CfrFullLoader.isReady()) return null;
    if (!isHeadsUp(ctx)) return null;
    const comboId = heroComboId(player);
    if (comboId == null) return null;

    const role = GtoCore.roleOf(player, ctx);
    const action = CfrFullLoader.lookupPreflopSync({
      comboId,
      role,
      history: "",
      raises: ctx.raisesThisRound,
      seed: `fullpf:${ctx.handNumber}:${comboId}:${role}:${ctx.raisesThisRound}`,
    });
    if (!action) return null;

    if (action === "fold") return { type: "fold", reason: `CFR1326 HU preflop · #${comboId} fold` };
    if (action === "call") return { type: "call", reason: `CFR1326 HU preflop · #${comboId} call` };
    if (action === "raise" || action === "raise22" || action === "raise30" || action === "raise45" || action === "jam") {
      const facing = ctx.raisesThisRound > 0;
      const label = !facing ? "CFR+ RFI" : ctx.raisesThisRound >= 2 ? "CFR+ 4Bet" : "CFR+ 3Bet";
      return {
        type: "raise",
        target: preflopRaiseTarget(player, ctx, action),
        label,
        reason: `CFR1326 HU · #${comboId} ${action}`,
        cfr: true,
      };
    }
    return null;
  }

  function heroBucket(player, ctx) {
    const key = GtoCore.handKeyFromCards(player.hand);
    const pct = GtoCore.HAND_PERCENTILE.get(key) || 0.5;
    let bucket = 7;
    if (pct >= 0.94) bucket = 0;
    else if (pct >= 0.82) bucket = 1;
    else if (pct >= 0.68) bucket = 2;
    else if (pct >= 0.52) bucket = 3;
    else if (pct >= 0.38) bucket = 4;
    else if (pct >= 0.24) bucket = 5;
    else if (pct >= 0.12) bucket = 6;
    return bucket;
  }

  function tryBucketPostflop(player, ctx, profile) {
    if (typeof CfrLoader === "undefined" || !CfrLoader.isReady()) return null;
    const subgame = CfrLoader.subgameKey(profile, ctx.streetIndex);
    if (!subgame) return null;
    const bucket = heroBucket(player, ctx);
    const history = streetHistory(ctx).replace(/bet25/g, "bet33").replace(/bet50/g, "bet66");
    const action = CfrLoader.lookup({ subgame, bucket, history, seed: `cfr:${ctx.handNumber}:${bucket}:${history}` });
    if (!action) return null;
    return cfrToDecision(action, player, ctx, `CFR+ ${subgame}`);
  }

  function tryPostflop(player, ctx, profile) {
    if (!isHeadsUp(ctx)) return null;
    return tryFullPostflop(player, ctx, profile) || tryBucketPostflop(player, ctx, profile);
  }

  function tryPreflopHu(player, ctx) {
    return tryFullPreflop(player, ctx);
  }

  return { tryPostflop, tryPreflopHu, isHeadsUp, heroBucket, heroComboId };
})();