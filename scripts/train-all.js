#!/usr/bin/env node
/**
 * Offline CFR+ training for abstracted Hold'em subgames.
 * Generates data/cfr/*.json consumed by the browser solver.
 */
const fs = require("fs");
const path = require("path");
const { EQUITY_MATRIX, BUCKET_NAMES, sampleBuckets, boardCategory } = require("./lib/buckets");

const OUT = path.join(__dirname, "../data/cfr");

function mulberry32(seed) {
  return function rand() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class BettingCFR {
  constructor({ pot, stacks, firstPlayer = 0, maxRaises = 2 }) {
    this.pot0 = pot;
    this.stacks0 = stacks;
    this.firstPlayer = firstPlayer;
    this.maxRaises = maxRaises;
    this.regrets = new Map();
    this.strategySum = new Map();
    this.iterations = 0;
  }

  key(player, bucket, history) {
    return `${player}|${bucket}|${history}`;
  }

  initialState() {
    return {
      history: "",
      bets: [0, 0],
      stacks: [...this.stacks0],
      pot: this.pot0,
      raises: 0,
      player: this.firstPlayer,
      acted: [false, false],
    };
  }

  actions(state) {
    const { history, bets, stacks, player, raises, acted } = state;
    const facing = Math.max(bets[0], bets[1]) - bets[player];
    const can = stacks[player] > 0;

    if (history.endsWith("/fold")) return [];

    const parts = history ? history.split("/") : [];
    const last = parts.at(-1) || "";

    if (last === "call" && parts.length >= 2) return [];
    if (parts.length >= 2 && parts.at(-1) === "check" && parts.at(-2) === "check") return [];

    if (facing > 0) {
      const out = ["fold", "call"];
      if (can && raises < this.maxRaises && stacks[player] > facing) out.push("raise");
      return out;
    }

    const out = ["check"];
    if (can && raises < this.maxRaises) out.push("bet33", "bet66", "bet100");
    return out;
  }

  apply(state, action) {
    const s = {
      ...state,
      bets: [...state.bets],
      stacks: [...state.stacks],
      history: state.history ? `${state.history}/${action}` : action,
    };
    const p = s.player;
    const facing = Math.max(s.bets[0], s.bets[1]) - s.bets[p];

    if (action === "fold") return { ...s, terminal: true, folder: p };
    if (action === "check") {
      s.acted[p] = true;
      s.player = 1 - p;
      return s;
    }
    if (action === "call") {
      const pay = Math.min(facing, s.stacks[p]);
      s.stacks[p] -= pay;
      s.bets[p] += pay;
      s.pot += pay;
      return { ...s, terminal: true, showdown: true };
    }
    if (action === "raise") {
      const target = Math.max(s.bets[0], s.bets[1]) + Math.round(s.pot * 0.66);
      const pay = Math.min(target - s.bets[p], s.stacks[p]);
      s.stacks[p] -= pay;
      s.bets[p] += pay;
      s.pot += pay;
      s.raises += 1;
      s.player = 1 - p;
      s.acted = [false, false];
      return s;
    }
    const frac = Number(action.slice(3)) / 100;
    const target = s.bets[p] + Math.round(s.pot * frac);
    const pay = Math.min(Math.max(0, target - s.bets[p]), s.stacks[p]);
    s.stacks[p] -= pay;
    s.bets[p] += pay;
    s.pot += pay;
    s.raises += 1;
    s.player = 1 - p;
    s.acted = [false, false];
    return s;
  }

  payoff(state, buckets, player) {
    const invested = [this.stacks0[0] - state.stacks[0], this.stacks0[1] - state.stacks[1]];
    if (state.folder != null) {
      const f = state.folder;
      const win = f === 0 ? 1 : 0;
      return player === win ? state.pot - invested[player] : -invested[player];
    }
    const eq = EQUITY_MATRIX[buckets[0]][buckets[1]];
    const share = player === 0 ? eq : 1 - eq;
    return share * state.pot - invested[player];
  }

  strategy(player, bucket, history, actions) {
    const k = this.key(player, bucket, history);
    if (!this.regrets.has(k)) this.regrets.set(k, new Float64Array(actions.length));
    const regrets = this.regrets.get(k);
    const strat = new Float64Array(actions.length);
    let n = 0;
    for (let i = 0; i < actions.length; i += 1) {
      strat[i] = regrets[i] > 0 ? regrets[i] : 0;
      n += strat[i];
    }
    if (n < 1e-9) {
      const u = 1 / actions.length;
      for (let i = 0; i < actions.length; i += 1) strat[i] = u;
    } else {
      for (let i = 0; i < actions.length; i += 1) strat[i] /= n;
    }
    if (!this.strategySum.has(k)) this.strategySum.set(k, new Float64Array(actions.length));
    const sum = this.strategySum.get(k);
    for (let i = 0; i < actions.length; i += 1) sum[i] += strat[i];
    return strat;
  }

  cfr(state, buckets, reach) {
    const acts = this.actions(state);
    if (!acts.length || state.terminal) {
      return [this.payoff(state, buckets, 0), this.payoff(state, buckets, 1)];
    }

    const p = state.player;
    const strat = this.strategy(p, buckets[p], state.history, acts);
    const util = new Float64Array(acts.length);
    const nodeUtil = [0, 0];

    for (let i = 0; i < acts.length; i += 1) {
      const next = this.apply(state, acts[i]);
      const child = this.cfr(next, buckets, reach);
      util[i] = child[p];
      nodeUtil[p] += strat[i] * util[i];
      nodeUtil[1 - p] += strat[i] * child[1 - p];
    }

    const opp = 1 - p;
    const oppReach = reach[opp];
    const regrets = this.regrets.get(this.key(p, buckets[p], state.history));
    for (let i = 0; i < acts.length; i += 1) {
      regrets[i] = Math.max(0, regrets[i] + oppReach * (util[i] - nodeUtil[p]));
    }
    return nodeUtil;
  }

  train(iterations, street, rng) {
    for (let t = 0; t < iterations; t += 1) {
      const buckets = sampleBuckets(street, rng);
      this.cfr(this.initialState(), buckets, [1, 1]);
      this.iterations += 1;
    }
  }

  exportStrategies(actionIndex) {
    const strategies = {};
    this.strategySum.forEach((sum, key) => {
      const total = sum.reduce((a, b) => a + b, 0) || 1;
      const parts = key.split("|");
      const info = `${parts[1]}|${parts[2]}`;
      strategies[info] = [...sum].map((v, i) => ({
        a: actionIndex[i] || `i${i}`,
        p: Math.round((v / total) * 1000) / 1000,
      })).filter((x) => x.p > 0.008);
    });
    return strategies;
  }
}

function trainSubgame(name, config, iterations, street) {
  const rng = mulberry32(config.seed || 42);
  const cfr = new BettingCFR(config);
  const t0 = Date.now();
  cfr.train(iterations, street, rng);
  const sample = cfr.initialState();
  const actionSet = new Set();
  const walk = (st) => {
    const acts = cfr.actions(st);
    acts.forEach((a) => actionSet.add(a));
    acts.forEach((a) => {
      const n = cfr.apply(st, a);
      if (!n.terminal && cfr.actions(n).length) walk(n);
    });
  };
  walk(sample);
  const actionList = [...actionSet];
  const strategies = cfr.exportStrategies(actionList);
  console.log(`  ${name}: ${cfr.iterations} iters, ${Object.keys(strategies).length} infosets, ${Date.now() - t0}ms`);
  return {
    meta: {
      name,
      iterations: cfr.iterations,
      street,
      potBb: config.pot,
      stacksBb: config.stacks,
      firstPlayer: config.firstPlayer,
      algorithm: "CFR+",
      buckets: BUCKET_NAMES,
      trainedAt: new Date().toISOString(),
    },
    actions: actionList,
    strategies,
  };
}

function trainPreflopHu(iterations = 80000) {
  const rng = mulberry32(77);
  const buckets = 20;
  const regrets = new Map();
  const strategySum = new Map();
  const actionsBtn = ["fold", "raise22", "raise30"];
  const actionsBb = ["fold", "call", "raise", "jam"];

  function key(p, b, h) {
    return `${p}|${b}|${h}`;
  }

  function strat(p, b, h, acts) {
    const k = key(p, b, h);
    if (!regrets.has(k)) regrets.set(k, new Float64Array(acts.length));
    const r = regrets.get(k);
    const s = new Float64Array(acts.length);
    let n = 0;
    for (let i = 0; i < acts.length; i += 1) { s[i] = Math.max(0, r[i]); n += s[i]; }
    if (n < 1e-9) { const u = 1 / acts.length; for (let i = 0; i < acts.length; i += 1) s[i] = u; }
    else { for (let i = 0; i < acts.length; i += 1) s[i] /= n; }
    if (!strategySum.has(k)) strategySum.set(k, new Float64Array(acts.length));
    const sum = strategySum.get(k);
    for (let i = 0; i < acts.length; i += 1) sum[i] += s[i];
    return s;
  }

  function util(btnB, bbB, action, btnStack = 100, bbStack = 100) {
    if (action === "btn_fold") return [-0.5, 0.5];
    if (action === "bb_fold_open") return [1.5, -1.5];
    if (action === "btn_call_3bet") return [0, 0];
    const matrix = EQUITY_MATRIX;
    const eq = matrix[btnB % 8][bbB % 8];
    const pot = 6;
    return [(eq * pot) - 3, ((1 - eq) * pot) - 3];
  }

  for (let t = 0; t < iterations; t += 1) {
    const btnB = Math.floor(rng() * buckets);
    const bbB = Math.floor(rng() * buckets);
    const btnActs = actionsBtn;
    const s0 = strat(0, btnB, "", btnActs);
    let u0 = 0;
    const util0 = new Float64Array(btnActs.length);
    for (let i = 0; i < btnActs.length; i += 1) {
      const a = btnActs[i];
      if (a === "fold") util0[i] = -0.5;
      else {
        const bbActs = actionsBb;
        const s1 = strat(1, bbB, a, bbActs);
        let ev = 0;
        for (let j = 0; j < bbActs.length; j += 1) {
          let pay = 0;
          if (bbActs[j] === "fold") pay = 1.5;
          else if (bbActs[j] === "call") pay = util(btnB, bbB, "call")[0];
          else if (bbActs[j] === "raise") pay = util(btnB, bbB, "3bet")[0] * 0.92;
          else pay = util(btnB, bbB, "jam")[0] * 0.85;
          ev += s1[j] * pay;
        }
        util0[i] = ev;
      }
      u0 += s0[i] * util0[i];
    }
    const r0 = regrets.get(key(0, btnB, "")) || new Float64Array(btnActs.length);
    if (!regrets.has(key(0, btnB, ""))) regrets.set(key(0, btnB, ""), r0);
    for (let i = 0; i < btnActs.length; i += 1) r0[i] = Math.max(0, r0[i] + util0[i] - u0);
  }

  const strategies = {};
  strategySum.forEach((sum, k) => {
    const total = sum.reduce((a, b) => a + b, 0) || 1;
    const acts = k.startsWith("0|") ? actionsBtn : actionsBb;
    const outKey = k.replace(/^(\d+)\|(\d+)\|(.*)$/, "$1:$2|$3");
    strategies[outKey] = [...sum]
      .map((v, i) => ({ a: acts[i], p: Math.round((v / total) * 1000) / 1000 }))
      .filter((x) => x.p > 0.01);
  });

  console.log(`  preflop_hu: ${iterations} iters, ${Object.keys(strategies).length} infosets`);
  return {
    meta: { name: "preflop_hu", iterations, algorithm: "CFR+", buckets: buckets, trainedAt: new Date().toISOString() },
    actions: { btn: actionsBtn, bb: actionsBb },
    strategies,
  };
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  console.log("Training offline CFR+ subgames...");

  const configs = [
    ["river_srp_ip", { pot: 12, stacks: [44, 44], firstPlayer: 1, seed: 11 }, 60000, "river"],
    ["river_srp_oop", { pot: 12, stacks: [44, 44], firstPlayer: 0, seed: 12 }, 60000, "river"],
    ["river_3bp_ip", { pot: 18, stacks: [38, 38], firstPlayer: 1, seed: 13 }, 50000, "river"],
    ["river_3bp_oop", { pot: 18, stacks: [38, 38], firstPlayer: 0, seed: 14 }, 50000, "river"],
    ["turn_srp_ip", { pot: 9, stacks: [46, 46], firstPlayer: 1, seed: 21 }, 45000, "turn"],
    ["turn_srp_oop", { pot: 9, stacks: [46, 46], firstPlayer: 0, seed: 22 }, 45000, "turn"],
    ["turn_3bp_ip", { pot: 9, stacks: [46, 46], firstPlayer: 1, seed: 23 }, 45000, "turn"],
    ["turn_3bp_oop", { pot: 9, stacks: [46, 46], firstPlayer: 0, seed: 24 }, 45000, "turn"],
    ["flop_srp_ip", { pot: 6.5, stacks: [48, 48], firstPlayer: 1, seed: 31 }, 40000, "flop"],
    ["flop_srp_oop", { pot: 6.5, stacks: [48, 48], firstPlayer: 0, seed: 32 }, 40000, "flop"],
    ["flop_3bp_ip", { pot: 10, stacks: [42, 42], firstPlayer: 1, seed: 33 }, 40000, "flop"],
    ["flop_3bp_oop", { pot: 10, stacks: [42, 42], firstPlayer: 0, seed: 34 }, 40000, "flop"],
  ];

  const bundlePath = path.join(OUT, "bundle.json");
  const bundle = fs.existsSync(bundlePath)
    ? JSON.parse(fs.readFileSync(bundlePath, "utf8"))
    : { version: 2, subgames: {} };

  configs.forEach(([name, cfg, iters, street]) => {
    const filePath = path.join(OUT, `${name}.json`);
    if (fs.existsSync(filePath)) {
      bundle.subgames[name] = JSON.parse(fs.readFileSync(filePath, "utf8"));
      console.log(`  ${name}: skip (exists)`);
      return;
    }
    bundle.subgames[name] = trainSubgame(name, cfg, iters, street);
    fs.writeFileSync(filePath, JSON.stringify(bundle.subgames[name]));
  });

  const pfPath = path.join(OUT, "preflop_hu.json");
  if (fs.existsSync(pfPath)) {
    bundle.subgames.preflop_hu = JSON.parse(fs.readFileSync(pfPath, "utf8"));
  } else {
    bundle.subgames.preflop_hu = trainPreflopHu(80000);
    fs.writeFileSync(pfPath, JSON.stringify(bundle.subgames.preflop_hu));
  }

  ["flop_mw_srp", "flop_mw_3bp"].forEach((name) => {
    const filePath = path.join(OUT, `${name}.json`);
    if (fs.existsSync(filePath)) bundle.subgames[name] = JSON.parse(fs.readFileSync(filePath, "utf8"));
  });

  bundle.version = 2;
  fs.writeFileSync(bundlePath, JSON.stringify(bundle));

  console.log(`\nWrote ${Object.keys(bundle.subgames).length} CFR files to data/cfr/`);
}

main();