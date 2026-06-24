/**
 * Full 1326-combo CFR+ trainer for 2-player betting subgames.
 */
const { COMBO_COUNT } = require("./combos");
const { showdownEquity, mcEquityIncomplete } = require("./equity");

class ComboCFR {
  constructor({ pot, stacks, firstPlayer = 0, maxRaises = 2, board = [], mcSamples = 16 }) {
    this.pot0 = pot;
    this.stacks0 = stacks;
    this.firstPlayer = firstPlayer;
    this.maxRaises = maxRaises;
    this.board = board;
    this.mcSamples = mcSamples;
    this.regrets = new Map();
    this.strategySum = new Map();
    this.iterations = 0;
  }

  key(player, combo, history) {
    return `${player}|${combo}|${history}`;
  }

  initialState() {
    return {
      history: "",
      bets: [0, 0],
      stacks: [...this.stacks0],
      pot: this.pot0,
      raises: 0,
      player: this.firstPlayer,
      terminal: false,
    };
  }

  actions(state) {
    const { history, bets, stacks, player, raises } = state;
    if (history.endsWith("/fold")) return [];
    const parts = history ? history.split("/") : [];
    const last = parts.at(-1) || "";
    const facing = Math.max(bets[0], bets[1]) - bets[player];

    if (last === "call" && parts.length >= 2) return [];
    if (parts.length >= 2 && parts.at(-1) === "check" && parts.at(-2) === "check") return [];

    if (facing > 0) {
      const out = ["fold", "call"];
      if (stacks[player] > facing && raises < this.maxRaises) out.push("raise");
      return out;
    }
    const out = ["check"];
    if (stacks[player] > 0 && raises < this.maxRaises) out.push("bet25", "bet33", "bet50", "bet66", "bet100");
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
    return s;
  }

  payoff(state, combos, player, rng) {
    const invested = [this.stacks0[0] - state.stacks[0], this.stacks0[1] - state.stacks[1]];
    if (state.folder != null) {
      const win = state.folder === 0 ? 1 : 0;
      return player === win ? state.pot - invested[player] : -invested[player];
    }
    const eq0 = this.board.length === 5
      ? showdownEquity(combos[0], combos[1], this.board)
      : mcEquityIncomplete(combos[0], combos[1], this.board, rng, this.mcSamples);
    const share = player === 0 ? eq0 : 1 - eq0;
    return share * state.pot - invested[player];
  }

  strategy(player, combo, history, actions) {
    const k = this.key(player, combo, history);
    if (!this.regrets.has(k)) this.regrets.set(k, new Float64Array(actions.length));
    const regrets = this.regrets.get(k);
    const strat = new Float64Array(actions.length);
    let n = 0;
    for (let i = 0; i < actions.length; i += 1) {
      strat[i] = regrets[i] > 0 ? regrets[i] : 0;
      n += strat[i];
    }
    if (n < 1e-12) {
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

  cfr(state, combos, reach, rng) {
    const acts = this.actions(state);
    if (!acts.length || state.terminal) {
      return [this.payoff(state, combos, 0, rng), this.payoff(state, combos, 1, rng)];
    }
    const p = state.player;
    const strat = this.strategy(p, combos[p], state.history, acts);
    const util = new Float64Array(acts.length);
    const nodeUtil = [0, 0];

    for (let i = 0; i < acts.length; i += 1) {
      const next = this.apply(state, acts[i]);
      const child = this.cfr(next, combos, reach, rng);
      util[i] = child[p];
      nodeUtil[p] += strat[i] * util[i];
      nodeUtil[1 - p] += strat[i] * child[1 - p];
    }

    const regrets = this.regrets.get(this.key(p, combos[p], state.history));
    const oppReach = reach[1 - p];
    for (let i = 0; i < acts.length; i += 1) {
      regrets[i] = Math.max(0, regrets[i] + oppReach * (util[i] - nodeUtil[p]));
    }
    return nodeUtil;
  }

  train(iterations, comboSampler, rng) {
    for (let t = 0; t < iterations; t += 1) {
      const combos = comboSampler(rng);
      this.cfr(this.initialState(), combos, [1, 1], rng);
      this.iterations += 1;
    }
  }

  exportSparse(actionList, minProb = 0.004) {
    const strategies = {};
    this.strategySum.forEach((sum, key) => {
      const total = sum.reduce((a, b) => a + b, 0) || 1;
      const parts = key.split("|");
      const info = `${parts[1]}|${parts[2]}`;
      const entries = [];
      for (let i = 0; i < actionList.length; i += 1) {
        const p = sum[i] / total;
        if (p >= minProb) entries.push({ a: actionList[i], p: Math.round(p * 1000) / 1000 });
      }
      if (entries.length) strategies[info] = entries;
    });
    return strategies;
  }
}

module.exports = { ComboCFR };