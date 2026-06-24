/**
 * CFR+ trainer for abstracted 2-player zero-sum betting subgames.
 */
class CfrPlusTrainer {
  constructor(actionsByNode, utilityFn, bucketCount = 8) {
    this.actionsByNode = actionsByNode;
    this.utility = utilityFn;
    this.bucketCount = bucketCount;
    this.regretSum = new Map();
    this.strategySum = new Map();
    this.iterations = 0;
  }

  infoKey(player, bucket, history) {
    return `p${player}:b${bucket}:${history}`;
  }

  getStrategy(player, bucket, history) {
    const key = this.infoKey(player, bucket, history);
    const actions = this.actionsByNode(history, player);
    const n = actions.length;
    if (!n) return [];
    if (!this.regretSum.has(key)) this.regretSum.set(key, new Float64Array(n));

    const regrets = this.regretSum.get(key);
    const strat = new Float64Array(n);
    let normal = 0;
    for (let i = 0; i < n; i += 1) {
      strat[i] = regrets[i] > 0 ? regrets[i] : 0;
      normal += strat[i];
    }
    if (normal <= 1e-12) {
      const u = 1 / n;
      for (let i = 0; i < n; i += 1) strat[i] = u;
    } else {
      for (let i = 0; i < n; i += 1) strat[i] /= normal;
    }

    if (!this.strategySum.has(key)) this.strategySum.set(key, new Float64Array(n));
    const sum = this.strategySum.get(key);
    for (let i = 0; i < n; i += 1) sum[i] += strat[i];
    return strat;
  }

  averageStrategy() {
    const out = {};
    this.strategySum.forEach((sum, key) => {
      const total = sum.reduce((a, b) => a + b, 0) || 1;
      out[key] = [...sum].map((v) => Math.round((v / total) * 1000) / 1000);
    });
    return out;
  }

  traverse(history, buckets, pot, stacks, bets, player, reach0, reach1) {
    const actions = this.actionsByNode(history, player);
    if (!actions.length) {
      return this.utility(buckets, pot, stacks, bets, history);
    }

    const strat = this.getStrategy(player, buckets[player], history);
    const key = this.infoKey(player, buckets[player], history);
    const regrets = this.regretSum.get(key);
    const util = new Float64Array(actions.length);
    let nodeUtil = 0;

    for (let i = 0; i < actions.length; i += 1) {
      const next = this.applyAction(history, actions[i], pot, stacks, bets, player);
      const opp = 1 - player;
      util[i] = this.traverse(
        next.history,
        buckets,
        next.pot,
        next.stacks,
        next.bets,
        opp,
        player === 0 ? reach0 * strat[i] : reach0,
        player === 1 ? reach1 * strat[i] : reach1,
      )[player];
      nodeUtil += strat[i] * util[i];
    }

    const oppReach = player === 0 ? reach1 : reach0;
    for (let i = 0; i < actions.length; i += 1) {
      const regret = (util[i] - nodeUtil) * oppReach;
      regrets[i] = Math.max(0, regrets[i] + regret);
    }
    return [player === 0 ? nodeUtil : -nodeUtil, player === 1 ? nodeUtil : -nodeUtil];
  }

  applyAction(history, action, pot, stacks, bets, player) {
    const h = history ? `${history}/${action}` : action;
    const s = [...stacks];
    const b = [...bets];
    let p = pot;

    if (action === "fold") {
      return { history: h, pot: p, stacks: s, bets: b, terminal: true };
    }
    if (action === "check") {
      return { history: h, pot: p, stacks: s, bets: b };
    }
    if (action === "call") {
      const pay = Math.max(0, Math.max(b[0], b[1]) - b[player]);
      s[player] -= pay;
      b[player] += pay;
      p += pay;
      return { history: h, pot: p, stacks: s, bets: b, showdown: true };
    }

    const sizeMatch = action.match(/^bet(\d+)$/);
    if (sizeMatch) {
      const frac = Number(sizeMatch[1]) / 100;
      const target = Math.round(p * frac);
      const pay = Math.max(0, target - b[player]);
      s[player] -= pay;
      b[player] += pay;
      p += pay;
      return { history: h, pot: p, stacks: s, bets: b };
    }

    if (action === "raise") {
      const facing = Math.max(b[0], b[1]);
      const raiseTo = Math.round(facing + p * 0.66);
      const pay = Math.max(0, raiseTo - b[player]);
      s[player] -= pay;
      b[player] += pay;
      p += pay;
      return { history: h, pot: p, stacks: s, bets: b };
    }

    return { history: h, pot: p, stacks: s, bets: b };
  }

  train(iterations, bucketSampler) {
    for (let t = 0; t < iterations; t += 1) {
      const buckets = bucketSampler();
      const pot = this.initialPot;
      const stacks = [...this.initialStacks];
      const bets = [0, 0];
      this.traverse("", buckets, pot, stacks, bets, this.firstPlayer, 1, 1);
      this.iterations += 1;
    }
  }
}

module.exports = { CfrPlusTrainer };