#!/usr/bin/env node
/**
 * 3-way 8-bucket flop CFR for multiway pots → data/cfr/flop_mw_*.json
 */
const fs = require("fs");
const path = require("path");
const { EQUITY_MATRIX, BUCKET_NAMES } = require("./lib/buckets");

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

function sampleBuckets(rng) {
  const w = [0.05, 0.09, 0.13, 0.17, 0.16, 0.16, 0.13, 0.11];
  const pick = () => {
    let roll = rng();
    for (let i = 0; i < w.length; i += 1) {
      roll -= w[i];
      if (roll <= 0) return i;
    }
    return 7;
  };
  return [pick(), pick(), pick()];
}

function multiwayShowdownEquity(buckets, player) {
  const h = buckets[player];
  const others = [0, 1, 2].filter((i) => i !== player);
  const eqA = EQUITY_MATRIX[h][buckets[others[0]]];
  const eqB = EQUITY_MATRIX[h][buckets[others[1]]];
  return Math.min(eqA, eqB) * 0.88;
}

class MultiwayCFR {
  constructor({ pot, stacks, firstPlayer = 0, maxRaises = 1 }) {
    this.n = 3;
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
      bets: [0, 0, 0],
      stacks: [...this.stacks0],
      pot: this.pot0,
      active: [true, true, true],
      player: this.firstPlayer,
      raises: 0,
      toMatch: 0,
      acted: 0,
    };
  }

  activeCount(state) {
    return state.active.filter(Boolean).length;
  }

  nextPlayer(state, from) {
    for (let i = 1; i <= this.n; i += 1) {
      const p = (from + i) % this.n;
      if (state.active[p] && state.stacks[p] > 0) return p;
    }
    return from;
  }

  actions(state) {
    if (this.activeCount(state) <= 1) return [];
    const { history, bets, stacks, player, raises, active, toMatch } = state;
    if (!active[player]) return [];

    const facing = toMatch - bets[player];
    const parts = history ? history.split("/") : [];
    const last = parts.at(-1) || "";

    if (last === "call" && state.acted >= this.activeCount(state) && facing === 0) return [];
    if (parts.length >= 2 && last === "check" && parts.at(-2) === "check" && facing === 0 && state.acted >= this.activeCount(state)) return [];

    if (facing > 0) {
      const out = ["fold", "call"];
      if (stacks[player] > facing && raises < this.maxRaises) out.push("raise");
      return out;
    }
    return ["check", "bet33", "bet66"];
  }

  apply(state, action) {
    const s = {
      ...state,
      bets: [...state.bets],
      stacks: [...state.stacks],
      active: [...state.active],
      history: state.history ? `${state.history}/${action}` : action,
    };
    const p = s.player;

    if (action === "fold") {
      s.active[p] = false;
      if (this.activeCount(s) === 1) {
        const win = s.active.findIndex(Boolean);
        return { ...s, terminal: true, winner: win };
      }
      s.player = this.nextPlayer(s, p);
      s.acted = 0;
      return s;
    }

    if (action === "check") {
      s.acted += 1;
      s.player = this.nextPlayer(s, p);
      if (s.acted >= this.activeCount(s) && s.toMatch === 0) {
        return { ...s, terminal: true, showdown: true };
      }
      return s;
    }

    if (action === "call") {
      const pay = Math.min(s.toMatch - s.bets[p], s.stacks[p]);
      s.stacks[p] -= pay;
      s.bets[p] += pay;
      s.pot += pay;
      s.acted += 1;
      s.player = this.nextPlayer(s, p);
      if (s.acted >= this.activeCount(s)) return { ...s, terminal: true, showdown: true };
      return s;
    }

    if (action === "raise") {
      const target = s.toMatch + Math.round(s.pot * 0.66);
      const pay = Math.min(target - s.bets[p], s.stacks[p]);
      s.stacks[p] -= pay;
      s.bets[p] += pay;
      s.pot += pay;
      s.toMatch = Math.max(s.toMatch, s.bets[p]);
      s.raises += 1;
      s.acted = 1;
      s.player = this.nextPlayer(s, p);
      return s;
    }

    const frac = Number(action.slice(3)) / 100;
    const target = s.bets[p] + Math.round(s.pot * frac);
    const pay = Math.min(Math.max(0, target - s.bets[p]), s.stacks[p]);
    s.stacks[p] -= pay;
    s.bets[p] += pay;
    s.pot += pay;
    s.toMatch = Math.max(s.toMatch, s.bets[p]);
    s.raises += 1;
    s.acted = 1;
    s.player = this.nextPlayer(s, p);
    return s;
  }

  payoff(state, buckets, player) {
    const invested = this.stacks0[player] - state.stacks[player];
    if (state.winner != null) {
      return state.winner === player ? state.pot - invested : -invested;
    }
    if (!state.active[player]) return -invested;
    const share = multiwayShowdownEquity(buckets, player);
    const activeInvested = [0, 1, 2].filter((i) => state.active[i]).length;
    const potShare = activeInvested > 0 ? share * state.pot : 0;
    return potShare - invested;
  }

  strategy(player, bucket, history, acts) {
    const k = this.key(player, bucket, history);
    if (!this.regrets.has(k)) this.regrets.set(k, new Float64Array(acts.length));
    const regrets = this.regrets.get(k);
    const strat = new Float64Array(acts.length);
    let n = 0;
    for (let i = 0; i < acts.length; i += 1) {
      strat[i] = Math.max(0, regrets[i]);
      n += strat[i];
    }
    if (n < 1e-9) {
      const u = 1 / acts.length;
      for (let i = 0; i < acts.length; i += 1) strat[i] = u;
    } else {
      for (let i = 0; i < acts.length; i += 1) strat[i] /= n;
    }
    if (!this.strategySum.has(k)) this.strategySum.set(k, new Float64Array(acts.length));
    const sum = this.strategySum.get(k);
    for (let i = 0; i < acts.length; i += 1) sum[i] += strat[i];
    return strat;
  }

  cfr(state, buckets, reach) {
    const acts = this.actions(state);
    if (!acts.length || state.terminal) {
      return [this.payoff(state, buckets, 0), this.payoff(state, buckets, 1), this.payoff(state, buckets, 2)];
    }

    const p = state.player;
    const strat = this.strategy(p, buckets[p], state.history, acts);
    const util = new Float64Array(acts.length);
    const nodeUtil = [0, 0, 0];

    for (let i = 0; i < acts.length; i += 1) {
      const next = this.apply(state, acts[i]);
      const child = this.cfr(next, buckets, reach);
      util[i] = child[p];
      for (let j = 0; j < 3; j += 1) nodeUtil[j] += strat[i] * child[j];
    }

    const regrets = this.regrets.get(this.key(p, buckets[p], state.history));
    const oppReach = reach.reduce((a, r, idx) => (idx === p ? a : a * r), 1);
    for (let i = 0; i < acts.length; i += 1) {
      regrets[i] = Math.max(0, regrets[i] + oppReach * (util[i] - nodeUtil[p]));
    }
    return nodeUtil;
  }

  train(iterations, rng) {
    for (let t = 0; t < iterations; t += 1) {
      const buckets = sampleBuckets(rng);
      this.cfr(this.initialState(), buckets, [1, 1, 1]);
      this.iterations += 1;
    }
  }

  exportStrategies(actionList) {
    const strategies = {};
    this.strategySum.forEach((sum, key) => {
      const total = sum.reduce((a, b) => a + b, 0) || 1;
      const parts = key.split("|");
      const info = `${parts[1]}|${parts[2]}`;
      strategies[info] = [...sum]
        .map((v, i) => ({ a: actionList[i] || `i${i}`, p: Math.round((v / total) * 1000) / 1000 }))
        .filter((x) => x.p > 0.008);
    });
    return strategies;
  }
}

