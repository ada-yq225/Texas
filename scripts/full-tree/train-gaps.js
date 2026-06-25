#!/usr/bin/env node
/**
 * Train missing 1326-combo CFR subgames (OOP SRP, 3bp IP/OOP gaps).
 */
const fs = require("fs");
const path = require("path");
const { ComboCFR } = require("./cfr-combo");
const { sampleComboPair, ALL_COMBOS } = require("./combos");
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

function trainOne(name, cfg, iterations, board, mcSamples) {
  const outPath = path.join(OUT, `${name}.json`);
  if (fs.existsSync(outPath)) {
    console.log(`  ${name}: skip`);
    return JSON.parse(fs.readFileSync(outPath, "utf8"));
  }

  const rng = mulberry32(cfg.seed || 99);
  const cfr = new ComboCFR({ ...cfg, board, mcSamples });
  const blocked = new Set(board);
  const t0 = Date.now();

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
  const sg = {
    meta: {
      name,
      comboLevel: 1326,
      iterations: cfr.iterations,
      board,
      potBb: cfg.pot,
      stacksBb: cfg.stacks,
      firstPlayer: cfg.firstPlayer,
      algorithm: "CFR+",
      trainedAt: new Date().toISOString(),
    },
    actions,
    strategies,
  };
  fs.writeFileSync(outPath, JSON.stringify(sg));
  console.log(`  ${name}: ${iterations} iters, ${Object.keys(strategies).length} infosets, ${Date.now() - t0}ms`);
  return sg;
}

const GAP_JOBS = [
  {
    street: "flop",
    boards: FLOP_BOARDS,
    prefixes: [
      ["flop_srp_oop", { pot: 6.5, stacks: [48, 48], firstPlayer: 0, seedBase: 500 }],
      ["flop_3bp_ip", { pot: 10, stacks: [42, 42], firstPlayer: 1, seedBase: 520 }],
    ],
    iterations: 5000,
    mcSamples: 4,
  },
  {
    street: "turn",
    boards: TURN_BOARDS,
    prefixes: [
      ["turn_srp_oop", { pot: 9, stacks: [46, 46], firstPlayer: 0, seedBase: 600 }],
      ["turn_3bp_oop", { pot: 9, stacks: [46, 46], firstPlayer: 0, seedBase: 620 }],
    ],
    iterations: 6000,
    mcSamples: 4,
  },
  {
    street: "river",
    boards: RIVER_BOARDS,
    prefixes: [
      ["river_3bp_oop", { pot: 18, stacks: [38, 38], firstPlayer: 0, seedBase: 700 }],
    ],
    iterations: 12000,
    mcSamples: 1,
  },
];

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  console.log("Training gap CFR subgames (1326 combo)...\n");

  GAP_JOBS.forEach((job) => {
    console.log(`[${job.street}]`);
    Object.entries(job.boards).forEach(([bkey, board]) => {
      job.prefixes.forEach(([prefix, cfg]) => {
        const name = `${prefix}_${bkey}`;
        trainOne(
          name,
          { ...cfg, seed: cfg.seedBase + bkey.length + prefix.length },
          job.iterations,
          board,
          job.mcSamples,
        );
      });
    });
    console.log("");
  });

  require("./build-manifest.js");
  console.log("Gap training complete.");
}

main();