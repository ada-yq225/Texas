const SUITS = [
  { key: "s", symbol: "♠", red: false },
  { key: "h", symbol: "♥", red: true },
  { key: "d", symbol: "♦", red: true },
  { key: "c", symbol: "♣", red: false },
];
const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
const RANK_VALUE = { A: 14, K: 13, Q: 12, J: 11, T: 10, 9: 9, 8: 8, 7: 7, 6: 6, 5: 5, 4: 4, 3: 3, 2: 2 };
const HAND_NAMES = {
  "Royal Flush": "皇家同花顺",
  "Straight Flush": "同花顺",
  "Four of a Kind": "四条",
  "Full House": "葫芦",
  Flush: "同花",
  Straight: "顺子",
  "Three of a Kind": "三条",
  "Two Pair": "两对",
  Pair: "一对",
  "High Card": "高牌",
};
const STREET_NAMES = ["翻牌前", "翻牌", "转牌", "河牌"];

const HERO_BLUEPRINT = { id: "hero", name: "你", isHero: true, style: "玩家" };
const BOT_BLUEPRINTS = [
  { id: "lin", name: "林老板", style: "紧凶", tightness: 0.74, aggression: 0.58, bluff: 0.12, trap: 0.22, calling: 0.36, positionSense: 0.72, volatility: 0.16 },
  { id: "chen", name: "陈教练", style: "赔率派", tightness: 0.55, aggression: 0.48, bluff: 0.2, trap: 0.14, calling: 0.52, positionSense: 0.82, volatility: 0.12 },
  { id: "mei", name: "阿梅", style: "混合", tightness: 0.38, aggression: 0.68, bluff: 0.34, trap: 0.28, calling: 0.48, positionSense: 0.64, volatility: 0.3 },
  { id: "gao", name: "高律师", style: "冷静价值", tightness: 0.68, aggression: 0.42, bluff: 0.08, trap: 0.2, calling: 0.4, positionSense: 0.78, volatility: 0.1 },
  { id: "xu", name: "许医生", style: "跟注站", tightness: 0.42, aggression: 0.32, bluff: 0.1, trap: 0.08, calling: 0.75, positionSense: 0.46, volatility: 0.18 },
  { id: "qiao", name: "乔老板", style: "松凶", tightness: 0.26, aggression: 0.78, bluff: 0.42, trap: 0.18, calling: 0.56, positionSense: 0.5, volatility: 0.38 },
  { id: "song", name: "宋老师", style: "平衡派", tightness: 0.5, aggression: 0.54, bluff: 0.22, trap: 0.16, calling: 0.5, positionSense: 0.7, volatility: 0.18 },
];

const state = {
  initialStack: 2000,
  smallBlind: 10,
  bigBlind: 20,
  playerCount: 4,
  gameMode: "normal",
  runTwice: false,
  handNumber: 1,
  dealerIndex: 0,
  deck: [],
  players: [],
  community: [],
  runoutBoards: [],
  pot: 0,
  currentBet: 0,
  minRaise: 20,
  streetIndex: -1,
  active: false,
  awaitHero: false,
  revealed: false,
  actionIndex: 0,
  acted: new Set(),
  raisesThisRound: 0,
  lastAggressor: null,
  message: "选择初始筹码，点击“新牌局”开始。",
  actionLog: [],
  equityCache: { key: "", values: new Map() },
  heroStats: {
    hands: 0,
    actions: 0,
    raises: 0,
    calls: 0,
    checks: 0,
    folds: 0,
    foldsToBet: 0,
    facedBets: 0,
    recent: [],
  },
};