function trainMwSubgame(name, config, iterations) {
  const rng = mulberry32(config.seed || 42);
  const cfr = new MultiwayCFR(config);
  const t0 = Date.now();
  cfr.train(iterations, rng);

  const actionSet = new Set();
  const walk = (st) => {
    const acts = cfr.actions(st);
    acts.forEach((a) => actionSet.add(a));
    acts.forEach((a) => {
      const n = cfr.apply(st, a);
      if (!n.terminal && cfr.actions(n).length) walk(n);
    });
  };
  walk(cfr.initialState());
  const actionList = [...actionSet];
  const strategies = cfr.exportStrategies(actionList);
  console.log(`  ${name}: ${cfr.iterations} iters, ${Object.keys(strategies).length} infosets, ${Date.now() - t0}ms`);

  return {
    meta: {
      name,
      iterations: cfr.iterations,
      street: "flop",
      players: 3,
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

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  console.log("Training 3-way multiway flop CFR...\n");

  const jobs = [
    ["flop_mw_srp", { pot: 9.5, stacks: [44, 44, 44], firstPlayer: 0, seed: 81 }, 35000],
    ["flop_mw_3bp", { pot: 14, stacks: [38, 38, 38], firstPlayer: 0, seed: 82 }, 35000],
  ];

  const bundlePath = path.join(OUT, "bundle.json");
  const bundle = fs.existsSync(bundlePath)
    ? JSON.parse(fs.readFileSync(bundlePath, "utf8"))
    : { version: 1, subgames: {} };

  jobs.forEach(([name, cfg, iters]) => {
    const sg = trainMwSubgame(name, cfg, iters);
    bundle.subgames[name] = sg;
    fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(sg));
  });

  bundle.version = 2;
  bundle.multiway = true;
  fs.writeFileSync(bundlePath, JSON.stringify(bundle));
  console.log(`\nWrote ${jobs.length} multiway CFR files + updated bundle.json`);
}

main();