#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "../../data/cfr-full");
const files = fs.readdirSync(OUT).filter((f) => f.endsWith(".json") && f !== "manifest.json");

const manifest = {
  version: 2,
  comboLevel: 1326,
  files: {
    preflop: files.filter((f) => f.startsWith("preflop_")),
    river: files.filter((f) => f.startsWith("river_")),
    turn: files.filter((f) => f.startsWith("turn_")),
    flop: files.filter((f) => f.startsWith("flop_")),
  },
  stats: {
    totalFiles: files.length,
    preflop: files.filter((f) => f.startsWith("preflop_")).length,
    river: files.filter((f) => f.startsWith("river_")).length,
    turn: files.filter((f) => f.startsWith("turn_")).length,
    flop: files.filter((f) => f.startsWith("flop_")).length,
    complete: files.length >= 60,
  },
  generatedAt: new Date().toISOString(),
};

fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`manifest.json written (${files.length} strategy files)`);