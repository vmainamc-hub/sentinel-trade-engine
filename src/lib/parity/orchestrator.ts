import { APEX_UNIVERSE_SYMBOLS } from "@/lib/apex/universe";
import { DERIV_SYMBOLS } from "@/hooks/useDerivStream";
import { observationEngine } from "@/lib/sentinel/observation";
import { projectSentinelDossier, type ProjectableDossier } from "@/lib/parity/sentinel-projection";
import { runEngines } from "@/lib/parity/evidence/engine-runner";
import { computeSpecificParityEntryDigit } from "@/lib/parity/engine-library/engines/specific-entry-digit";
import { replayParityEntryDigit } from "@/lib/parity/dbot-replay";
import { evaluateParityPsychology } from "@/lib/parity/psychology/engine";
import type { ParityEvidence, HardVeto, SoftBlocker } from "@/lib/parity/evidence/types";
import type { CellDecision, FinalState, Parity, Parity30CellSnapshot, Parity30MarketInput, Parity30MarketSnapshot } from "./types";
import { Parity30Registry } from "./registry";
import { snapshotCell, updateCell } from "./cell";

const PARITIES: readonly Parity[] = ["EVEN", "ODD"];

function clamp(n: number, a = 0, b = 100) { return Math.max(a, Math.min(b, Number.isFinite(n) ? n : 0)); }

function dossiersFor(symbol: string): readonly ProjectableDossier[] {
  try {
    return observationEngine.getAllRanked().filter((d) => String(d.marketId) === symbol) as unknown as ProjectableDossier[];
  } catch {
    return [];
  }
}

function sentinelParitySupport(symbol: string, parity: Parity): number {
  const projections = dossiersFor(symbol).map(projectSentinelDossier).filter(Boolean);
  if (!projections.length) return 50;
  let total = 0;
  let weight = 0;
  for (const p of projections) {
    const winning = p!.identity.winningDigits;
    const evens = winning.filter((d) => d % 2 === 0).length;
    const odds = winning.length - evens;
    const tilt = winning.length ? (evens - odds) / winning.length : 0;
    const implied: Parity | null = Math.abs(tilt) >= 0.2 ? (tilt > 0 ? "EVEN" : "ODD") : (p!.identity.greenParity as Parity);
    const base = clamp(p!.score);
    const contribution = implied === parity ? base : 100 - base;
    const maturityBonus = p!.isRipe ? 10 : 0;
    const vetoPenalty = p!.hardVetoActive ? 25 : 0;
    total += clamp(contribution + maturityBonus - vetoPenalty);
    weight += 1;
  }
  return clamp(total / Math.max(1, weight));
}

function cellSpecificEvidence(evidence: readonly ParityEvidence[], parity: Parity) {
  const directional = evidence.filter((e) => e.authority === "DIRECT" || e.authority === "META");
  const bestByGroup = new Map<string, ParityEvidence>();
  for (const e of directional) {
    const existing = bestByGroup.get(e.correlationGroup);
    if (!existing || e.strength * e.confidence > existing.strength * existing.confidence) bestByGroup.set(e.correlationGroup, e);
  }
  const relevant = [...bestByGroup.values()];
  let support = 0, oppose = 0;
  const supporting: string[] = [], opposing: string[] = [];
  for (const e of relevant) {
    const w = clamp(e.strength * e.confidence * Math.max(0.25, e.sampleAuthority) * 100);
    if (e.direction === parity) { support += w; supporting.push(e.engine); }
    else if (e.direction !== "NEUTRAL") { oppose += w; opposing.push(e.engine); }
  }
  const total = Math.max(1, support + oppose);
  return { support, oppose, net: (support - oppose) / total, supporting, opposing, groups: relevant.length };
}

function filterHardBlocks(hard: readonly HardVeto[], parity: Parity): HardVeto[] {
  // EV and entropy are suitability/risk evidence in the rebuilt system, not
  // universal kill switches. True hard blocks are feed/data integrity and
  // explicit critical structural failures.
  return hard.filter((v) => {
    const applies = v.parity === null || v.parity === parity;
    if (!applies) return false;
    return ["INSUFFICIENT_DATA", "FEED_QUALITY", "CRITICAL_DANGER", "POSTERIOR_COLLAPSE"].includes(v.code);
  });
}

function softWarnings(hard: readonly HardVeto[], soft: readonly SoftBlocker[], parity: Parity): string[] {
  const out = soft.filter((b) => b.parity === null || b.parity === parity).map((b) => `${b.code}: ${b.reason}`);
  for (const h of hard) {
    if (["EV_GATE", "HIGH_ENTROPY", "MAJOR_DRIFT"].includes(h.code) && (h.parity === null || h.parity === parity)) {
      out.push(`${h.code}: ${h.reason}`);
    }
  }
  return [...new Set(out)];
}

