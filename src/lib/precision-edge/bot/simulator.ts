// BOT SIMULATOR — replays the bot's exact rules over historical digits.
// Every score in the system is anchored to this: it measures the bot itself,
// not a generic digit edge.
import {
  BOT_SPEC,
  barrierFor,
  botTrigger,
  digitWins,
  legFor,
  type BotBarrier,
  type BotLeg,
} from "./spec";

export interface SimTrade {
  index: number;
  direction: "OVER" | "UNDER";
  barrier: BotBarrier;
  leg: BotLeg;
  countLoss: number;
  stake: number;
  digit: number;
  win: boolean;
  pnl: number;
}

export interface SimResult {
  window: number;
  ticks: number;
  trades: number;
  wins: number;
  winRate: number;
  /** Profit in units of the base stake. */
  pnl: number;
  /** Profit per trade in units of the base stake. */
  expectancy: number;
  longestLossStreak: number;
  /** Longest run of consecutive simulated wins (persistence evidence). */
  longestWinStreak: number;
  /** Consecutive simulated wins at the end of the window. */
  currentWinStreak: number;
  /** Worst equity drawdown in stake multiples. */
  maxDrawdownStakes: number;
  /** Largest stake the ladder ever demanded, in base-stake multiples. */
  peakStake: number;
  freshWinRate: number;
  recoveryWinRate: number;
  overTrades: number;
  underTrades: number;
}

export interface SimOptions {
  ticksAnalyzed?: number;
  /** @deprecated Ignored. A settled contract consumes its settlement tick; no artificial cooldown is inserted. */
  waitTicks?: number;
  martingaleFactor?: number;
  payout?: Record<BotBarrier, number>;
  /** CountLoss the simulation starts from — lets the UI simulate the live leg. */
  startCountLoss?: number;
  collectTrades?: boolean;
}

/** Replay the bot over `digits` (oldest → newest). Pure. */
export function simulateBot(
  digits: number[],
  opts: SimOptions = {},
): SimResult & { trades_: SimTrade[] } {
  const ticksAnalyzed = opts.ticksAnalyzed ?? BOT_SPEC.ticksAnalyzed;
  const factor = opts.martingaleFactor ?? BOT_SPEC.martingaleFactor;
  const payout = opts.payout ?? BOT_SPEC.payout;

  const trades: SimTrade[] = [];
  let countLoss = Math.max(0, opts.startCountLoss ?? 0);
  let pnl = 0;
  let peakEquity = 0;
  let maxDd = 0;
  let wins = 0;
  let lossStreak = 0;
  let longestLossStreak = 0;
  let winStreak = 0;
  let longestWinStreak = 0;
  let peakStake = 1;
  let freshWins = 0,
    freshTrades = 0,
    recWins = 0,
    recTrades = 0;
  let overTrades = 0,
    underTrades = 0;

  // Exact non-overlapping DBot cadence:
  // opening at T -> settlement at T+1 -> next possible opening at T+2.
  // A settlement tick is NEVER reused as the next opening tick.
  let i = ticksAnalyzed;
  while (i < digits.length) {
    const trigger = botTrigger(digits.slice(i - ticksAnalyzed, i), ticksAnalyzed);
    if (trigger.direction === "WAIT") {
      i += 1;
      continue;
    }

    const direction = trigger.direction;
    const leg = legFor(countLoss);
    const barrier = barrierFor(direction, leg);
    const stake = Math.pow(factor, countLoss);
    peakStake = Math.max(peakStake, stake);

    // A contract needs the following tick to settle. An incomplete final
    // opening is not counted as a trade.
    if (i + 1 >= digits.length) break;
    const outcomeDigit = digits[i + 1];
    const win = digitWins(outcomeDigit, direction, barrier);
    const tradePnl = win ? stake * (payout[barrier] ?? 0.4) : -stake;
    pnl += tradePnl;

    if (win) {
      wins++;
      lossStreak = 0;
      winStreak++;
      longestWinStreak = Math.max(longestWinStreak, winStreak);
      countLoss = 0;
    } else {
      lossStreak++;
      winStreak = 0;
      longestLossStreak = Math.max(longestLossStreak, lossStreak);
      countLoss++;
    }
    if (leg === "fresh") {
      freshTrades++;
      if (win) freshWins++;
    } else {
      recTrades++;
      if (win) recWins++;
    }
    if (direction === "OVER") overTrades++;
    else underTrades++;

    peakEquity = Math.max(peakEquity, pnl);
    maxDd = Math.max(maxDd, peakEquity - pnl);

    if (opts.collectTrades) {
      trades.push({
        index: i,
        direction,
        barrier,
        leg,
        countLoss,
        stake,
        digit: outcomeDigit,
        win,
        pnl: tradePnl,
      });
    }

    // Consume T and T+1. T+1 is settlement only; T+2 is the next opening.
    i += 2;
  }

  const total = freshTrades + recTrades;
  return {
    window: digits.length,
    ticks: digits.length,
    trades: total,
    wins,
    winRate: total ? wins / total : 0,
    pnl,
    expectancy: total ? pnl / total : 0,
    longestLossStreak,
    longestWinStreak,
    currentWinStreak: winStreak,
    maxDrawdownStakes: maxDd,
    peakStake,
    freshWinRate: freshTrades ? freshWins / freshTrades : 0,
    recoveryWinRate: recTrades ? recWins / recTrades : 0,
    overTrades,
    underTrades,
    trades_: trades,
  };
}

