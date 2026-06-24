#!/usr/bin/env node
/** Train only missing flop 1326-combo subgames */
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "../../data/cfr-full");
const { FLOP_BOARDS } = require("./boards");

const { ComboCFR } = require("./cfr-combo");
const { sampleComboPair, ALL_COMBOS } = require("./combos");

const MISSING = ["low765", "Aq5ss", "KJTss", "Q72r", "J84r", "A96r"];

function mulberry32(seed) {
  return function rand() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  console.log("Training remaining flop subgames (1326 combo)...\n");

  const results = {};
  for (const bkey of MISSING) {
    const board = FLOP_BOARDS[bkey];
    for (const prefix of ["flop_srp_ip", "flop_3bp_oop"]) {
      const name = `${prefix}_${bkey}`;
      const cfg = {
        pot: prefix.includes("3bp") ? 10 : 6.5,
        stacks: [48, 48],
        firstPlayer: prefix.includes("oop") ? 0 : 1,
        seed: 400 + bkey.length + prefix.length,
      };
      const outPath = path.join(OUT, `${name}.json`);
      if (fs.existsSync(outPath)) {
        console.log(`  ${name}: skip`);
        results[name] = JSON.parse(fs.readFileSync(outPath, "utf8"));
        continue;
      }

      const rng = mulberry32(cfg.seed);
      const cfr = new ComboCFR({ ...cfg, board, mcSamples: 8 });
      const blocked = new Set(board);
      const t0 = Date.now();
      const iterations = 10000;

      cfr.train(iterations, (r) => {
        for (let t = 0; t < 80; t += 1) {
          const [c0, c1] = sampleComboPair(r, blocked);
          const cards = [...ALL_COMBOS[c0], ...ALL_COMBOS[c1]];
          if (!cards.some((c) => blocked.has(c))) return [c0, c1];
        }
        return [0, 1];
      }, rng);

      const actionSet = new Set();
      const walk = (st) => {
        cfr.actions(st).forEach((a) => actionSet.add(a));
        cfr.actions(st).forEach((a) => {
          const n = cfr.apply(st, a);
          if (!n.terminal && cfr.actions(n).length) walk(n);
        });
      };
      walk(cfr.initialState());
      const actions = [...actionSet];
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
      results[name] = sg;
      console.log(`  ${name}: ${iterations} iters, ${Object.keys(strategies).length} infosets, ${Date.now() - t0}ms`);
    }
  }

  require("./build-manifest.js");
  console.log("\nRemaining flop training complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});