function finalState(cell: Parity30CellSnapshot): FinalState {
  if (cell.hardBlocks.length) return "REJECTED";
  if (cell.maturity.stage === "READY" && cell.suitability >= 72) return "READY";
  if (cell.suitability >= 42 || cell.maturity.stage === "DEVELOPING" || cell.maturity.stage === "MATURE") return "WATCH";
  return "NO_EDGE";
}

function makeMarketSnapshot(input: Parity30MarketInput, registry: Parity30Registry): Parity30MarketSnapshot {
  const run = runEngines({
    symbol: input.symbol,
    displayName: input.displayName,
    digits: input.digits,
    ticks: input.ticks as any,
    sourceTickId: input.sourceTickId,
    analysisVersion: input.analysisVersion,
    timestamp: input.timestamp,
    payoutRate: input.payoutRate ?? 0.95,
  }, `parity30:${input.symbol}`);

  const psychologyUpdate = evaluateParityPsychology(
    input.symbol,
    run.intelligence,
    input.timestamp,
    // Each market has two cells; psychology history is carried by the cell
    // that is currently being updated below. The engine itself is stateless
    // with respect to market data.
    undefined,
  );
  const psychology = psychologyUpdate.snapshot;

  const cells: Parity30CellSnapshot[] = [];
  for (const parity of PARITIES) {
    const state = registry.state(input.symbol, parity);
    const sentinel = sentinelParitySupport(input.symbol, parity);
    const specific = cellSpecificEvidence(run.evidence, parity);
    const hard = filterHardBlocks(run.hardVetoes, parity);
    const warnings = softWarnings(run.hardVetoes, run.softBlockers, parity);
    const breakdown = updateCell(
      state,
      parity,
      run.evidence,
      hard,
      run.softBlockers,
      {
        regimeCompatible: run.context.regimeCompatible[parity],
        statisticalAuthority: run.context.statisticalStrength === "STRONG" ? 1 : run.context.statisticalStrength === "MODERATE" ? 0.65 : 0.3,
        dangerScore: run.context.dangerScore,
        feedQuality: run.context.feedQuality,
      },
      sentinel,
      input.timestamp,
      run.intelligence,
      psychology,
    );
    // Preserve the canonical grouped evidence numbers from the same run.
    state.supportScore = clamp(specific.support / Math.max(1, specific.groups));
    state.conflictScore = clamp(specific.oppose / Math.max(1, specific.groups));
    state.netEvidence = specific.net;
    state.supportingEngines = specific.supporting;
    state.opposingEngines = specific.opposing;
    const snap = snapshotCell(registry.identity(input.symbol, parity), state, breakdown);
    cells.push(snap);
  }

  const decisions: CellDecision[] = cells.map((cell) => ({
    cell,
    rank: 0,
    finalState: finalState(cell),
    reasons: Object.freeze([
      `${cell.suitability.toFixed(0)}/100 suitability from grouped engine evidence.`,
      `${cell.maturity.score.toFixed(0)}/100 maturity from persistence and clean observations.`,
      `${cell.supportingEngines.length} supporting engine groups vs ${cell.opposingEngines.length} opposing groups.`,
      cell.hardBlocks.length ? `Hard block: ${cell.hardBlocks[0]}` : "No true hard structural block.",
    ]),
  }));
  decisions.sort((a, b) => b.cell.suitability - a.cell.suitability || b.cell.maturity.score - a.cell.maturity.score || a.cell.identity.index - b.cell.identity.index);
  decisions.forEach((d, i) => (d.rank = i + 1));

  // Entry and replay are downstream of analytical readiness. They cannot alter
  // the parity ranking; they only determine execution readiness of the winner.
  const top = decisions.find((d) => d.finalState === "READY") ?? decisions[0] ?? null;
  let finalCellId: string | null = null;
  let finalParity: Parity | null = null;
  let finalEntryDigit: number | null = null;
  let finalStateValue: FinalState = "NO_EDGE";
  const reasoning: string[] = [
    `${new Set(run.evidence.map((e) => e.engine)).size} evidence streams feed the two parity hypotheses; engines do not emit independent final signals.`,
    `30-cell universe is persistent: ${registry.getAllIdentities().length} cells = ${APEX_UNIVERSE_SYMBOLS.length} markets × EVEN/ODD.`,
  ];

  if (top) {
    const candidate = top.cell;
    const entry = candidate.maturity.stage === "READY" && candidate.suitability >= 72 && input.digits.length >= 60
      ? computeSpecificParityEntryDigit([...input.digits], candidate.identity.parity === "EVEN" ? "DIGITEVEN" : "DIGITODD", input.symbol, input.displayName)
      : null;
    if (entry && entry.entryDigit !== null) {
      const replay = replayParityEntryDigit({ digits: input.digits, entryDigit: entry.entryDigit, targetParity: candidate.identity.parity, oosFraction: 0.3 });
      const state = registry.state(input.symbol, candidate.identity.parity);
      state.entryDigit = entry.entryDigit;
      state.entryReady = true;
      state.dbotValidated = replay.validated;
      const updated = snapshotCell(candidate.identity, state, candidate.suitabilityBreakdown);
      const idx = decisions.findIndex((d) => d.cell.identity.cellId === candidate.identity.cellId);
      if (idx >= 0) decisions[idx] = { ...decisions[idx], cell: updated };
      if (replay.validated) {
        finalCellId = candidate.identity.cellId;
        finalParity = candidate.identity.parity;
        finalEntryDigit = entry.entryDigit;
        finalStateValue = "READY";
        reasoning.push(`FINAL CELL: ${candidate.identity.marketId} ${candidate.identity.parity}. Entry digit ${entry.entryDigit} is downstream and replay-validated.`);
      } else {
        reasoning.push(`Top cell ${candidate.identity.cellId} is analytically READY, but replay validation is not sufficient; no execution signal is emitted.`);
      }
    } else {
      reasoning.push(`Top analytical cell ${candidate.identity.cellId} is ${top.finalState}, but entry readiness is not yet established.`);
    }
  }

  if (!finalCellId) {
    const watch = decisions.find((d) => d.finalState === "WATCH");
    if (watch) reasoning.push(`WATCH: ${watch.cell.identity.cellId} leads development, but it has not reached mature execution readiness.`);
  }

  const refreshedCells = decisions.map((d) => d.cell).sort((a, b) => a.identity.index - b.identity.index);
  return Object.freeze({
    timestamp: input.timestamp,
    market: { symbol: input.symbol, displayName: input.displayName },
    source: { sourceTickId: input.sourceTickId, analysisVersion: input.analysisVersion, digitCount: input.digits.length },
    cells: Object.freeze(refreshedCells),
    ranking: Object.freeze(decisions),
    finalCellId,
    finalParity,
    finalState: finalStateValue,
    finalEntryDigit,
    engineCount: new Set(run.evidence.map((e) => e.engine)).size,
    evidence: run.evidence,
    intelligence: run.intelligence,
    psychology,
    context: run.context,
    hardVetoes: run.hardVetoes,
    softBlockers: run.softBlockers,
    reasoning: Object.freeze(reasoning),
  });
}