const els = {
  opponents: document.querySelector("#opponents"),
  hero: document.querySelector("#hero"),
  community: document.querySelector("#community"),
  message: document.querySelector("#message"),
  pot: document.querySelector("#pot"),
  potChips: document.querySelector("#potChips"),
  currentBet: document.querySelector("#currentBet"),
  street: document.querySelector("#street"),
  profit: document.querySelector("#profit"),
  handNumber: document.querySelector("#handNumber"),
  boardState: document.querySelector("#boardState"),
  dealerLabel: document.querySelector("#dealerLabel"),
  stackSelect: document.querySelector("#stackSelect"),
  blindSelect: document.querySelector("#blindSelect"),
  playerCountSelect: document.querySelector("#playerCountSelect"),
  modeSelect: document.querySelector("#modeSelect"),
  runTwiceSelect: document.querySelector("#runTwiceSelect"),
  runoutBoards: document.querySelector("#runoutBoards"),
  newSessionBtn: document.querySelector("#newSessionBtn"),
  newHandBtn: document.querySelector("#newHandBtn"),
  foldBtn: document.querySelector("#foldBtn"),
  checkCallBtn: document.querySelector("#checkCallBtn"),
  betRaiseBtn: document.querySelector("#betRaiseBtn"),
  threeBetBtn: document.querySelector("#threeBetBtn"),
  potBetBtn: document.querySelector("#potBetBtn"),
  allInBtn: document.querySelector("#allInBtn"),
  betAmount: document.querySelector("#betAmount"),
  actionLog: document.querySelector("#actionLog"),
  heroRead: document.querySelector("#heroRead"),
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function roundToBlind(value) {
  const step = state.bigBlind;
  return Math.max(step, Math.round(value / step) * step);
}

function makePlayers(stack = state.initialStack) {
  const blueprints = [HERO_BLUEPRINT, ...BOT_BLUEPRINTS.slice(0, state.playerCount - 1)];
  return blueprints.map((blueprint) => ({
    ...blueprint,
    stack,
    startStack: stack,
    hand: [],
    bet: 0,
    committed: 0,
    folded: false,
    allIn: false,
    winner: false,
    lastAction: "",
    handLabel: "",
    position: "",
    read: blueprint.style,
    mood: 0,
    seatIndex: 0,
  }));
}

function resetForHand(player) {
  player.hand = [];
  player.bet = 0;
  player.committed = 0;
  player.folded = false;
  player.allIn = false;
  player.winner = false;
  player.lastAction = "";
  player.handLabel = "";
  player.position = "";
  player.read = player.style;
  player.mood = player.isHero ? 0 : rand(-(player.volatility || 0.1), player.volatility || 0.1);
  if (!player.isHero && player.stack <= 0) {
    player.stack = state.initialStack;
    player.startStack = state.initialStack;
  }
}

function createDeck() {
  return SUITS.flatMap((suit) =>
    RANKS.map((rank) => ({
      rank,
      suit: suit.key,
      symbol: suit.symbol,
      red: suit.red,
      solver: `${rank}${suit.key}`,
    })),
  );
}

function shuffle(deck) {
  const cards = [...deck];
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

function draw() {
  return state.deck.pop();
}

function hero() {
  return state.players[0];
}

function addLog(line) {
  state.actionLog.unshift(line);
  state.actionLog = state.actionLog.slice(0, 12);
}

function spend(player, amount) {
  const paid = Math.max(0, Math.min(player.stack, Math.floor(amount)));
  player.stack -= paid;
  player.bet += paid;
  player.committed += paid;
  state.pot += paid;
  if (player.stack === 0) {
    player.allIn = true;
  }
  return paid;
}

function nextIndex(fromIndex, predicate = () => true) {
  for (let offset = 1; offset <= state.players.length; offset += 1) {
    const index = (fromIndex + offset) % state.players.length;
    if (predicate(state.players[index], index)) return index;
  }
  return fromIndex;
}

function activePlayers() {
  return state.players.filter((player) => !player.folded);
}

function actorsWithChips() {
  return state.players.filter((player) => !player.folded && player.stack > 0);
}

function callAmount(player) {
  return Math.max(0, state.currentBet - player.bet);
}

function canAct(player) {
  return state.active && !player.folded && player.stack > 0;
}

function minTargetFor(player) {
  if (state.currentBet === 0) {
    return Math.min(player.bet + player.stack, state.bigBlind);
  }
  return Math.min(player.bet + player.stack, state.currentBet + state.minRaise);
}

function maxTargetFor(player) {
  return player.bet + player.stack;
}

function isRoundClosed() {
  const actors = actorsWithChips();
  if (activePlayers().length > 1 && actors.length <= 1) return true;
  if (actors.length === 0) return true;
  return actors.every((player) => state.acted.has(player.id) && player.bet === state.currentBet);
}

function streetName() {
  return state.streetIndex >= 0 ? STREET_NAMES[state.streetIndex] : "准备";
}

function setPositions() {
  state.players.forEach((player) => {
    player.position = "";
  });
  const dealer = state.dealerIndex;
  const sb = nextIndex(dealer);
  const bb = nextIndex(sb);
  state.players[dealer].position = "D";
  state.players[sb].position = "SB";
  state.players[bb].position = "BB";
  return { dealer, sb, bb };
}

function newSession() {
  const blindParts = els.blindSelect.value.split("/").map(Number);
  state.initialStack = Number(els.stackSelect.value);
  state.smallBlind = blindParts[0];
  state.bigBlind = blindParts[1];
  state.playerCount = Number(els.playerCountSelect.value);
  state.gameMode = els.modeSelect.value;
  state.runTwice = els.runTwiceSelect.value === "twice";
  state.minRaise = state.bigBlind;
  state.handNumber = 1;
  state.dealerIndex = 0;
  state.players = makePlayers(state.initialStack);
  state.community = [];
  state.runoutBoards = [];
  state.pot = 0;
  state.currentBet = 0;
  state.streetIndex = -1;
  state.active = false;
  state.awaitHero = false;
  state.revealed = false;
  state.actionLog = [];
  state.equityCache = { key: "", values: new Map() };
  state.heroStats = {
    hands: 0,
    actions: 0,
    raises: 0,
    calls: 0,
    checks: 0,
    folds: 0,
    foldsToBet: 0,
    facedBets: 0,
    recent: [],
  };
  state.message = `${state.gameMode === "study" ? "教学模式已开启：全明牌并显示实时胜率。" : "新牌局已建立。"} 点击“下一手牌”开始。`;
  render();
}

function beginHand() {
  if (state.active) return;
  if (!state.players.length) {
    newSession();
  }
  if (hero().stack <= 0) {
    state.message = "你的筹码已经归零，请点击“新牌局”重新买入。";
    render();
    return;
  }

  state.deck = shuffle(createDeck());
  state.community = [];
  state.runoutBoards = [];
  state.pot = 0;
  state.currentBet = state.bigBlind;
  state.minRaise = state.bigBlind;
  state.streetIndex = 0;
  state.active = true;
  state.awaitHero = false;
  state.revealed = false;
  state.acted = new Set();
  state.raisesThisRound = 0;
  state.lastAggressor = null;
  state.message = "新一手开始。机器人会先按位置行动。";
  state.equityCache = { key: "", values: new Map() };
  state.players.forEach(resetForHand);
  state.heroStats.hands += 1;

  const { sb, bb } = setPositions();
  for (let round = 0; round < 2; round += 1) {
    state.players.forEach((player) => player.hand.push(draw()));
  }

  spend(state.players[sb], state.smallBlind);
  state.players[sb].lastAction = `小盲 ${state.smallBlind}`;
  spend(state.players[bb], state.bigBlind);
  state.players[bb].lastAction = `大盲 ${state.bigBlind}`;
  addLog(`${state.players[sb].name} 小盲 ${state.smallBlind}`);
  addLog(`${state.players[bb].name} 大盲 ${state.bigBlind}`);

  state.actionIndex = nextIndex(bb, (player) => canAct(player));
  setSuggestedBet();
  render();
  processActionLoop();
}

function cardMarkup(card, hidden = false) {
  if (hidden) {
    return '<div class="card back" aria-label="暗牌"></div>';
  }
  return `<div class="card ${card.red ? "red" : ""}" aria-label="${card.rank}${card.symbol}">
    <span class="rank">${card.rank.replace("T", "10")}</span>
    <span class="suit">${card.symbol}</span>
  </div>`;
}

function playerMarkup(player, displayIndex = 0) {
  const studyMode = state.gameMode === "study";
  const hidden = !player.isHero && !state.revealed && !studyMode;
  const statusClass = player.winner ? "winner" : player.folded ? "folded" : state.actionIndex === state.players.indexOf(player) && state.active ? "thinking" : "";
  const status = player.winner ? "赢家" : player.folded ? "弃牌" : player.allIn ? "All-in" : player.lastAction || "在局";
  const hand = player.hand.map((card) => cardMarkup(card, hidden)).join("");
  const handLabel = state.revealed && player.handLabel ? `<div class="stack-row read-row"><span>${player.handLabel}</span></div>` : "";
  const read = !player.isHero ? `<div class="stack-row read-row"><span>${player.read}</span></div>` : "";
  const equity = studyMode ? studyEquityMarkup(player) : "";
  const position = player.position ? `<span class="pos-badge">${player.position}</span>` : "";

  const seatClass = player.isHero ? "" : ` seat-${displayIndex + 1}`;
  return `<article class="seat${seatClass}">
    <div>
      <div class="seat-head">
        <span class="name">${player.name}</span>
        <span class="badges">${position}<span class="status ${statusClass}">${status}</span></span>
      </div>
      <div class="stack-row"><span>筹码 ${player.stack}</span><span>本轮 ${player.bet}</span></div>
      ${read}
      ${equity}
      ${handLabel}
    </div>
    <div class="cards">${hand}</div>
  </article>`;
}

function chipMarkup() {
  if (state.pot <= 0) {
    return '<span class="chip">0</span>';
  }
  const colors = ["", "blue", "red", "green"];
  const count = clamp(Math.ceil(state.pot / Math.max(state.bigBlind * 4, 1)), 3, 12);
  return Array.from({ length: count }, (_, index) => {
    const label = index === count - 1 ? state.pot : "";
    return `<span class="chip ${colors[index % colors.length]}">${label}</span>`;
  }).join("");
}

function heroProfileText() {
  const stats = state.heroStats;
  if (stats.actions < 4) return "观察中";
  const aggression = stats.raises / Math.max(1, stats.actions);
  const foldRate = stats.foldsToBet / Math.max(1, stats.facedBets);
  const callRate = stats.calls / Math.max(1, stats.actions);
  if (aggression > 0.42) return "你偏激进";
  if (foldRate > 0.5) return "你弃牌偏多";
  if (callRate > 0.48) return "你跟注偏多";
  return "打法均衡";
}

function studyEquityMarkup(player) {
  const values = knownEquities();
  const equity = values.get(player.id);
  if (player.folded || equity == null) {
    return '<div class="stack-row equity-row"><span>胜率 --</span></div>';
  }
  const percent = Math.round(equity * 100);
  return `<div class="stack-row equity-row"><span>胜率</span><span>${percent}%</span></div>
    <div class="equity-bar"><div class="equity-fill" style="width:${percent}%"></div></div>`;
}

function runoutBoardsMarkup() {
  if (!state.runoutBoards.length) return "";
  return state.runoutBoards
    .map((board, index) => `<div class="runout-board">
      <span>第 ${index + 1} 次</span>
      <div class="cards">${board.map((card) => cardMarkup(card)).join("")}</div>
    </div>`)
    .join("");
}

function render(message = "") {
  if (message) state.message = message;
  if (!state.players.length) state.players = makePlayers(state.initialStack);
  document.body.dataset.players = String(state.playerCount);
  document.body.dataset.mode = state.gameMode;

  els.opponents.innerHTML = state.players.slice(1).map((player, index) => playerMarkup(player, index)).join("");
  els.hero.innerHTML = playerMarkup(hero());
  els.community.innerHTML =
    state.community.map((card) => cardMarkup(card)).join("") ||
    Array.from({ length: 5 }, () => '<div class="card back" aria-label="未发公共牌"></div>').join("");
  els.runoutBoards.innerHTML = runoutBoardsMarkup();
  els.potChips.innerHTML = chipMarkup();
  els.message.textContent = state.message;
  els.pot.textContent = state.pot;
  els.currentBet.textContent = state.currentBet;
  els.street.textContent = streetName();
  els.boardState.textContent = state.community.length ? `${state.community.length} 张公共牌` : "等待公共牌";
  els.handNumber.textContent = state.handNumber;
  els.dealerLabel.textContent = state.players[state.dealerIndex]?.position === "D" ? "D" : "D";

  const profit = hero().stack - state.initialStack;
  els.profit.textContent = profit > 0 ? `+${profit}` : `${profit}`;
  els.profit.closest(".metric").classList.toggle("positive", profit > 0);
  els.profit.closest(".metric").classList.toggle("negative", profit < 0);

  const canHeroAct = state.active && state.awaitHero && canAct(hero());
  const heroCall = callAmount(hero());
  const suggested = suggestedBetTarget();
  els.foldBtn.disabled = !canHeroAct;
  els.checkCallBtn.disabled = !canHeroAct;
  els.betRaiseBtn.disabled = !canHeroAct || hero().stack <= heroCall;
  els.threeBetBtn.disabled = !canHeroAct || !isThreeBetSpot() || hero().stack <= heroCall;
  els.potBetBtn.disabled = !canHeroAct || hero().stack <= heroCall;
  els.allInBtn.disabled = !canHeroAct;
  els.checkCallBtn.textContent = heroCall > 0 ? `跟注 ${heroCall}` : "看牌";
  els.betRaiseBtn.textContent = state.currentBet > 0 ? `${raiseButtonLabel()} ${suggested}` : `下注 ${suggested}`;
  els.threeBetBtn.textContent = isThreeBetSpot() ? `3Bet ${threeBetTarget()}` : "3Bet";
  els.potBetBtn.textContent = state.currentBet > 0 ? "半池加注" : "半池下注";
  els.newHandBtn.disabled = state.active;
  els.stackSelect.disabled = state.active;
  els.blindSelect.disabled = state.active;
  els.playerCountSelect.disabled = state.active;
  els.modeSelect.disabled = state.active;
  els.runTwiceSelect.disabled = state.active;
  els.actionLog.innerHTML = state.actionLog.map((line) => `<div>${line}</div>`).join("") || "<div>暂无行动</div>";
  els.heroRead.textContent = heroProfileText();
}

function translateHand(name) {
  return HAND_NAMES[name] || name;
}

function solvePlayer(player) {
  const solved = Hand.solve([...player.hand, ...state.community].map((card) => card.solver));
  player.handLabel = translateHand(solved.name);
  solved.player = player;
  return solved;
}

function awardByFold() {
  const winner = activePlayers()[0];
  winner.stack += state.pot;
  winner.winner = true;
  winner.lastAction = "赢得底池";
  addLog(`${winner.name} 赢得底池 ${state.pot}`);
  state.pot = 0;
  endHand(`${winner.name} 逼退全场，拿下这一池。`);
}

function showdown() {
  state.revealed = true;
  const runCount = shouldRunTwice() ? 2 : 1;
  const boards = buildShowdownBoards(runCount);
  state.community = boards[0];
  state.runoutBoards = runCount > 1 ? boards : [];

  const potAwards = boards.flatMap((board, index) => {
    const solvedById = solvePlayersForBoard(board, runCount === 1);
    return distributeBoardPots(solvedById, index, runCount);
  });
  const winnerIds = new Set(potAwards.flatMap((award) => award.winners.map((player) => player.id)));
  state.players.forEach((player) => {
    if (winnerIds.has(player.id)) {
      player.winner = true;
      player.lastAction = "赢得底池";
    }
  });
  const potWon = potAwards.reduce((sum, award) => sum + award.amount, 0);
  state.pot = 0;
  const winText = formatPotAwards(potAwards, runCount);
  addLog(winText || `摊牌结算 ${potWon}`);
  endHand(`${runCount > 1 ? "All-in 发两次：" : ""}${winText} 赢下本手牌。`);
}

function shouldRunTwice() {
  return state.runTwice && activePlayers().length > 1 && state.community.length < 5 && actorsWithChips().length <= 1;
}

function buildShowdownBoards(runCount) {
  return Array.from({ length: runCount }, () => {
    const board = [...state.community];
    while (board.length < 5) {
      board.push(draw());
    }
    return board;
  });
}

function solvePlayersForBoard(board, updateLabels = false) {
  return new Map(
    activePlayers().map((player) => {
      const solved = Hand.solve([...player.hand, ...board].map((card) => card.solver));
      solved.player = player;
      if (updateLabels) {
        player.handLabel = translateHand(solved.name);
      }
      return [player.id, solved];
    }),
  );
}

function formatPotAwards(potAwards, runCount = 1) {
  if (runCount > 1) {
    const grouped = new Map();
    potAwards.forEach((award) => {
      const key = `${award.boardLabel}:${award.winners.map((player) => player.id).join("|")}`;
      const existing = grouped.get(key) || {
        amount: 0,
        boardLabel: award.boardLabel,
        handNames: award.handNames,
        winners: award.winners,
      };
      existing.amount += award.amount;
      grouped.set(key, existing);
    });
    return [...grouped.values()]
      .map((award) => `${award.boardLabel}：${award.winners.map((player) => `${player.name}（${translateHand(award.handNames.get(player.id))}）`).join("、")} 赢 ${award.amount}`)
      .join("；");
  }

  const grouped = new Map();
  potAwards.forEach((award) => {
    const key = award.winners.map((player) => player.id).join("|");
    const existing = grouped.get(key) || { amount: 0, winners: award.winners };
    existing.amount += award.amount;
    grouped.set(key, existing);
  });
  return [...grouped.values()]
    .map((award) => `${award.winners.map((player) => `${player.name}（${player.handLabel}）`).join("、")} 赢 ${award.amount}`)
    .join("；");
}

function buildSidePots() {
  const levels = [...new Set(state.players.filter((player) => player.committed > 0).map((player) => player.committed))].sort((a, b) => a - b);
  const pots = [];
  let previous = 0;
  levels.forEach((level) => {
    const contributors = state.players.filter((player) => player.committed >= level);
    const amount = (level - previous) * contributors.length;
    const eligible = contributors.filter((player) => !player.folded);
    if (amount > 0 && eligible.length > 0) {
      pots.push({ amount, eligible });
    }
    previous = level;
  });
  return pots;
}

function distributeBoardPots(solvedById, boardIndex = 0, boardCount = 1) {
  return buildSidePots().map((pot) => {
    const solved = pot.eligible.map((player) => solvedById.get(player.id)).filter(Boolean);
    const winners = Hand.winners(solved).map((hand) => hand.player);
    const boardAmount = splitPotAmount(pot.amount, boardIndex, boardCount);
    const share = Math.floor(boardAmount / winners.length);
    let remainder = boardAmount - share * winners.length;
    const handNames = new Map(solved.map((hand) => [hand.player.id, hand.name]));
    winners.forEach((player) => {
      player.stack += share + (remainder > 0 ? 1 : 0);
      remainder -= 1;
    });
    return { amount: boardAmount, winners, handNames, boardLabel: `第 ${boardIndex + 1} 次` };
  });
}

function splitPotAmount(amount, boardIndex, boardCount) {
  const base = Math.floor(amount / boardCount);
  const remainder = amount - base * boardCount;
  return base + (boardIndex < remainder ? 1 : 0);
}

function endHand(message) {
  state.active = false;
  state.awaitHero = false;
  state.streetIndex = 3;
  state.handNumber += 1;
  state.dealerIndex = nextIndex(state.dealerIndex);
  render(message);
}

function advanceStreet() {
  if (activePlayers().length === 1) {
    awardByFold();
    return;
  }
  if (shouldRunTwice()) {
    showdown();
    return;
  }
  if (state.streetIndex >= 3) {
    showdown();
    return;
  }

  state.players.forEach((player) => {
    player.bet = 0;
    player.lastAction = player.folded ? "弃牌" : player.allIn ? "All-in" : "";
  });
  state.currentBet = 0;
  state.minRaise = state.bigBlind;
  state.raisesThisRound = 0;
  state.lastAggressor = null;
  state.acted = new Set();
  state.streetIndex += 1;

  if (state.streetIndex === 1) {
    state.community.push(draw(), draw(), draw());
    addLog("发出翻牌");
  } else {
    state.community.push(draw());
    addLog(state.streetIndex === 2 ? "发出转牌" : "发出河牌");
  }

  state.actionIndex = nextIndex(state.dealerIndex, (player) => canAct(player));
  setSuggestedBet();
  render(`${streetName()}已发，行动从小盲侧开始。`);
}

function processActionLoop() {
  let guard = 0;
  while (state.active && guard < 80) {
    guard += 1;
    if (activePlayers().length === 1) {
      awardByFold();
      return;
    }
    if (isRoundClosed()) {
      advanceStreet();
      if (!state.active) return;
      continue;
    }

    const player = state.players[state.actionIndex];
    if (!canAct(player)) {
      state.actionIndex = nextIndex(state.actionIndex, (candidate) => canAct(candidate));
      continue;
    }

    if (player.isHero) {
      state.awaitHero = true;
      setSuggestedBet();
      render(callAmount(player) > 0 ? "轮到你。对手给了压力，选择跟注、弃牌或反击。" : "轮到你。可以过牌，也可以主动下注。");
      return;
    }

    const decision = decideForBot(player);
    applyAction(player, decision);
    state.actionIndex = nextIndex(state.actionIndex, (candidate) => canAct(candidate));
  }
  render("牌局状态已暂停，请开始下一手牌。");
}

function applyAction(player, decision) {
  const call = callAmount(player);
  if (decision.type === "fold") {
    player.folded = true;
    player.lastAction = "弃牌";
    state.acted.add(player.id);
    addLog(`${player.name} 弃牌`);
    return;
  }

  if (decision.type === "check") {
    player.lastAction = "看牌";
    state.acted.add(player.id);
    addLog(`${player.name} 看牌`);
    return;
  }

  if (decision.type === "call") {
    const paid = spend(player, call);
    player.lastAction = player.allIn ? `All-in ${paid}` : `跟注 ${paid}`;
    state.acted.add(player.id);
    addLog(`${player.name} ${player.lastAction}`);
    return;
  }

  if (decision.type === "raise") {
    const target = clamp(Math.floor(decision.target), minTargetFor(player), maxTargetFor(player));
    const previousBet = state.currentBet;
    const paid = spend(player, target - player.bet);
    const actualTarget = player.bet;
    const raiseSize = actualTarget - previousBet;
    if (actualTarget > previousBet) {
      state.currentBet = actualTarget;
      state.minRaise = Math.max(state.bigBlind, raiseSize);
      state.raisesThisRound += 1;
      state.lastAggressor = player.id;
      state.acted = new Set([player.id]);
    } else {
      state.acted.add(player.id);
    }
    const label = decision.label || (previousBet > 0 ? "加注到" : "下注");
    player.lastAction = player.allIn ? `All-in ${actualTarget}` : `${label} ${actualTarget}`;
    addLog(`${player.name} ${player.lastAction}`);
    if (paid <= call && call > 0) {
      player.lastAction = `跟注 ${paid}`;
    }
  }
}

function recordHero(action) {
  const stats = state.heroStats;
  stats.actions += 1;
  if (action === "raise") stats.raises += 1;
  if (action === "call") stats.calls += 1;
  if (action === "check") stats.checks += 1;
  if (action === "fold") stats.folds += 1;
  stats.recent.unshift(action);
  stats.recent = stats.recent.slice(0, 20);
}

function heroAction(decision) {
  if (!state.active || !state.awaitHero || !canAct(hero())) return;
  const faced = callAmount(hero()) > 0;
  if (faced) state.heroStats.facedBets += 1;
  if (decision.type === "fold" && faced) state.heroStats.foldsToBet += 1;
  recordHero(decision.type === "raise" ? "raise" : decision.type);
  state.awaitHero = false;
  applyAction(hero(), decision);
  state.actionIndex = nextIndex(state.actionIndex, (candidate) => canAct(candidate));
  render();
  processActionLoop();
}

function deckWithoutKnown(extraKnown = []) {
  const known = new Set([...state.community, ...extraKnown].map((card) => card.solver));
  return createDeck().filter((card) => !known.has(card.solver));
}

function sampleCards(deck, count) {
  const cards = [...deck];
  const picked = [];
  for (let i = 0; i < count && cards.length; i += 1) {
    const index = Math.floor(Math.random() * cards.length);
    picked.push(cards.splice(index, 1)[0]);
  }
  return picked;
}

function preflopStrength(player) {
  const values = player.hand.map((card) => RANK_VALUE[card.rank]).sort((a, b) => b - a);
  const pair = values[0] === values[1];
  const suited = player.hand[0].suit === player.hand[1].suit;
  const gap = Math.abs(values[0] - values[1]);
  let score = (values[0] * 1.6 + values[1]) / 38;
  if (pair) score += values[0] >= 10 ? 0.32 : 0.22;
  if (suited) score += 0.07;
  if (gap <= 1) score += 0.06;
  if (gap >= 5 && values[0] < 12) score -= 0.08;
  return clamp(score, 0.08, 0.94);
}

function estimateEquity(player, samples = 46) {
  if (state.community.length < 3) {
    return preflopStrength(player);
  }
  let wins = 0;
  const opponents = activePlayers().filter((candidate) => candidate.id !== player.id).length;
  const trials = state.community.length === 5 ? 1 : samples;

  for (let i = 0; i < trials; i += 1) {
    let deck = deckWithoutKnown(player.hand);
    const board = [...state.community, ...sampleCards(deck, 5 - state.community.length)];
    const boardSet = new Set(board.map((card) => card.solver));
    deck = deck.filter((card) => !boardSet.has(card.solver));
    const hands = [{ owner: "self", solved: Hand.solve([...player.hand, ...board].map((card) => card.solver)) }];

    for (let seat = 0; seat < opponents; seat += 1) {
      const oppHand = sampleCards(deck, 2);
      const oppSet = new Set(oppHand.map((card) => card.solver));
      deck = deck.filter((card) => !oppSet.has(card.solver));
      hands.push({ owner: `opp-${seat}`, solved: Hand.solve([...oppHand, ...board].map((card) => card.solver)) });
    }

    const solved = hands.map((entry) => {
      entry.solved.owner = entry.owner;
      return entry.solved;
    });
    const winners = Hand.winners(solved);
    if (winners.some((hand) => hand.owner === "self")) {
      wins += 1 / winners.length;
    }
  }
  return clamp(wins / trials, 0, 1);
}

function equityKey() {
  return JSON.stringify({
    mode: state.gameMode,
    board: state.community.map((card) => card.solver),
    players: state.players.map((player) => ({
      id: player.id,
      folded: player.folded,
      hand: player.hand.map((card) => card.solver),
    })),
  });
}

function knownEquities() {
  if (state.gameMode !== "study" || !state.players.some((player) => player.hand.length)) {
    return new Map();
  }
  const key = equityKey();
  if (state.equityCache.key === key) {
    return state.equityCache.values;
  }

  const values = calculateKnownEquities();
  state.equityCache = { key, values };
  return values;
}

function calculateKnownEquities() {
  const active = activePlayers();
  const totals = new Map(active.map((player) => [player.id, 0]));
  if (active.length === 1) {
    totals.set(active[0].id, 1);
    return totals;
  }

  const known = new Set(state.community.map((card) => card.solver));
  state.players.forEach((player) => player.hand.forEach((card) => known.add(card.solver)));
  const deck = createDeck().filter((card) => !known.has(card.solver));
  const missing = 5 - state.community.length;
  const exactCount = combinationCount(deck.length, missing);
  const seedText = equityKey();
  const boards =
    missing <= 0
      ? [[]]
      : exactCount <= 1600
        ? combinations(deck, missing)
        : seededBoardSamples(deck, missing, 1800, seedText);

  boards.forEach((extraCards) => {
    const board = [...state.community, ...extraCards];
    const solved = active.map((player) => {
      const hand = Hand.solve([...player.hand, ...board].map((card) => card.solver));
      hand.player = player;
      return hand;
    });
    const winners = Hand.winners(solved).map((hand) => hand.player);
    winners.forEach((player) => totals.set(player.id, totals.get(player.id) + 1 / winners.length));
  });

  totals.forEach((total, playerId) => totals.set(playerId, total / boards.length));
  return totals;
}

function combinationCount(total, choose) {
  if (choose <= 0) return 1;
  if (choose > total) return 0;
  let result = 1;
  for (let i = 1; i <= choose; i += 1) {
    result = (result * (total - choose + i)) / i;
  }
  return result;
}

function combinations(items, count) {
  const result = [];
  const path = [];
  function visit(start) {
    if (path.length === count) {
      result.push([...path]);
      return;
    }
    for (let i = start; i <= items.length - (count - path.length); i += 1) {
      path.push(items[i]);
      visit(i + 1);
      path.pop();
    }
  }
  visit(0);
  return result;
}

function seededBoardSamples(deck, missing, count, seedText) {
  const random = seededRandom(seedText);
  return Array.from({ length: count }, () => sampleCardsWithRandom(deck, missing, random));
}

function sampleCardsWithRandom(deck, count, random) {
  const cards = [...deck];
  const picked = [];
  for (let i = 0; i < count && cards.length; i += 1) {
    const index = Math.floor(random() * cards.length);
    picked.push(cards.splice(index, 1)[0]);
  }
  return picked;
}

function seededRandom(seedText) {
  let seed = 2166136261;
  for (let i = 0; i < seedText.length; i += 1) {
    seed ^= seedText.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  return () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function boardTexture() {
  if (state.community.length < 3) return 0.2;
  const suitCounts = state.community.reduce((acc, card) => {
    acc[card.suit] = (acc[card.suit] || 0) + 1;
    return acc;
  }, {});
  const values = [...new Set(state.community.map((card) => RANK_VALUE[card.rank]))].sort((a, b) => a - b);
  const flushy = Math.max(...Object.values(suitCounts)) >= 3 ? 0.34 : 0;
  const paired = new Set(state.community.map((card) => card.rank)).size < state.community.length ? 0.18 : 0;
  const connected = values.some((value, index) => values.slice(index, index + 4).at(-1) - value <= 4) ? 0.26 : 0;
  return clamp(0.18 + flushy + paired + connected, 0.1, 0.88);
}

function heroProfile() {
  const stats = state.heroStats;
  return {
    aggression: stats.raises / Math.max(1, stats.actions),
    foldToBet: stats.foldsToBet / Math.max(1, stats.facedBets),
    callRate: stats.calls / Math.max(1, stats.actions),
    recentRaises: stats.recent.slice(0, 6).filter((action) => action === "raise").length,
  };
}

function positionQuality(player) {
  const index = state.players.indexOf(player);
  if (index < 0) return 0.5;
  const distanceFromDealer = (index - state.dealerIndex + state.players.length) % state.players.length;
  if (distanceFromDealer === 0) return 0.95;
  if (player.position === "SB") return 0.18;
  if (player.position === "BB") return 0.28;
  return clamp(0.34 + distanceFromDealer / Math.max(1, state.players.length - 1) * 0.42, 0.22, 0.86);
}

function stackPressure(player) {
  const effective = Math.min(player.stack + player.bet, Math.max(...activePlayers().map((candidate) => candidate.stack + candidate.bet)));
  const blinds = effective / Math.max(1, state.bigBlind);
  if (blinds < 18) return 0.22;
  if (blinds < 35) return 0.1;
  if (blinds > 120) return -0.08;
  return 0;
}

function sprFor(player) {
  const opponentStacks = activePlayers().filter((candidate) => candidate.id !== player.id).map((candidate) => candidate.stack);
  const effectiveStack = Math.min(player.stack, opponentStacks.length ? Math.max(...opponentStacks) : player.stack);
  return effectiveStack / Math.max(1, state.pot);
}

function chooseBotTarget(player, equity, mode = "value") {
  const call = callAmount(player);
  const potBasis = Math.max(state.pot + call, state.bigBlind * 3);
  const heat = boardTexture();
  const personality = player.aggression || 0.5;
  let fraction = 0.48 + personality * 0.22 + rand(-0.12, 0.16);
  if (mode === "bluff") fraction += heat * 0.14;
  if (mode === "premium") fraction += 0.24;
  if (equity > 0.78) fraction += 0.18;

  if (state.currentBet === 0) {
    return clamp(roundToBlind(potBasis * fraction), state.bigBlind, maxTargetFor(player));
  }

  const raisePart = roundToBlind(Math.max(state.minRaise, potBasis * fraction));
  return clamp(state.currentBet + raisePart, minTargetFor(player), maxTargetFor(player));
}

function preflopRaiseLabel() {
  if (state.streetIndex !== 0) return "加注到";
  if (state.raisesThisRound === 0) return "加注到";
  if (state.raisesThisRound === 1) return "3Bet 到";
  if (state.raisesThisRound === 2) return "4Bet 到";
  if (state.raisesThisRound === 3) return "5Bet 到";
  if (state.raisesThisRound === 4) return "6Bet 到";
  return "再加注到";
}

function raiseButtonLabel() {
  return preflopRaiseLabel().replace(" 到", "到");
}

function decideForBot(player) {
  const call = callAmount(player);
  const equity = estimateEquity(player);
  const profile = heroProfile();
  const noise = rand(-0.06, 0.06) + (player.mood || 0);
  const potOdds = call / Math.max(1, state.pot + call);
  const facingHero = state.lastAggressor === hero().id;
  const tightness = player.tightness || 0.5;
  const aggression = player.aggression || 0.5;
  const bluff = player.bluff || 0.18;
  const trap = player.trap || 0.15;
  const calling = player.calling || 0.5;
  const position = positionQuality(player);
  const multiwayPenalty = Math.max(0, activePlayers().length - 2) * 0.035;
  const spr = sprFor(player);
  const stackAdjust = stackPressure(player);
  const positionAdjust = (position - 0.5) * (player.positionSense || 0.5) * 0.16;
  const boardHeat = boardTexture();

  player.read = equity > 0.72 ? "强牌范围" : equity < 0.32 ? "边缘范围" : player.style;

  if (call > 0) {
    const heroPressure = facingHero ? profile.aggression * 0.08 - profile.foldToBet * 0.06 : 0;
    const continueScore =
      equity -
      potOdds * (0.72 - calling * 0.22) +
      aggression * 0.06 -
      tightness * 0.08 +
      heroPressure +
      positionAdjust -
      multiwayPenalty +
      stackAdjust +
      noise;
    const premium = equity > 0.72 + multiwayPenalty + rand(-0.04, 0.04);
    const canRaise = player.stack > call + state.minRaise;
    const deceptiveCall = premium && Math.random() < trap * (spr > 3 ? 1.2 : 0.55) && profile.aggression > 0.28;

    if (canRaise && premium && !deceptiveCall) {
      const label = state.currentBet > 0 ? preflopRaiseLabel() : "下注";
      const multiplier = state.streetIndex === 0 ? rand(2.35, 3.45) + (position > 0.7 ? 0.15 : 0) : rand(1.9, 2.8);
      const target = state.streetIndex === 0 ? roundToBlind(state.currentBet * multiplier) : chooseBotTarget(player, equity, "premium");
      player.read = label.includes("Bet") ? "翻前反击" : "价值加注";
      return { type: "raise", target, label };
    }

    const foldEquityTarget = profile.foldToBet + (facingHero ? 0.08 : 0) + (position > 0.65 ? 0.08 : 0);
    const bluffRaise = canRaise && equity > 0.32 && Math.random() < bluff * (foldEquityTarget + 0.1) * (0.8 + boardHeat) && activePlayers().length <= 3;
    if (bluffRaise) {
      player.read = "施压测试";
      return { type: "raise", target: chooseBotTarget(player, equity, "bluff"), label: state.currentBet > 0 ? preflopRaiseLabel() : "下注" };
    }

    if (continueScore < 0.05) {
      return { type: "fold" };
    }
    return { type: "call" };
  }

  const valueLine = 0.56 + tightness * 0.08 + multiwayPenalty - positionAdjust - stackAdjust * 0.35;
  const valueBet = equity > valueLine + rand(-0.05, 0.04);
  const bluffBet = Math.random() < bluff * (profile.foldToBet + 0.12 + (position > 0.65 ? 0.08 : 0)) * (0.7 + boardHeat) && activePlayers().length <= 3;
  if (player.stack > state.bigBlind && (valueBet || bluffBet)) {
    player.read = valueBet ? "主动要价值" : "试探下注";
    return {
      type: "raise",
      target: chooseBotTarget(player, equity, valueBet ? "value" : "bluff"),
      label: state.currentBet > 0 ? preflopRaiseLabel() : "下注",
    };
  }
  return { type: "check" };
}

function suggestedBetTarget() {
  const player = hero();
  if (!player || player.stack <= 0) return 0;
  const currentInput = Number(els.betAmount.value || 0);
  const min = minTargetFor(player);
  if (currentInput >= min && currentInput <= maxTargetFor(player)) {
    return currentInput;
  }
  return min;
}

function setSuggestedBet() {
  const player = hero();
  if (!player) return;
  let target;
  if (isThreeBetSpot()) {
    target = threeBetTarget();
  } else if (state.currentBet > 0) {
    target = minTargetFor(player);
  } else {
    target = roundToBlind(Math.max(state.bigBlind, state.pot * 0.55));
  }
  els.betAmount.value = clamp(target, 0, maxTargetFor(player));
}

function isThreeBetSpot() {
  return state.streetIndex === 0 && state.currentBet > state.bigBlind && state.raisesThisRound === 1 && callAmount(hero()) > 0;
}

function threeBetTarget() {
  if (!hero()) return 0;
  const target = roundToBlind(Math.max(state.currentBet * 3, state.currentBet + state.minRaise));
  return clamp(target, minTargetFor(hero()), maxTargetFor(hero()));
}

function potTarget() {
  const player = hero();
  const call = callAmount(player);
  const potBasis = Math.max(state.pot + call, state.bigBlind * 3);
  if (state.currentBet === 0) {
    return clamp(roundToBlind(potBasis * 0.55), state.bigBlind, maxTargetFor(player));
  }
  return clamp(state.currentBet + roundToBlind(Math.max(state.minRaise, potBasis * 0.55)), minTargetFor(player), maxTargetFor(player));
}

function handleCheckCall() {
  const call = callAmount(hero());
  heroAction({ type: call > 0 ? "call" : "check" });
}

function handleBetRaise() {
  heroAction({ type: "raise", target: Number(els.betAmount.value || 0), label: state.currentBet > 0 ? preflopRaiseLabel() : "下注" });
}

function handleThreeBet() {
  heroAction({ type: "raise", target: threeBetTarget(), label: "3Bet 到" });
}

function handlePotBet() {
  const target = potTarget();
  els.betAmount.value = target;
  heroAction({ type: "raise", target, label: state.currentBet > 0 ? preflopRaiseLabel() : "下注" });
}

function handleAllIn() {
  heroAction({ type: "raise", target: maxTargetFor(hero()), label: "All-in 到" });
}

els.newSessionBtn.addEventListener("click", newSession);
els.newHandBtn.addEventListener("click", beginHand);
els.foldBtn.addEventListener("click", () => heroAction({ type: "fold" }));
els.checkCallBtn.addEventListener("click", handleCheckCall);
els.betRaiseBtn.addEventListener("click", handleBetRaise);
els.threeBetBtn.addEventListener("click", handleThreeBet);
els.potBetBtn.addEventListener("click", handlePotBet);
els.allInBtn.addEventListener("click", handleAllIn);
els.betAmount.addEventListener("input", () => render());

newSession();

loadDebugScenarioFromUrl();

function loadDebugScenarioFromUrl() {
  if (!["localhost", "127.0.0.1"].includes(window.location.hostname)) return;
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get("scenario");
  if (!encoded) return;
  try {
    setDebugScenario(JSON.parse(decodeURIComponent(encoded)));
  } catch {
    render("调试牌局参数无效。");
  }
}

function setDebugScenario({ hands, board = [], folded = [] }) {
  state.gameMode = "study";
  state.playerCount = hands.length;
  state.players = makePlayers(state.initialStack).slice(0, hands.length);
  state.players.forEach((player, index) => {
    resetForHand(player);
    player.hand = hands[index].map(cardFromSolver);
    player.folded = folded.includes(index);
  });
  state.community = board.map(cardFromSolver);
  state.active = true;
  state.awaitHero = false;
  state.revealed = false;
  state.equityCache = { key: "", values: new Map() };
  render("调试牌局已载入。");
}

function cardFromSolver(code) {
  const rank = code.slice(0, 1).toUpperCase();
  const suitKey = code.slice(1, 2).toLowerCase();
  const suit = SUITS.find((item) => item.key === suitKey);
  return {
    rank,
    suit: suit.key,
    symbol: suit.symbol,
    red: suit.red,
    solver: `${rank}${suit.key}`,
  };
}
