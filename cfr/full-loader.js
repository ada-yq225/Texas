/**
 * Full 1326-combo CFR strategy loader with preload cache (sync lookup).
 */
const CfrFullLoader = (() => {
  let manifest = null;
  const cache = new Map();
  let status = "idle";
  let preloadPromise = null;

  async function load(base = "./data/cfr-full") {
    if (manifest) return manifest;
    status = "loading";
    try {
      const res = await fetch(`${base}/manifest.json?v=2`);
      if (!res.ok) throw new Error(`manifest ${res.status}`);
      manifest = await res.json();
      status = "ready";
      return manifest;
    } catch (err) {
      status = "fallback";
      manifest = { version: 0, comboLevel: 0, files: {} };
      console.warn("Full-tree CFR unavailable:", err);
      return manifest;
    }
  }

  async function fetchSubgame(filename, base = "./data/cfr-full") {
    if (cache.has(filename)) return cache.get(filename);
    const res = await fetch(`${base}/${filename}?v=2`);
    if (!res.ok) return null;
    const data = await res.json();
    cache.set(filename, data);
    return data;
  }

  async function preloadAll(base = "./data/cfr-full") {
    if (!manifest || status !== "ready") await load(base);
    if (status !== "ready") return false;
    const all = [
      ...(manifest.files.preflop || []),
      ...(manifest.files.river || []),
      ...(manifest.files.turn || []),
      ...(manifest.files.flop || []),
    ];
    await Promise.all(all.map((f) => fetchSubgame(f, base)));
    return true;
  }

  function ensurePreload() {
    if (!preloadPromise && status === "ready") {
      preloadPromise = preloadAll();
    }
    return preloadPromise;
  }

  function isReady() {
    return status === "ready" && manifest && manifest.comboLevel === 1326;
  }

  function isCached(filename) {
    return cache.has(filename);
  }

  function statusText() {
    if (status === "ready") {
      const total = (manifest.files.river?.length || 0) + (manifest.files.flop?.length || 0) + (manifest.files.turn?.length || 0) + 2;
      return `Full CFR 1326 · ${cache.size}/${total}`;
    }
    if (status === "loading") return "Full CFR loading…";
    return status === "fallback" ? "Full CFR fallback" : "Full CFR idle";
  }

  function pickAction(strategies, comboId, history, seed) {
    const infoKey = `${comboId}|${history}`;
    let entries = strategies[infoKey];
    if (!entries) {
      const prefix = `${comboId}|`;
      const match = Object.keys(strategies).find((k) => k.startsWith(prefix) && (history === "" || k.includes(history.split("/")[0])));
      if (match) entries = strategies[match];
    }
    if (!entries || !entries.length) return null;
    const roll = GtoCore.seededUnit(seed);
    let c = 0;
    for (const e of entries) {
      c += e.p;
      if (roll < c) return e.a;
    }
    return entries.at(-1).a;
  }

  function lookupComboSync({ street, subgameKey, boardKey, comboId, history, seed }) {
    const filename = `${subgameKey}_${boardKey}.json`;
    const lists = manifest?.files?.[street] || [];
    let file = filename;
    if (!lists.includes(file)) {
      file = lists.find((f) => f.startsWith(subgameKey)) || null;
    }
    if (!file || !cache.has(file)) return null;
    const sg = cache.get(file);
    return pickAction(sg.strategies, comboId, history, seed);
  }

  function lookupPreflopSync({ comboId, role, history, raises, seed }) {
    if (!isReady()) return null;
    const huFile = "preflop_hu_1326.json";
    if (cache.has(huFile) && (role === "BTN" || role === "BB") && raises <= 1) {
      const sg = cache.get(huFile);
      const h = role === "BB" && raises > 0 ? "raise22" : history;
      const action = pickAction(sg.strategies, comboId, h, seed);
      if (action) return action;
    }
    const rfiFile = "preflop_rfi_1326.json";
    if (cache.has(rfiFile) && raises === 0 && ["UTG", "HJ", "CO", "BTN", "SB"].includes(role)) {
      const sg = cache.get(rfiFile);
      const infoKey = `${role}:${comboId}|`;
      const entries = sg.strategies[infoKey];
      if (!entries) return null;
      const roll = GtoCore.seededUnit(seed);
      let c = 0;
      for (const e of entries) {
        c += e.p;
        if (roll < c) return e.a;
      }
      return entries[0]?.a || null;
    }
    return null;
  }

  return {
    load,
    preloadAll,
    ensurePreload,
    fetchSubgame,
    isReady,
    isCached,
    statusText,
    lookupComboSync,
    lookupPreflopSync,
    getCacheSize: () => cache.size,
  };
})();