export function analyzeMarket30(input: Parity30MarketInput, registry: Parity30Registry) {
  return makeMarketSnapshot(input, registry);
}

export function analyzeUniverse30(inputs: readonly Parity30MarketInput[], registry: Parity30Registry) {
  const snapshots = inputs.filter((i) => PARITY_MARKETS_SET.has(i.symbol)).map((i) => makeMarketSnapshot(i, registry));
  const cells = snapshots.flatMap((s) => s.cells);
  const ranking = [...cells]
    .sort((a, b) => b.suitability - a.suitability || b.maturity.score - a.maturity.score || a.identity.index - b.identity.index)
    .map((cell, i) => ({ cell, rank: i + 1, finalState: finalState(cell), reasons: [`${cell.identity.marketId} ${cell.identity.parity}: ${cell.suitability.toFixed(0)} suitability / ${cell.maturity.score.toFixed(0)} maturity.`] }));
  return Object.freeze({ snapshots: Object.freeze(snapshots), cells: Object.freeze(cells), ranking: Object.freeze(ranking), engineCount: new Set(snapshots.flatMap((s) => s.evidence.map((e) => e.engine))).size, cellCount: PARITY_MARKETS_SET.size * 2 });
}

const PARITY_MARKETS_SET = new Set(APEX_UNIVERSE_SYMBOLS);

export function marketName(symbol: string) {
  return DERIV_SYMBOLS.find((s) => s.symbol === symbol)?.name ?? symbol;
}

export function makeInput(symbol: string, digits: readonly number[], ticks: readonly any[], version: number, now = Date.now()): Parity30MarketInput {
  const last = ticks[ticks.length - 1];
  return { symbol, displayName: marketName(symbol), digits, ticks, sourceTickId: `${symbol}:${last?.t ?? 0}:${digits.length}:${digits[digits.length - 1] ?? "x"}`, analysisVersion: version, timestamp: now, payoutRate: 0.95 };
}