export interface EntryDigitSimTrade {
  /** Opening tick index. The settlement is always index + 1. */
  openingIndex: number;
  settlementIndex: number;
  entryDigit: number;
  settlementDigit: number;
  direction: "OVER" | "UNDER";
  barrier: BotBarrier;
  leg: BotLeg;
  countLossBefore: number;
  countLossAfter: number;
  stake: number;
  win: boolean;
  pnl: number;
}

export interface EntryDigitSimResult {
  entryDigit: number;
  direction: "OVER" | "UNDER";
  barrier: BotBarrier;
  ticks: number;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  pnl: number;
  expectancy: number;
  longestWinStreak: number;
  currentWinStreak: number;
  longestLossStreak: number;
  fourWinRuns: number;
  reachedFourWins: boolean;
  maxDrawdownStakes: number;
  peakStake: number;
  freshWinRate: number;
  recoveryWinRate: number;
  /** Same replay on the held-out final portion of the history. */
  outOfSample: { trades: number; wins: number; winRate: number };
  trades_: EntryDigitSimTrade[];
}

/**
 * Replay the exact DBot contract cadence for ONE forced entry digit.
 *
 * The supplied digit is the opening trigger. Once it appears at T, the bot
 * opens exactly one contract and resolves it from T+1. T+1 is consumed as the
 * settlement tick and can never be the opening tick of the next run. The next
 * eligible opening is T+2. No artificial cooldown is applied.
 *
 * Direction is fixed by the candidate cell; the DBot's fresh/recovery barrier
 * and martingale state are still taken from BOT_SPEC. This isolates the
 * question: "If I enter through digit X, how does this DBot perform?"
 */
