/**
 * Public betting tree action generator for river/turn/flop subgames.
 */
function parseHistory(history) {
  return history ? history.split("/") : [];
}

function lastActor(history) {
  const parts = parseHistory(history);
  return parts.length ? parts[parts.length - 1] : null;
}

function betsEqual(bets) {
  return bets[0] === bets[1];
}

function facingBet(bets, player) {
  return Math.max(bets[0], bets[1]) > bets[player];
}

function actionsFor(history, player, bets, stacks) {
  const parts = parseHistory(history);
  const last = parts.at(-1) || "";
  const canBet = stacks[player] > 0;

  if (last === "fold") return [];

  if (parts.length >= 2 && last === "call") return [];
  if (parts.length >= 2 && (last.startsWith("bet") || last === "raise") && parts.at(-2) !== "check" && last !== "check") {
    if (parts.at(-2)?.startsWith("bet") || parts.at(-2) === "raise") return [];
  }

  if (parts.length === 0) {
    const out = ["check"];
    if (canBet) out.push("bet33", "bet66", "bet100");
    return out;
  }

  if (last === "check") {
    if (player === 1 && parts.length === 1) {
      const out = ["check"];
      if (canBet) out.push("bet33", "bet66", "bet100");
      return out;
    }
    if (player === 0 && parts.length === 2 && parts[0] === "check") return [];
  }

  if (last.startsWith("bet") || last === "raise") {
    const out = ["fold", "call"];
    if (canBet && stacks[player] > Math.max(bets[0], bets[1]) - bets[player]) out.push("raise");
    return out;
  }

  if (last === "check" && facingBet(bets, player)) {
    return ["fold", "call"];
  }

  if (betsEqual(bets) && parts.length >= 1) {
    const out = ["check"];
    if (canBet && parts.filter((a) => a.startsWith("bet") || a === "raise").length < 2) {
      out.push("bet33", "bet66", "bet100");
    }
    if (parts.length >= 2 && parts.at(-1) === "check" && parts.at(-2) === "check") return [];
    return out;
  }

  return [];
}

function terminalUtility(buckets, pot, stacks, bets, history, matrix, investedStart) {
  const parts = parseHistory(history);
  const last = parts.at(-1);
  const invested = [
    investedStart[0] - stacks[0],
    investedStart[1] - stacks[1],
  ];

  if (last === "fold") {
    const folder = parts.length % 2 === 1 ? 1 : 0;
    const u0 = folder === 0 ? pot - invested[0] : -invested[0];
    const u1 = folder === 1 ? pot - invested[1] : -invested[1];
    return [u0, u1];
  }

  const eq = matrix[buckets[0]][buckets[1]];
  const share0 = eq;
  const share1 = 1 - eq;
  const u0 = share0 * pot - invested[0];
  const u1 = share1 * pot - invested[1];
  return [u0, u1];
}

function makeSubgameConfig({ street, potBb, stacksBb, firstPlayer = 0 }) {
  return {
    street,
    initialPot: potBb,
    initialStacks: [...stacksBb],
    firstPlayer,
    actionsByNode: (history, player) => {
      const bets = inferBets(history, potBb);
      return actionsFor(history, player, bets, stacksBb);
    },
  };
}

function inferBets(history, pot) {
  const parts = parseHistory(history);
  const bets = [0, 0];
  let p = 0;
  parts.forEach((act, idx) => {
    const pl = idx % 2 === 0 ? 0 : 1;
    if (act.startsWith("bet")) {
      const frac = Number(act.slice(3)) / 100;
      const target = Math.round((pot + p) * frac);
      const pay = Math.max(0, target - bets[pl]);
      bets[pl] += pay;
      p += pay;
    } else if (act === "raise") {
      const facing = Math.max(bets[0], bets[1]);
      const target = Math.round(facing + (pot + p) * 0.66);
      const pay = Math.max(0, target - bets[pl]);
      bets[pl] += pay;
      p += pay;
    } else if (act === "call") {
      const pay = Math.max(0, Math.max(bets[0], bets[1]) - bets[pl]);
      bets[pl] += pay;
      p += pay;
    }
  });
  return bets;
}

module.exports = {
  actionsFor,
  terminalUtility,
  makeSubgameConfig,
  parseHistory,
};