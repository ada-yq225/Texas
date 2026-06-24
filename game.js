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

const HERO_BLUEPRINT = { id: "hero", name: "你", isHero: true, style: "玩家", aiType: null };
const GTO_HERO_NAME = "GTO Solver";
const EXPLOIT_BOT_NAME = "Exploit Solver";
let simTimer = null;
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
  heroMode: "manual",
  gtoSpeed: "step",
  simPace: "step",
  simAutoRunning: false,
  awaitSimStep: false,
  awaitNextHand: false,
  simStepKind: null,
  pendingDecision: null,
  simStreetJustDealt: false,
  simCommentary: [],
  simHandStarts: {},
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
  preflopAggressor: null,
  gtoLine: null,
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
  gtoStats: {
    handsCompleted: 0,
    cumulativeProfit: 0,
    wins: 0,
    rebuys: 0,
    lastReason: "",
  },
  exploitStats: {
    handsCompleted: 0,
    cumulativeProfit: 0,
    wins: 0,
    rebuys: 0,
    lastReason: "",
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
  heroModeSelect: document.querySelector("#heroModeSelect"),
  gtoSpeedSelect: document.querySelector("#gtoSpeedSelect"),
  simToggleBtn: document.querySelector("#simToggleBtn"),
  simStatsPanel: document.querySelector("#simStatsPanel"),
  simStatsStatus: document.querySelector("#simStatsStatus"),
  simCompare: document.querySelector("#simCompare"),
  gtoHands: document.querySelector("#gtoHands"),
  gtoProfit: document.querySelector("#gtoProfit"),
  gtoBb100: document.querySelector("#gtoBb100"),
  gtoWinRate: document.querySelector("#gtoWinRate"),
  gtoAvgProfit: document.querySelector("#gtoAvgProfit"),
  gtoRebuys: document.querySelector("#gtoRebuys"),
  exploitHands: document.querySelector("#exploitHands"),
  exploitProfit: document.querySelector("#exploitProfit"),
  exploitBb100: document.querySelector("#exploitBb100"),
  exploitWinRate: document.querySelector("#exploitWinRate"),
  exploitAvgProfit: document.querySelector("#exploitAvgProfit"),
  exploitRebuys: document.querySelector("#exploitRebuys"),
  simInsight: document.querySelector("#simInsight"),
  simStepBtn: document.querySelector("#simStepBtn"),
  simCommentaryPanel: document.querySelector("#simCommentaryPanel"),
  simCommentaryAction: document.querySelector("#simCommentaryAction"),
  simCommentaryBody: document.querySelector("#simCommentaryBody"),
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

function isManualMode() {
  return state.heroMode === "manual";
}

function isGtoMode() {
  return state.heroMode === "gto" || state.heroMode === "dual";
}

function isExploitMode() {
  return state.heroMode === "exploit" || state.heroMode === "dual";
}

function isDualMode() {
  return state.heroMode === "dual";
}

function isAutoSimMode() {
  return !isManualMode();
}

function isGtoHeroMode() {
  return state.heroMode === "gto";
}

function heroDisplayName() {
  if (state.heroMode === "gto") return GTO_HERO_NAME;
  if (state.heroMode === "exploit") return EXPLOIT_BOT_NAME;
  return "你";
}

function aiPlayers() {
  return state.players.filter((player) => player.aiType);
}

function isAiPlayer(player) {
  return Boolean(player?.aiType);
}

function playerByAiType(aiType) {
  return state.players.find((player) => player.aiType === aiType);
}

function isStepPace() {
  return state.simPace === "step";
}

function isAutoPace() {
  return state.simPace === "auto";
}

function syncSimPace() {
  const value = els.gtoSpeedSelect?.value || "step";
  state.simPace = value === "auto" ? "auto" : "step";
  state.gtoSpeed = value;
}

function simActionDelay() {
  if (state.gtoSpeed === "turbo") return 0;
  if (state.gtoSpeed === "fast") return 180;
  return 520;
}

function simHandDelay() {
  if (state.gtoSpeed === "turbo") return 60;
  if (state.gtoSpeed === "fast") return 420;
  return 1100;
}

function clearSimStepState() {
  state.awaitSimStep = false;
  state.awaitNextHand = false;
  state.simStepKind = null;
  state.pendingDecision = null;
  state.simStreetJustDealt = false;
}

function stopSimAuto(message = "演示已结束。") {
  state.simAutoRunning = false;
  clearSimStepState();
  if (simTimer) {
    clearTimeout(simTimer);
    simTimer = null;
  }
  if (message) state.message = message;
  renderSimPanel();
  renderSimCommentary();
  render();
}

function resetGtoStats() {
  state.gtoStats = {
    handsCompleted: 0,
    cumulativeProfit: 0,
    wins: 0,
    rebuys: 0,
    lastReason: "",
  };
}

function resetExploitStats() {
  state.exploitStats = {
    handsCompleted: 0,
    cumulativeProfit: 0,
    wins: 0,
    rebuys: 0,
    lastReason: "",
  };
}

function resetSimStats() {
  resetGtoStats();
  resetExploitStats();
  if (typeof ExploitEngine !== "undefined") ExploitEngine.resetObserved();
}

function startSimAuto() {
  if (!isAutoSimMode()) return;
  syncSimPace();
  state.simAutoRunning = true;
  clearSimStepState();
  const label = isDualMode() ? "GTO vs 剥削对比" : isGtoHeroMode() ? "职业 GTO" : "最优剥削";
  if (isStepPace()) {
    state.message = `${label}步进演示：点击「下一步」推进每一手行动，并查看职业解说。`;
    state.simCommentary = [{ key: "引导", value: "演示已开始。第一次点击将发新手牌；之后每次点击执行一个行动（含对手）。" }];
  } else {
    state.message = `${label}：自动连播运行中…`;
  }
  renderSimPanel();
  renderSimCommentary();
  render();
  if (!isStepPace() && !state.active) {
    beginHand();
    return;
  }
  if (!isStepPace()) {
    const pending = state.players[state.actionIndex];
    if (pending && isAiPlayer(pending) && canAct(pending)) {
      scheduleAiAction(pending);
    }
  }
}

function rebuyAiPlayer(player) {
  if (!player || player.stack > 0 || !player.aiType) return false;
  player.stack = state.initialStack;
  player.startStack = state.initialStack;
  if (player.aiType === "gto") state.gtoStats.rebuys += 1;
  if (player.aiType === "exploit") state.exploitStats.rebuys += 1;
  addLog(`${player.name} 重新买入 ${state.initialStack}`);
  return true;
}

function rebuyHeroForGto() {
  const player = isDualMode() ? playerByAiType("gto") : hero();
  return rebuyAiPlayer(player);
}

function gtoContext() {
  return {
    players: state.players,
    dealerIndex: state.dealerIndex,
    handNumber: state.handNumber,
    streetIndex: state.streetIndex,
    pot: state.pot,
    currentBet: state.currentBet,
    minRaise: state.minRaise,
    bigBlind: state.bigBlind,
    community: state.community,
    raisesThisRound: state.raisesThisRound,
    lastAggressor: state.lastAggressor,
    preflopAggressor: state.preflopAggressor,
    gtoLine: state.gtoLine,
    playerCount: state.playerCount,
    gtoSamples: state.gameMode === "study" ? 400 : 280,
    callAmount,
    minTargetFor,
    maxTargetFor,
    roundToBlind,
    estimateEquity,
    boardTexture,
    sprFor,
    activePlayers,
    clamp,
    getExactEquity(player) {
      if (state.gameMode !== "study" || !state.players.some((p) => p.hand.length)) return null;
      const values = knownEquities();
      const equity = values.get(player.id);
      return equity == null ? null : equity;
    },
  };
}

function recordGtoLine(player, decision) {
  if (!state.gtoLine) return;
  GtoCore.recordAction(state.gtoLine, state.streetIndex, player, decision, gtoContext());
}

function decideForGto(player) {
  const decision = GtoSolver.decide(player, gtoContext());
  state.gtoStats.lastReason = decision.reason || "GTO";
  player.read = decision.reason || "职业 GTO";
  return decision;
}

function decideForExploit(player) {
  const decision = ExploitEngine.decide(player, gtoContext());
  state.exploitStats.lastReason = decision.reason || "剥削";
  player.read = decision.reason || "最优剥削";
  return decision;
}

function decideForAi(player) {
  if (player.aiType === "exploit") return decideForExploit(player);
  return decideForGto(player);
}

function decideForStep(player) {
  if (isAiPlayer(player)) return decideForAi(player);
  return decideForBot(player);
}

function formatDecisionAction(decision) {
  if (!decision) return "行动";
  if (decision.type === "fold") return "弃牌";
  if (decision.type === "check") return "看牌";
  if (decision.type === "call") return "跟注";
  if (decision.type === "raise") {
    const label = decision.label || (state.currentBet > 0 ? "加注到" : "下注");
    return `${label} ${decision.target}`;
  }
  return decision.type;
}

function handKeyLabel(player) {
  if (!player.hand.length || typeof GtoCore === "undefined") return "";
  return GtoCore.handKeyFromCards(player.hand);
}

function boardSummary() {
  if (!state.community.length) return "尚无公共牌";
  return state.community.map((c) => `${c.rank}${c.symbol}`).join(" ");
}

function gtoFrameworkNote(decision, player) {
  const street = streetName();
  if (street === "翻牌前") return "翻前：1326 combo CFR+ / 图表混合 · 范围对范围频率采样";
  if (decision.type === "raise" && (decision.label || "").includes("C-Bet")) return "翻后：作为进攻者 C-Bet · 按牌面湿度选尺度";
  if (decision.reason?.includes("MDF")) return "防守：按最小防守频率（MDF）平衡跟注/弃牌";
  if (decision.reason?.includes("fold equity") || decision.label?.includes("诈唬")) return "极化：低权益高频诈唬分支 · 阻断牌加权";
  return "翻后：子博弈查表 + 权益/SPR/牌面结构综合决策";
}

function botStyleCommentary(player, decision, equity) {
  const style = player.style || "标准";
  if (decision.type === "fold") {
    return `${style}玩家：权益 ${Math.round(equity * 100)}% 不足，选择弃牌止损`;
  }
  if (decision.type === "call") {
    return `${style}玩家：底池赔率可支付，用${player.calling > 0.55 ? "跟注" : "防守"}范围继续`;
  }
  if (decision.type === "check") {
    return `${style}玩家：控池/陷阱线，过牌等待下一街信息`;
  }
  if (decision.type === "raise") {
    if (equity > 0.62) return `${style}玩家：价值线，强牌主动建池`;
    if ((player.bluff || 0) > 0.25) return `${style}玩家：施压/诈唬，测试对手弃牌阈值`;
    return `${style}玩家：主动下注夺取主动权`;
  }
  return `${style}玩家标准行动`;
}

function buildProCommentary(player, decision, options = {}) {
  const call = callAmount(player);
  const equity = estimateEquity(player);
  const role = player.position || (typeof GtoCore !== "undefined" ? GtoCore.roleOf(player, gtoContext()) : "");
  const key = handKeyLabel(player);
  const lines = [];
  const prefix = options.preview ? "【预告】" : "";

  lines.push({
    key: "行动",
    value: `${prefix}${player.name}${role ? `（${role}）` : ""} → ${formatDecisionAction(decision)}`,
  });

  if (key && (isAiPlayer(player) || state.gameMode === "study")) {
    lines.push({ key: "手牌", value: `${key}${state.gameMode !== "study" && !isAiPlayer(player) ? "（推测范围）" : ""}` });
  }

  if (isAiPlayer(player)) {
    if (player.aiType === "gto") {
      lines.push({ key: "GTO", value: decision.reason || "均衡策略线" });
      lines.push({ key: "框架", value: gtoFrameworkNote(decision, player) });
    } else {
      lines.push({ key: "剥削", value: decision.reason || "读牌后最大化 EV" });
      lines.push({ key: "思路", value: "先 GTO 基线，再按对手 VPIP/弃牌率/跟注倾向偏离频率与尺度" });
    }
  } else {
    lines.push({ key: "解读", value: botStyleCommentary(player, decision, equity) });
    if (typeof ExploitEngine !== "undefined" && isExploitMode()) {
      const leaks = ExploitEngine.leakProfile(player);
      lines.push({
        key: "漏洞",
        value: `VPIP ${Math.round(leaks.vpip * 100)}% · 弃牌 ${Math.round(leaks.foldToBet * 100)}% · ${leaks.plan}`,
      });
    }
  }

  const mathParts = [`权益约 ${Math.round(equity * 100)}%`, `底池 ${state.pot}`];
  if (call > 0) {
    const po = call / Math.max(1, state.pot + call);
    mathParts.push(`跟注 ${call}（需 ${Math.round(po * 100)}% 胜率）`);
    if (typeof GtoCore !== "undefined") {
      mathParts.push(`MDF ${Math.round(GtoCore.mdf(call, state.pot) * 100)}%`);
    }
  }
  if (state.community.length >= 3 && typeof GtoSolver !== "undefined") {
    const board = GtoSolver.analyzeBoard(state.community);
    mathParts.push(`牌面：${board.cat} · 湿度 ${Math.round(board.wetness * 100)}%`);
  }
  lines.push({ key: "数学", value: mathParts.join(" · ") });

  if (options.preview) {
    lines.push({ key: "提示", value: "点击「下一步」执行该行动并进入下一决策点" });
  }

  return lines;
}

function buildStreetCommentary() {
  const street = streetName();
  const board = boardSummary();
  const pot = state.pot;
  const alive = activePlayers().length;
  let texture = "";
  if (state.community.length >= 3 && typeof GtoSolver !== "undefined") {
    const info = GtoSolver.analyzeBoard(state.community);
    texture = `${info.cat} 面 · 湿度 ${Math.round(info.wetness * 100)}%`;
  }
  return [
    { key: "街道", value: `${street}发出 · ${board}` },
    { key: "局面", value: `${alive} 人仍在局 · 底池 ${pot}${texture ? ` · ${texture}` : ""}` },
    {
      key: "职业视角",
      value: street === "翻牌"
        ? "翻牌是范围优势最明显的街道：进攻者常 C-Bet，防守者按 MDF/权益决定跟注或过牌加注。"
        : street === "转牌"
          ? "转牌是范围收窄的关键点：双管、probe、过牌陷阱都在此展开。"
          : "河牌是极化街道：价值与诈唬频率需对齐对手弃牌阈值（α）或跟注站倾向。",
    },
    { key: "提示", value: "点击「下一步」开始本街第一个行动" },
  ];
}

function buildHandEndCommentary(message) {
  const gtoLine = state.gtoStats.cumulativeProfit;
  const exploitLine = state.exploitStats.cumulativeProfit;
  const lines = [
    { key: "结果", value: message },
    { key: "教练", value: "一手结束：回顾进攻者线路是否连贯、下注尺度是否与对手类型匹配。" },
  ];
  if (isGtoMode()) {
    lines.push({ key: "GTO 累计", value: `${gtoLine >= 0 ? "+" : ""}${gtoLine}（${state.gtoStats.handsCompleted} 手）` });
  }
  if (isExploitMode()) {
    lines.push({ key: "剥削累计", value: `${exploitLine >= 0 ? "+" : ""}${exploitLine}（${state.exploitStats.handsCompleted} 手）` });
  }
  lines.push({ key: "提示", value: "点击「下一步」发下一手牌" });
  return lines;
}

function renderSimCommentary() {
  if (!els.simCommentaryPanel) return;
  const show = isAutoSimMode() && state.simAutoRunning;
  els.simCommentaryPanel.hidden = !show;
  if (!show) return;

  const lines = state.simCommentary || [];
  const actionLine = lines.find((l) => l.key === "行动");
  els.simCommentaryAction.textContent = actionLine?.value || "等待下一步…";
  els.simCommentaryBody.innerHTML = lines
    .filter((l) => l.key !== "行动")
    .map((l) => `<div class="commentary-row"><span>${l.key}</span><p>${l.value}</p></div>`)
    .join("") || '<div class="commentary-row"><p>点击「下一步」开始演示。</p></div>';
}

function pauseSimForStreet() {
  state.awaitSimStep = true;
  state.simStepKind = "street";
  state.pendingDecision = null;
  state.simCommentary = buildStreetCommentary();
  state.message = `▶ ${streetName()}已发 — 点击「下一步」继续`;
  renderSimCommentary();
}

function pauseSimForPlayer(player) {
  state.awaitSimStep = true;
  state.simStepKind = "action";
  state.pendingDecision = decideForStep(player);
  state.simCommentary = buildProCommentary(player, state.pendingDecision, { preview: true });
  const actionText = formatDecisionAction(state.pendingDecision);
  state.message = `▶ 待执行：${player.name} ${actionText} — 点击「下一步」`;
  renderSimCommentary();
}

function executeSimStep() {
  if (!state.simAutoRunning || !isAutoSimMode()) return;

  if (!state.active) {
    aiPlayers().forEach((p) => {
      if (p.stack <= 0) rebuyAiPlayer(p);
    });
    beginHand();
    return;
  }

  if (state.awaitNextHand) {
    state.awaitNextHand = false;
    clearSimStepState();
    aiPlayers().forEach((p) => {
      if (p.stack <= 0) rebuyAiPlayer(p);
    });
    beginHand();
    return;
  }

  if (!state.awaitSimStep) return;

  if (state.simStepKind === "street") {
    state.simStepKind = null;
    state.awaitSimStep = false;
    processActionLoop();
    return;
  }

  const player = state.players[state.actionIndex];
  if (!canAct(player)) return;

  const decision = state.pendingDecision || decideForStep(player);
  state.pendingDecision = null;
  state.simCommentary = buildProCommentary(player, decision);
  state.awaitSimStep = false;
  state.simStepKind = null;

  applyAction(player, decision);
  state.actionIndex = nextIndex(state.actionIndex, (candidate) => canAct(candidate));
  state.message = `${player.name}：${formatDecisionAction(decision)}`;
  render();
  processActionLoop();
}

function scheduleAiAction(player) {
  if (!state.simAutoRunning || !isAutoPace() || !isAiPlayer(player) || !canAct(player)) return;
  if (simTimer) clearTimeout(simTimer);
  simTimer = setTimeout(() => {
    simTimer = null;
    if (!state.simAutoRunning || !canAct(player)) return;
    const decision = decideForAi(player);
    aiAction(player, decision);
  }, simActionDelay());
}

function scheduleNextSimHand() {
  if (!state.simAutoRunning || !isAutoSimMode() || !isAutoPace()) return;
  if (simTimer) clearTimeout(simTimer);
  simTimer = setTimeout(() => {
    simTimer = null;
    if (!state.simAutoRunning) return;
    aiPlayers().forEach((player) => {
      if (player.stack <= 0) rebuyAiPlayer(player);
    });
    beginHand();
  }, simHandDelay());
}

function updateAiStats(aiType) {
  const player = playerByAiType(aiType);
  if (!player) return;
  const start = state.simHandStarts[aiType] ?? player.startStack;
  const profit = player.stack - start;
  const stats = aiType === "gto" ? state.gtoStats : state.exploitStats;
  stats.handsCompleted += 1;
  stats.cumulativeProfit += profit;
  if (player.winner) stats.wins += 1;
}

function updateSimStats() {
  if (isGtoMode()) updateAiStats("gto");
  if (isExploitMode()) updateAiStats("exploit");
}

function formatBb100(profit, hands) {
  if (hands <= 0) return "0";
  const bb100 = ((profit / state.bigBlind) / hands) * 100;
  return `${bb100 >= 0 ? "+" : ""}${bb100.toFixed(1)}`;
}

function paintMetric(el, value) {
  if (!el) return;
  el.textContent = value > 0 ? `+${value}` : `${value}`;
  const metric = el.closest(".metric");
  if (metric) {
    metric.classList.toggle("positive", value > 0);
    metric.classList.toggle("negative", value < 0);
  }
}

function paintBbMetric(el, profit, hands) {
  if (!el) return;
  const bb100 = hands > 0 ? ((profit / state.bigBlind) / hands) * 100 : 0;
  el.textContent = formatBb100(profit, hands);
  const metric = el.closest(".metric");
  if (metric) {
    metric.classList.toggle("positive", bb100 > 0);
    metric.classList.toggle("negative", bb100 < 0);
  }
}

function renderAiColumn(stats, elsMap) {
  const hands = stats.handsCompleted;
  const profit = stats.cumulativeProfit;
  const winRate = hands > 0 ? Math.round((stats.wins / hands) * 100) : 0;
  const avgProfit = hands > 0 ? Math.round(profit / hands) : 0;
  elsMap.hands.textContent = `${hands}`;
  paintMetric(elsMap.profit, profit);
  paintBbMetric(elsMap.bb100, profit, hands);
  elsMap.winRate.textContent = `${winRate}%`;
  elsMap.avgProfit.textContent = avgProfit > 0 ? `+${avgProfit}` : `${avgProfit}`;
  elsMap.rebuys.textContent = `${stats.rebuys}`;
}

function renderSimPanel() {
  const show = isAutoSimMode();
  els.simStatsPanel.hidden = !show;
  els.simToggleBtn.hidden = !show;
  if (!show) return;

  const running = state.simAutoRunning;
  const modeLabel = isDualMode() ? "GTO vs 剥削" : isGtoHeroMode() ? "GTO 模拟" : "剥削模拟";
  const paceLabel = isStepPace() ? "步进演示" : "自动连播";
  els.simToggleBtn.textContent = running ? `结束${modeLabel}` : `开始${paceLabel}`;
  els.simToggleBtn.classList.toggle("danger", running);
  if (els.simStepBtn) {
    els.simStepBtn.hidden = !running || !isStepPace();
    const canStep = running && isStepPace() && (state.awaitSimStep || state.awaitNextHand || !state.active);
    els.simStepBtn.disabled = !canStep;
    els.simStepBtn.textContent = state.awaitNextHand || (!state.active && running) ? "下一步（新手）" : "下一步";
  }

  const parts = [];
  if (typeof CfrFullLoader !== "undefined") parts.push(CfrFullLoader.statusText());
  else if (typeof CfrLoader !== "undefined") parts.push(CfrLoader.statusText());
  const cfrTag = parts.join(" · ");
  const pace = isStepPace() ? "步进演示" : "自动连播";
  els.simStatsStatus.textContent = running ? `${pace}中 · ${cfrTag}` : state.gtoStats.handsCompleted + state.exploitStats.handsCompleted > 0 ? `已结束 · ${cfrTag}` : cfrTag || "等待开始";

  els.simStatsPanel.classList.toggle("dual-mode", isDualMode());
  els.simStatsPanel.classList.toggle("gto-only", isGtoHeroMode());
  els.simStatsPanel.classList.toggle("exploit-only", state.heroMode === "exploit");
  if (els.simCompare) els.simCompare.hidden = !isDualMode();
  const exploitCol = els.simStatsPanel.querySelector(".exploit-col");
  const gtoCol = els.simStatsPanel.querySelector(".gto-col");
  if (exploitCol) exploitCol.hidden = !isExploitMode();
  if (gtoCol) gtoCol.hidden = !isGtoMode();

  renderAiColumn(state.gtoStats, {
    hands: els.gtoHands,
    profit: els.gtoProfit,
    bb100: els.gtoBb100,
    winRate: els.gtoWinRate,
    avgProfit: els.gtoAvgProfit,
    rebuys: els.gtoRebuys,
  });

  if (isExploitMode()) {
    renderAiColumn(state.exploitStats, {
      hands: els.exploitHands,
      profit: els.exploitProfit,
      bb100: els.exploitBb100,
      winRate: els.exploitWinRate,
      avgProfit: els.exploitAvgProfit,
      rebuys: els.exploitRebuys,
    });
  }

  const gtoBb = state.gtoStats.handsCompleted > 0 ? parseFloat(formatBb100(state.gtoStats.cumulativeProfit, state.gtoStats.handsCompleted)) : 0;
  const exploitBb = state.exploitStats.handsCompleted > 0 ? parseFloat(formatBb100(state.exploitStats.cumulativeProfit, state.exploitStats.handsCompleted)) : 0;

  if (isDualMode() && els.simCompare) {
    const delta = exploitBb - gtoBb;
    els.simCompare.textContent = `对比：剥削 ${formatBb100(state.exploitStats.cumulativeProfit, state.exploitStats.handsCompleted)} BB/100 vs GTO ${formatBb100(state.gtoStats.cumulativeProfit, state.gtoStats.handsCompleted)} BB/100（差 ${delta >= 0 ? "+" : ""}${delta.toFixed(1)}）`;
  }

  if (isDualMode()) {
    if (state.gtoStats.handsCompleted < 8) {
      els.simInsight.textContent = "双机器人同桌对抗风格桌，样本积累后可对比 GTO 均衡与最优剥削的长期 BB/100。";
    } else if (exploitBb > gtoBb + 2) {
      els.simInsight.textContent = `剥削领先 +${(exploitBb - gtoBb).toFixed(1)} BB/100：读牌+漏洞利用压制均衡策略。${state.exploitStats.lastReason}`;
    } else if (gtoBb > exploitBb + 2) {
      els.simInsight.textContent = `GTO 领先 +${(gtoBb - exploitBb).toFixed(1)} BB/100：均衡策略更抗波动。${state.gtoStats.lastReason}`;
    } else {
      els.simInsight.textContent = `两者接近（GTO ${gtoBb.toFixed(1)} vs 剥削 ${exploitBb.toFixed(1)} BB/100），长期收益在方差内。`;
    }
  } else if (isGtoHeroMode()) {
    const bb100 = gtoBb;
    if (state.gtoStats.handsCompleted < 8) {
      els.simInsight.textContent = "样本较少，继续模拟可观察职业 GTO solver 的长期 BB/100 曲线。";
    } else if (bb100 > 4) {
      els.simInsight.textContent = `长期 BB/100 +${bb100.toFixed(1)}：职业 solver 压制桌面。${state.gtoStats.lastReason}`;
    } else if (bb100 < -4) {
      els.simInsight.textContent = `长期 BB/100 ${bb100.toFixed(1)}：风格桌反制 solver。${state.gtoStats.lastReason}`;
    } else {
      els.simInsight.textContent = `长期 BB/100 ${bb100 >= 0 ? "+" : ""}${bb100.toFixed(1)}：接近均衡波动。${state.gtoStats.lastReason}`;
    }
  } else {
    const bb100 = exploitBb;
    if (state.exploitStats.handsCompleted < 8) {
      els.simInsight.textContent = "样本较少，继续模拟可观察剥削策略对风格桌的长期收益。";
    } else if (bb100 > 4) {
      els.simInsight.textContent = `长期 BB/100 +${bb100.toFixed(1)}：剥削策略有效榨取桌面漏洞。${state.exploitStats.lastReason}`;
    } else if (bb100 < -4) {
      els.simInsight.textContent = `长期 BB/100 ${bb100.toFixed(1)}：对手调整或方差拖累剥削 EV。${state.exploitStats.lastReason}`;
    } else {
      els.simInsight.textContent = `长期 BB/100 ${bb100 >= 0 ? "+" : ""}${bb100.toFixed(1)}：剥削收益在合理区间。${state.exploitStats.lastReason}`;
    }
  }
}

function renderGtoPanel() {
  renderSimPanel();
}

function seatBlueprints() {
  const botCount = Math.max(0, state.playerCount - 1);
  if (isDualMode()) {
    return [
      { id: "gto", name: GTO_HERO_NAME, isHero: true, aiType: "gto", style: "GTO" },
      { id: "exploit", name: EXPLOIT_BOT_NAME, isHero: false, aiType: "exploit", style: "剥削" },
      ...BOT_BLUEPRINTS.slice(0, state.playerCount - 2),
    ];
  }
  if (state.heroMode === "gto") {
    return [
      { id: "hero", name: GTO_HERO_NAME, isHero: true, aiType: "gto", style: "GTO" },
      ...BOT_BLUEPRINTS.slice(0, botCount),
    ];
  }
  if (state.heroMode === "exploit") {
    return [
      { id: "hero", name: EXPLOIT_BOT_NAME, isHero: true, aiType: "exploit", style: "剥削" },
      ...BOT_BLUEPRINTS.slice(0, botCount),
    ];
  }
  return [HERO_BLUEPRINT, ...BOT_BLUEPRINTS.slice(0, botCount)];
}

function makePlayers(stack = state.initialStack) {
  return seatBlueprints().map((blueprint) => ({
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
  if ((!player.isHero || player.aiType) && player.stack <= 0) {
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
  stopSimAuto("");
  const blindParts = els.blindSelect.value.split("/").map(Number);
  state.initialStack = Number(els.stackSelect.value);
  state.smallBlind = blindParts[0];
  state.bigBlind = blindParts[1];
  state.playerCount = Number(els.playerCountSelect.value);
  state.gameMode = els.modeSelect.value;
  state.heroMode = els.heroModeSelect.value;
  syncSimPace();
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
  resetSimStats();
  if (hero()) hero().name = heroDisplayName();
  let modeHint = "新牌局已建立。";
  if (isDualMode()) modeHint = "GTO vs 剥削对比，点击「开始步进演示」逐步观看并阅读解说。";
  else if (isGtoHeroMode()) modeHint = "GTO 演示模式，点击「开始步进演示」逐步观看并阅读解说。";
  else if (state.heroMode === "exploit") modeHint = "剥削演示模式，点击「开始步进演示」逐步观看并阅读解说。";
  else if (state.gameMode === "study") modeHint = "教学模式已开启：全明牌并显示实时胜率。";
  state.message = `${modeHint} 点击“下一手牌”开始。`;
  renderSimPanel();
  render();
}

function beginHand() {
  if (state.active) return;
  if (!state.players.length) {
    newSession();
  }
  if (isAiPlayer(hero()) && hero().stack <= 0) {
    if (state.simAutoRunning) {
      rebuyAiPlayer(hero());
    } else {
      state.message = `${hero().name} 筹码归零，请开始新牌局或重新买入。`;
      render();
      return;
    }
  } else if (!isAiPlayer(hero()) && hero().stack <= 0) {
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
  state.preflopAggressor = null;
  state.gtoLine = isGtoMode() ? GtoCore.createLine() : null;
  state.message = "新一手开始。机器人会先按位置行动。";
  state.equityCache = { key: "", values: new Map() };
  state.players.forEach(resetForHand);
  if (isManualMode()) state.heroStats.hands += 1;
  if (hero()) hero().name = heroDisplayName();
  state.simHandStarts = {};
  if (isGtoMode()) {
    const gtoPlayer = playerByAiType("gto");
    if (gtoPlayer) state.simHandStarts.gto = gtoPlayer.stack;
  }
  if (isExploitMode()) {
    const exploitPlayer = playerByAiType("exploit");
    if (exploitPlayer) state.simHandStarts.exploit = exploitPlayer.stack;
  }
  if (typeof ExploitEngine !== "undefined") ExploitEngine.resetHandFlags();

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
  const read = !player.isHero || isAiPlayer(player) ? `<div class="stack-row read-row"><span>${player.read}</span></div>` : "";
  const equity = studyMode ? studyEquityMarkup(player) : "";
  const position = player.position ? `<span class="pos-badge">${player.position}</span>` : "";

  const seatClass = player.isHero ? "" : ` seat-${displayIndex + 1}`;
  return `<article class="seat${seatClass}">
    <div class="seat-info">
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
  document.body.dataset.heroMode = state.heroMode;
  document.body.dataset.simRunning = state.simAutoRunning ? "1" : "0";

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

  let profit = hero().stack - state.initialStack;
  if (isDualMode()) {
    const gtoP = playerByAiType("gto");
    const exploitP = playerByAiType("exploit");
    const gtoDelta = gtoP ? gtoP.stack - state.initialStack : 0;
    const exploitDelta = exploitP ? exploitP.stack - state.initialStack : 0;
    els.profit.textContent = `GTO ${gtoDelta > 0 ? "+" : ""}${gtoDelta} · 剥削 ${exploitDelta > 0 ? "+" : ""}${exploitDelta}`;
    els.profit.closest(".metric").classList.toggle("positive", gtoDelta + exploitDelta > 0);
    els.profit.closest(".metric").classList.toggle("negative", gtoDelta + exploitDelta < 0);
  } else {
    els.profit.textContent = profit > 0 ? `+${profit}` : `${profit}`;
    els.profit.closest(".metric").classList.toggle("positive", profit > 0);
    els.profit.closest(".metric").classList.toggle("negative", profit < 0);
  }

  const canHeroAct = state.active && state.awaitHero && canAct(hero()) && isManualMode() && !state.simAutoRunning;
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
  els.newHandBtn.disabled = state.active || state.simAutoRunning;
  els.stackSelect.disabled = state.active || state.simAutoRunning;
  els.blindSelect.disabled = state.active || state.simAutoRunning;
  els.playerCountSelect.disabled = state.active || state.simAutoRunning;
  els.modeSelect.disabled = state.active || state.simAutoRunning;
  els.heroModeSelect.disabled = state.active || state.simAutoRunning;
  els.gtoSpeedSelect.disabled = state.active || state.simAutoRunning;
  els.runTwiceSelect.disabled = state.active || state.simAutoRunning;
  els.simToggleBtn.disabled = !isAutoSimMode();
  els.actionLog.innerHTML = state.actionLog.map((line) => `<div>${line}</div>`).join("") || "<div>暂无行动</div>";
  if (isDualMode()) {
    els.heroRead.textContent = `${state.gtoStats.lastReason || "GTO"} | ${state.exploitStats.lastReason || "剥削"}`;
  } else if (isGtoHeroMode()) {
    els.heroRead.textContent = state.gtoStats.lastReason || "GTO 决策中";
  } else if (state.heroMode === "exploit") {
    els.heroRead.textContent = state.exploitStats.lastReason || "剥削决策中";
  } else {
    els.heroRead.textContent = heroProfileText();
  }
  renderSimPanel();
  renderSimCommentary();
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
  updateSimStats();
  if (state.simAutoRunning && isAutoSimMode() && isStepPace()) {
    state.awaitNextHand = true;
    state.awaitSimStep = true;
    state.simStepKind = "handend";
    state.simCommentary = buildHandEndCommentary(message);
    state.message = `本手结束 — 点击「下一步」发新手`;
    renderSimCommentary();
    render(state.message);
    return;
  }
  render(message);
  if (state.simAutoRunning && isAutoSimMode()) {
    scheduleNextSimHand();
  }
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
  if (state.simAutoRunning && isStepPace()) {
    state.simStreetJustDealt = true;
    return;
  }
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
      if (state.simStreetJustDealt) {
        state.simStreetJustDealt = false;
        pauseSimForStreet();
        return;
      }
      continue;
    }

    if (state.simStreetJustDealt) {
      state.simStreetJustDealt = false;
      pauseSimForStreet();
      return;
    }

    const player = state.players[state.actionIndex];
    if (!canAct(player)) {
      state.actionIndex = nextIndex(state.actionIndex, (candidate) => canAct(candidate));
      continue;
    }

    if (isAutoSimMode() && state.simAutoRunning && isStepPace()) {
      setSuggestedBet();
      pauseSimForPlayer(player);
      render();
      return;
    }

    if (isAiPlayer(player) && state.simAutoRunning && isAutoPace()) {
      setSuggestedBet();
      const hint = player.aiType === "exploit" ? "剥削：读漏洞 · 调整尺度 · 最大化 EV。" : "Solver：CFR+ 查表 · MDF · 混合策略。";
      render(callAmount(player) > 0 ? `${player.name}：${hint}` : `${player.name}：自动决策中…`);
      scheduleAiAction(player);
      return;
    }

    if (player.isHero && isManualMode()) {
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
  recordGtoLine(player, decision);
  if (typeof ExploitEngine !== "undefined" && isExploitMode() && !player.aiType) {
    ExploitEngine.recordAction(player, decision, gtoContext());
  }

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
      if (state.streetIndex === 0) state.preflopAggressor = player.id;
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

function aiAction(player, decision) {
  if (!state.active || !canAct(player) || !isAiPlayer(player)) return;
  if (player.isHero) state.awaitHero = false;
  applyAction(player, decision);
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
els.heroModeSelect.addEventListener("change", () => {
  if (state.active || state.simAutoRunning) return;
  state.heroMode = els.heroModeSelect.value;
  state.players = makePlayers(state.initialStack);
  if (hero()) hero().name = heroDisplayName();
  if (isManualMode()) stopSimAuto("");
  renderSimPanel();
  const hints = {
    manual: "已切换为手动操作。",
    gto: "已切换为 GTO 演示，点击「开始步进演示」逐步观看。",
    exploit: "已切换为剥削演示，点击「开始步进演示」逐步观看。",
    dual: "已切换为 GTO vs 剥削对比，点击「开始步进演示」逐步观看。",
  };
  render(hints[state.heroMode] || hints.manual);
});
els.gtoSpeedSelect.addEventListener("change", () => {
  if (state.simAutoRunning) return;
  syncSimPace();
});
els.simToggleBtn.addEventListener("click", () => {
  if (state.simAutoRunning) {
    stopSimAuto("演示已结束。");
    return;
  }
  startSimAuto();
});
els.simStepBtn?.addEventListener("click", executeSimStep);
document.addEventListener("keydown", (event) => {
  if (event.code !== "Space" && event.key !== " ") return;
  if (!state.simAutoRunning || !isStepPace()) return;
  const tag = event.target?.tagName?.toLowerCase();
  if (tag === "input" || tag === "select" || tag === "textarea") return;
  event.preventDefault();
  executeSimStep();
});
els.foldBtn.addEventListener("click", () => heroAction({ type: "fold" }));
els.checkCallBtn.addEventListener("click", handleCheckCall);
els.betRaiseBtn.addEventListener("click", handleBetRaise);
els.threeBetBtn.addEventListener("click", handleThreeBet);
els.potBetBtn.addEventListener("click", handlePotBet);
els.allInBtn.addEventListener("click", handleAllIn);
els.betAmount.addEventListener("input", () => render());

async function initCfrSolvers() {
  const tasks = [];
  if (typeof CfrLoader !== "undefined") tasks.push(CfrLoader.load());
  if (typeof CfrFullLoader !== "undefined") {
    tasks.push(
      CfrFullLoader.load().then(() => CfrFullLoader.preloadAll()),
    );
  }
  await Promise.all(tasks);
  renderSimPanel();
}
initCfrSolvers();
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