export function simulateBotForEntryDigit(
  digits: number[],
  entryDigit: number,
  direction: "OVER" | "UNDER",
  opts: SimOptions & { oosFraction?: number } = {},
): EntryDigitSimResult {
  const factor = opts.martingaleFactor ?? BOT_SPEC.martingaleFactor;
  const payout = opts.payout ?? BOT_SPEC.payout;
  const clean = digits.filter((d) => Number.isInteger(d) && d >= 0 && d <= 9);
  const oosFraction = Math.max(0.1, Math.min(0.5, opts.oosFraction ?? 0.3));
  const oosStart = Math.floor(clean.length * (1 - oosFraction));
  const trades: EntryDigitSimTrade[] = [];

  let countLoss = Math.max(0, opts.startCountLoss ?? 0);
  let wins = 0;
  let losses = 0;
  let pnl = 0;
  let winStreak = 0;
  let longestWinStreak = 0;
  let lossStreak = 0;
  let longestLossStreak = 0;
  let fourWinRuns = 0;
  let previousWinStreak = 0;
  let peakEquity = 0;
  let maxDd = 0;
  let peakStake = 1;
  let freshTrades = 0;
  let freshWins = 0;
  let recoveryTrades = 0;
  let recoveryWins = 0;

  let i = 0;
  while (i + 1 < clean.length) {
    if (clean[i] !== entryDigit) {
      i += 1;
      continue;
    }

    const leg = legFor(countLoss);
    const barrier = barrierFor(direction, leg);
    const stake = Math.pow(factor, countLoss);
    const settlementDigit = clean[i + 1];
    const win = digitWins(settlementDigit, direction, barrier);
    const countLossBefore = countLoss;
    const tradePnl = win ? stake * (payout[barrier] ?? 0.4) : -stake;
    pnl += tradePnl;
    peakStake = Math.max(peakStake, stake);

    if (win) {
      wins += 1;
      lossStreak = 0;
      winStreak += 1;
      longestWinStreak = Math.max(longestWinStreak, winStreak);
      if (winStreak >= 4 && previousWinStreak < 4) fourWinRuns += 1;
      previousWinStreak = winStreak;
      countLoss = 0;
    } else {
      losses += 1;
      lossStreak += 1;
      longestLossStreak = Math.max(longestLossStreak, lossStreak);
      winStreak = 0;
      previousWinStreak = 0;
      countLoss += 1;
    }

    if (leg === "fresh") {
      freshTrades += 1;
      if (win) freshWins += 1;
    } else {
      recoveryTrades += 1;
      if (win) recoveryWins += 1;
    }

    peakEquity = Math.max(peakEquity, pnl);
    maxDd = Math.max(maxDd, peakEquity - pnl);

    if (opts.collectTrades) {
      trades.push({
        openingIndex: i,
        settlementIndex: i + 1,
        entryDigit,
        settlementDigit,
        direction,
        barrier,
        leg,
        countLossBefore,
        countLossAfter: countLoss,
        stake,
        win,
        pnl: tradePnl,
      });
    }

    // T is opening, T+1 is settlement. Never reuse T+1.
    i += 2;
  }

  // Independent held-out evaluation with no martingale carry-in. It uses the
  // same exact opening/settlement cadence but does not leak the training state.
  let oi = oosStart;
  let oosTrades = 0;
  let oosWins = 0;
  while (oi + 1 < clean.length) {
    if (clean[oi] !== entryDigit) {
      oi += 1;
      continue;
    }
    const barrier = barrierFor(direction, "fresh");
    if (digitWins(clean[oi + 1], direction, barrier)) oosWins += 1;
    oosTrades += 1;
    oi += 2;
  }

  return {
    entryDigit,
    direction,
    barrier: barrierFor(direction, legFor(Math.max(0, opts.startCountLoss ?? 0))),
    ticks: clean.length,
    trades: wins + losses,
    wins,
    losses,
    winRate: wins + losses ? wins / (wins + losses) : 0,
    pnl,
    expectancy: wins + losses ? pnl / (wins + losses) : 0,
    longestWinStreak,
    currentWinStreak: winStreak,
    longestLossStreak,
    fourWinRuns,
    reachedFourWins: longestWinStreak >= 4,
    maxDrawdownStakes: maxDd,
    peakStake,
    freshWinRate: freshTrades ? freshWins / freshTrades : 0,
    recoveryWinRate: recoveryTrades ? recoveryWins / recoveryTrades : 0,
    outOfSample: { trades: oosTrades, wins: oosWins, winRate: oosTrades ? oosWins / oosTrades : 0 },
    trades_: trades,
  };
}

/** Test every possible opening digit against the exact non-overlapping DBot cadence. */
export function simulateAllEntryDigits(
  digits: number[],
  direction: "OVER" | "UNDER",
  opts: SimOptions & { oosFraction?: number } = {},
): EntryDigitSimResult[] {
  return Array.from({ length: 10 }, (_, entryDigit) =>
    simulateBotForEntryDigit(digits, entryDigit, direction, opts),
  );
}

/** Run the simulator across several windows at once. */
export function simulateWindows(
  digits: number[],
  windows: number[],
  opts: SimOptions = {},
): SimResult[] {
  return windows
    .map((w) => {
      const slice = digits.slice(-w);
      if (slice.length < (opts.ticksAnalyzed ?? BOT_SPEC.ticksAnalyzed) + 2) return null;
      const r = simulateBot(slice, opts);
      return { ...r, window: w };
    })
    .filter((r): r is SimResult & { trades_: SimTrade[] } => r !== null);
}

/**
 * Can the martingale ladder survive from the current CountLoss?
 * Uses the simulated loss-streak distribution against the ladder depth the
 * trader is willing to fund.
 */
export function martingaleSurvival(
  sim: SimResult,
  countLoss: number,
  depth: number,
  factor = BOT_SPEC.martingaleFactor,
): { survivable: boolean; headroom: number; requiredStake: number; score: number } {
  const remaining = Math.max(0, depth - countLoss);
  const headroom = remaining - sim.longestLossStreak;
  const requiredStake = Math.pow(factor, countLoss + Math.max(0, sim.longestLossStreak));
  const score = Math.max(0, Math.min(100, 50 + headroom * 18));
  return { survivable: headroom >= 0, headroom, requiredStake, score };
}
