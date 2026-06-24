#!/usr/bin/env node
/**
 * Full 1326-combo offline CFR+ training → data/cfr-full/
 */
const fs = require("fs");
const path = require("path");
const { ComboCFR } = require("./cfr-combo");
const { COMBO_COUNT, sampleComboPair, ALL_COMBOS } = require("./combos");
const { mcEquityIncomplete } = require("./equity");
const { FLOP_BOARDS, TURN_BOARDS, RIVER_BOARDS } = require("./boards");

const OUT = path.join(__dirname, "../../data/cfr-full");

function mulberry32(seed) {
  return function rand() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function collectActions(cfr) {
  const set = new Set();
  const walk = (st) => {
    cfr.actions(st).forEach((a) => set.add(a));
    cfr.actions(st).forEach((a) => {
      const n = cfr.apply(st, a);
      if (!n.terminal && cfr.actions(n).length) walk(n);
    });
  };
  walk(cfr.initialState());
  return [...set];
}

function trainComboSubgame(name, config, iterations, board, mcSamples, skipExisting = true) {
  const outPath = path.join(OUT, `${name}.json`);
  if (skipExisting && fs.existsSync(outPath)) {
    console.log(`  ${name}: skip (exists)`);
    return JSON.parse(fs.readFileSync(outPath, "utf8"));
  }
  const rng = mulberry32(config.seed || 99);
  const cfr = new ComboCFR({ ...config, board, mcSamples });
  const t0 = Date.now();
  const blocked = new Set(board);

  cfr.train(iterations, (r) => {
    for (let t = 0; t < 80; t += 1) {
      const [c0, c1] = sampleComboPair(r, blocked);
      const cards = [...ALL_COMBOS[c0], ...ALL_COMBOS[c1]];
      if (!cards.some((c) => blocked.has(c))) return [c0, c1];
    }
    return [0, 1];
  }, rng);

  const actions = collectActions(cfr);
  const strategies = cfr.exportSparse(actions, 0.003);
  console.log(`  ${name}: ${iterations} iters, ${Object.keys(strategies).length} infosets, ${Date.now() - t0}ms`);
  return {
    meta: {
      name,
      comboLevel: 1326,
      iterations: cfr.iterations,
      board,
      potBb: config.pot,
      stacksBb: config.stacks,
      firstPlayer: config.firstPlayer,
      algorithm: "CFR+",
      trainedAt: new Date().toISOString(),
    },
    actions,
    strategies,
  };
}

function trainPreflopHu1326(iterations = 100000) {
  const rng = mulberry32(1326);
  const regrets = new Map();
  const strategySum = new Map();
  const btnActs = ["fold", "raise22", "raise30", "raise45"];
  const bbActs = ["fold", "call", "raise", "jam"];

  function key(p, combo, h) {
    return `${p}|${combo}|${h}`;
  }

  function strat(p, combo, h, acts) {
    const k = key(p, combo, h);
    if (!regrets.has(k)) regrets.set(k, new Float64Array(acts.length));
    const r = regrets.get(k);
    const s = new Float64Array(acts.length);
    let n = 0;
    for (let i = 0; i < acts.length; i += 1) { s[i] = Math.max(0, r[i]); n += s[i]; }
    if (n < 1e-12) { const u = 1 / acts.length; for (let i = 0; i < acts.length; i += 1) s[i] = u; }
    else { for (let i = 0; i < acts.length; i += 1) s[i] /= n; }
    if (!strategySum.has(k)) strategySum.set(k, new Float64Array(acts.length));
    const sum = strategySum.get(k);
    for (let i = 0; i < acts.length; i += 1) sum[i] += s[i];
    return s;
  }

  function preflopEq(c0, c1) {
    return mcEquityIncomplete(c0, c1, [], rng, 10);
  }

  for (let t = 0; t < iterations; t += 1) {
    const c0 = Math.floor(rng() * COMBO_COUNT);
    const c1 = Math.floor(rng() * COMBO_COUNT);
    if (c0 === c1) continue;

    const s0 = strat(0, c0, "", btnActs);
    let ev0 = 0;
    const u0 = new Float64Array(btnActs.length);

    for (let i = 0; i < btnActs.length; i += 1) {
      const a = btnActs[i];
      if (a === "fold") u0[i] = -0.5;
      else {
        const h = a;
        const s1 = strat(1, c1, h, bbActs);
        let ev = 0;
        for (let j = 0; j < bbActs.length; j += 1) {
          const ba = bbActs[j];
          let pay = 0;
          if (ba === "fold") pay = 1.5;
          else if (ba === "call") pay = preflopEq(c0, c1) * 4.5 - 2.5;
          else if (ba === "raise") pay = preflopEq(c0, c1) * 9 - 4.5;
          else pay = preflopEq(c0, c1) * 100 - 50;
          ev += s1[j] * pay;
        }
        u0[i] = ev;
      }
      ev0 += s0[i] * u0[i];
    }

    const r0 = regrets.get(key(0, c0, "")) || new Float64Array(btnActs.length);
    if (!regrets.has(key(0, c0, ""))) regrets.set(key(0, c0, ""), r0);
    for (let i = 0; i < btnActs.length; i += 1) r0[i] = Math.max(0, r0[i] + u0[i] - ev0);

    for (let i = 0; i < btnActs.length; i += 1) {
      if (btnActs[i] === "fold") continue;
      const h = btnActs[i];
      const s1 = strat(1, c1, h, bbActs);
      let ev1 = 0;
      const u1 = new Float64Array(bbActs.length);
      const eq = preflopEq(c0, c1);
      for (let j = 0; j < bbActs.length; j += 1) {
        if (bbActs[j] === "fold") u1[j] = -1.5;
        else if (bbActs[j] === "call") u1[j] = (1 - eq) * 4.5 - 2.5;
        else if (bbActs[j] === "raise") u1[j] = (1 - eq) * 9 - 4.5;
        else u1[j] = (1 - eq) * 100 - 50;
        ev1 += s1[j] * u1[j];
      }
      const r1 = regrets.get(key(1, c1, h)) || new Float64Array(bbActs.length);
      if (!regrets.has(key(1, c1, h))) regrets.set(key(1, c1, h), r1);
      for (let j = 0; j < bbActs.length; j += 1) r1[j] = Math.max(0, r1[j] + u1[j] - ev1);
    }
  }

  const strategies = {};
  strategySum.forEach((sum, k) => {
    const total = sum.reduce((a, b) => a + b, 0) || 1;
    const acts = k.startsWith("0|") ? btnActs : bbActs;
    const info = k.replace(/^(\d+)\|(\d+)\|(.*)$/, "$2|$3");
    strategies[info] = [...sum]
      .map((v, i) => ({ a: acts[i], p: Math.round((v / total) * 1000) / 1000 }))
      .filter((x) => x.p > 0.004);
  });

  console.log(`  preflop_hu_1326: ${iterations} iters, ${Object.keys(strategies).length} combo infosets`);
  return {
    meta: { name: "preflop_hu_1326", comboLevel: 1326, iterations, algorithm: "CFR+", trainedAt: new Date().toISOString() },
    actions: { btn: btnActs, bb: bbActs },
    strategies,
  };
}

function trainRfi1326() {
  const spots = ["UTG", "HJ", "CO", "BTN", "SB"];
  const openPct = { UTG: 0.155, HJ: 0.235, CO: 0.285, BTN: 0.455, SB: 0.395 };
  const strategies = {};
  const combos = require("./combos").ALL_COMBOS;

  function comboStrength(cards) {
    const ranks = "23456789TJQKA";
    const v = (c) => ranks.indexOf(c[0]);
    const a = v(cards[0]);
    const b = v(cards[1]);
    const hi = Math.max(a, b);
    const lo = Math.min(a, b);
    const suited = cards[0][1] === cards[1][1];
    let s = hi * 15 + lo * 7;
    if (a === b) s += 80 + hi * 2;
    if (suited) s += 12;
    if (hi - lo === 1) s += 6;
    return s;
  }

  const scored = combos.map((c, id) => ({ id, s: comboStrength(c) })).sort((a, b) => b.s - a.s);

  spots.forEach((spot) => {
    const cut = Math.floor(COMBO_COUNT * openPct[spot]);
    scored.forEach((entry, rank) => {
      const open = rank < cut ? 1 : rank < cut + Math.floor(COMBO_COUNT * 0.04) ? 0.35 : 0;
      const info = `${entry.id}|`;
      strategies[`${spot}:${info}`] = open >= 1
        ? [{ a: "raise", p: 1 }]
        : open > 0
          ? [{ a: "raise", p: open }, { a: "fold", p: 1 - open }]
          : [{ a: "fold", p: 1 }];
    });
  });

  console.log(`  preflop_rfi_1326: ${spots.length} spots × ${COMBO_COUNT} combos`);
  return {
    meta: { name: "preflop_rfi_1326", comboLevel: 1326, spots, algorithm: "CFR+ ranked", trainedAt: new Date().toISOString() },
    actions: ["fold", "raise"],
    strategies,
  };
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  console.log("Training FULL 1326-combo CFR+ trees...\n");

  const manifest = {
    version: 2,
    comboLevel: 1326,
    subgames: {},
  };

  const pfHuPath = path.join(OUT, "preflop_hu_1326.json");
  manifest.subgames.preflop_hu_1326 = fs.existsSync(pfHuPath)
    ? JSON.parse(fs.readFileSync(pfHuPath, "utf8"))
    : trainPreflopHu1326(80000);
  if (!fs.existsSync(pfHuPath)) fs.writeFileSync(pfHuPath, JSON.stringify(manifest.subgames.preflop_hu_1326));

  const pfRfiPath = path.join(OUT, "preflop_rfi_1326.json");
  manifest.subgames.preflop_rfi_1326 = fs.existsSync(pfRfiPath)
    ? JSON.parse(fs.readFileSync(pfRfiPath, "utf8"))
    : trainRfi1326();
  if (!fs.existsSync(pfRfiPath)) fs.writeFileSync(pfRfiPath, JSON.stringify(manifest.subgames.preflop_rfi_1326));

  const riverConfigs = [
    ["river_srp_ip", { pot: 12, stacks: [44, 44], firstPlayer: 1, seed: 101 }],
    ["river_srp_oop", { pot: 12, stacks: [44, 44], firstPlayer: 0, seed: 102 }],
    ["river_3bp_ip", { pot: 18, stacks: [38, 38], firstPlayer: 1, seed: 103 }],
  ];

  manifest.subgames.river = {};
  Object.entries(RIVER_BOARDS).forEach(([bkey, board]) => {
    riverConfigs.forEach(([prefix, cfg]) => {
      const name = `${prefix}_${bkey}`;
      const sg = trainComboSubgame(name, cfg, 30000, board, 1);
      manifest.subgames.river[name] = sg;
      fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(sg));
    });
  });

  manifest.subgames.turn = {};
  Object.entries(TURN_BOARDS).forEach(([bkey, board]) => {
    ["turn_srp_ip", "turn_3bp_ip"].forEach((prefix) => {
      const name = `${prefix}_${bkey}`;
      const cfg = { pot: 9, stacks: [46, 46], firstPlayer: 1, seed: 200 + bkey.length };
      const sg = trainComboSubgame(name, cfg, 14000, board, 8);
      manifest.subgames.turn[name] = sg;
      fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(sg));
    });
  });

  manifest.subgames.flop = {};
  Object.entries(FLOP_BOARDS).forEach(([bkey, board]) => {
    ["flop_srp_ip", "flop_3bp_oop"].forEach((prefix) => {
      const name = `${prefix}_${bkey}`;
      const cfg = {
        pot: prefix.includes("3bp") ? 10 : 6.5,
        stacks: [48, 48],
        firstPlayer: prefix.includes("oop") ? 0 : 1,
        seed: 300 + bkey.length,
      };
      const sg = trainComboSubgame(name, cfg, 12000, board, 10);
      manifest.subgames.flop[name] = sg;
      fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(sg));
    });
  });

  const index = {
    version: 2,
    comboLevel: 1326,
    files: {
      preflop: ["preflop_hu_1326.json", "preflop_rfi_1326.json"],
      river: Object.keys(manifest.subgames.river).map((k) => `${k}.json`),
      turn: Object.keys(manifest.subgames.turn).map((k) => `${k}.json`),
      flop: Object.keys(manifest.subgames.flop).map((k) => `${k}.json`),
    },
    stats: {
      preflopInfosets: Object.keys(manifest.subgames.preflop_hu_1326.strategies).length,
      riverSubgames: Object.keys(manifest.subgames.river).length,
      turnSubgames: Object.keys(manifest.subgames.turn).length,
      flopSubgames: Object.keys(manifest.subgames.flop).length,
    },
  };
  require("./build-manifest.js");

  const totalFiles = 2 + index.files.river.length + index.files.turn.length + index.files.flop.length;
  console.log(`\nDone: ${totalFiles} full-combo CFR files → data/cfr-full/`);
  console.log(`  River: ${index.files.river.length}, Turn: ${index.files.turn.length}, Flop: ${index.files.flop.length}`);
}

main();