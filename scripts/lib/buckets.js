/**
 * Hand/board abstractions + bucket-vs-bucket showdown equity matrices.
 */

const BUCKET_NAMES = ["nuts", "strong", "good", "medium", "weak", "draw", "bluff", "air"];

function buildEquityMatrix() {
  const m = Array.from({ length: 8 }, () => new Float64Array(8));
  const base = [
    [0.5, 0.82, 0.88, 0.92, 0.95, 0.75, 0.9, 0.98],
    [0.18, 0.5, 0.72, 0.8, 0.86, 0.62, 0.78, 0.92],
    [0.12, 0.28, 0.5, 0.66, 0.74, 0.55, 0.68, 0.85],
    [0.08, 0.2, 0.34, 0.5, 0.6, 0.48, 0.55, 0.72],
    [0.05, 0.14, 0.26, 0.4, 0.5, 0.42, 0.45, 0.62],
    [0.25, 0.38, 0.45, 0.52, 0.58, 0.5, 0.48, 0.55],
    [0.1, 0.22, 0.32, 0.45, 0.55, 0.52, 0.5, 0.58],
    [0.02, 0.08, 0.15, 0.28, 0.38, 0.45, 0.42, 0.5],
  ];
  for (let i = 0; i < 8; i += 1) {
    for (let j = 0; j < 8; j += 1) {
      m[i][j] = base[i][j];
    }
  }
  return m;
}

const EQUITY_MATRIX = buildEquityMatrix();

function bucketFromPercentile(p) {
  if (p >= 0.94) return 0;
  if (p >= 0.82) return 1;
  if (p >= 0.68) return 2;
  if (p >= 0.52) return 3;
  if (p >= 0.38) return 4;
  if (p >= 0.24) return 5;
  if (p >= 0.12) return 6;
  return 7;
}

function bucketWeightsForStreet(street) {
  const w = [0.06, 0.1, 0.14, 0.18, 0.16, 0.14, 0.12, 0.1];
  if (street === "flop") w[5] += 0.06;
  if (street === "turn") w[5] += 0.03;
  return w;
}

function sampleBuckets(street, rng) {
  const weights = bucketWeightsForStreet(street);
  const pick = () => {
    let roll = rng();
    for (let i = 0; i < weights.length; i += 1) {
      roll -= weights[i];
      if (roll <= 0) return i;
    }
    return 7;
  };
  return [pick(), pick()];
}

function boardCategory(cat) {
  const map = { dry_high: 0, dry_low: 1, wet: 2, paired: 3, monotone: 4 };
  return map[cat] ?? 0;
}

module.exports = {
  BUCKET_NAMES,
  EQUITY_MATRIX,
  bucketFromPercentile,
  bucketWeightsForStreet,
  sampleBuckets,
  boardCategory,
};