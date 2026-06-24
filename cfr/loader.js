/**
 * Loads offline CFR+ strategy bundle and resolves info-set lookups.
 */
const CfrLoader = (() => {
  let bundle = null;
  let loading = null;
  let status = "idle";

  async function load(base = "./data/cfr") {
    if (bundle) return bundle;
    if (loading) return loading;
    status = "loading";
    loading = fetch(`${base}/bundle.json?v=1`)
      .then((r) => {
        if (!r.ok) throw new Error(`CFR bundle HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        bundle = data;
        status = "ready";
        return bundle;
      })
      .catch((err) => {
        status = "fallback";
        bundle = { version: 0, subgames: {} };
        console.warn("CFR bundle unavailable, using chart solver.", err);
        return bundle;
      });
    return loading;
  }

  function isReady() {
    return status === "ready" && bundle && Object.keys(bundle.subgames || {}).length > 0;
  }

  function statusText() {
    if (status === "ready") return `CFR+ ${Object.keys(bundle.subgames).length} subgames`;
    if (status === "loading") return "CFR loading…";
    if (status === "fallback") return "CFR fallback";
    return "CFR idle";
  }

  function pickAction(strategies, infoKey, actionList, seed) {
    const entries = strategies[infoKey];
    if (!entries || !entries.length) return null;
    const roll = GtoCore.seededUnit(seed);
    let c = 0;
    for (const entry of entries) {
      c += entry.p;
      if (roll < c) return entry.a;
    }
    return entries[entries.length - 1].a;
  }

  function mapHistory(streetActions, playerIdx) {
    const parts = [];
    streetActions.forEach((act, idx) => {
      const actor = idx % 2;
      if (actor !== playerIdx && act.type !== "fold") return;
      if (act.type === "fold") parts.push("fold");
      else if (act.type === "check") parts.push("check");
      else if (act.type === "call") parts.push("call");
      else if (act.type === "raise") {
        const frac = act.frac || 0.66;
        if (frac <= 0.38) parts.push("bet33");
        else if (frac <= 0.55) parts.push("bet66");
        else parts.push("bet100");
      }
    });
    return parts.join("/");
  }

  function subgameKey(profile, streetIndex) {
    const pot = profile.pot;
    const ip = profile.isIp;
    if (streetIndex === 3) {
      if (pot === "3bet" || pot === "4bet") return ip ? "river_3bp_ip" : "river_srp_oop";
      return ip ? "river_srp_ip" : "river_srp_oop";
    }
    if (streetIndex === 2) return ip ? "turn_srp_ip" : "turn_srp_ip";
    if (streetIndex === 1) {
      if (pot === "3bet" || pot === "4bet") return ip ? "flop_3bp_oop" : "flop_3bp_oop";
      return ip ? "flop_srp_ip" : "flop_srp_ip";
    }
    return null;
  }

  function lookup({ subgame, bucket, history, seed }) {
    if (!isReady()) return null;
    const sg = bundle.subgames[subgame];
    if (!sg) return null;
    const infoKey = `${bucket}|${history}`;
    const action = pickAction(sg.strategies, infoKey, sg.actions, seed);
    if (!action) {
      const partial = Object.keys(sg.strategies).find((k) => k.startsWith(`${bucket}|`) && k.includes(history.split("/")[0] || ""));
      if (partial) return pickAction(sg.strategies, partial, sg.actions, seed);
    }
    return action;
  }

  function lookupPreflopHu(player, bucket, history, seed) {
    if (!isReady()) return null;
    const sg = bundle.subgames.preflop_hu;
    if (!sg) return null;
    const p = player === 0 ? 0 : 1;
    const key = `${p}:${bucket}|${history}`;
    const entries = sg.strategies[key];
    if (!entries) return null;
    const roll = GtoCore.seededUnit(seed);
    let c = 0;
    for (const e of entries) {
      c += e.p;
      if (roll < c) return e.a;
    }
    return entries.at(-1)?.a || null;
  }

  return {
    load,
    isReady,
    statusText,
    lookup,
    lookupPreflopHu,
    mapHistory,
    subgameKey,
    getBundle: () => bundle,
  };
})();