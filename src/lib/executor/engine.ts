// SENTINEL STANDALONE SIGNAL EXECUTION & TRADE MANAGEMENT ENGINE
// Fully autonomous trading machine operating inside Sentinel.
// Receives signals from Sentinel analysis, loads them independently, and executes via Deriv API.
// Does NOT decide if a signal is analytically good — executes based on user risk and auto policy.

import { DerivClient } from "@/lib/deriv/api";
import { derivBus } from "@/lib/deriv/tick-bus";
import { riskManager } from "./risk-manager";
import { executionJournal } from "./execution-journal";
import { calculateStake } from "./stake-calculator";
import { validateSignalStructure } from "./signal-adapter";
import type {
  ExecutionMode,
  ExecutionTrigger,
  ExecutorStatus,
  ExecutionSignal,
  RiskSettings,
  OpenContract,
  GateEvaluationResult,
  SignalQueueItem,
  SignalQueueState,
  AutoExecutionState,
  SessionState,
} from "./types";
import { DEFAULT_RISK_SETTINGS } from "./types";

export interface AccountSession {
  loginid: string;
  token: string;
  currency: string;
  balance: number;
  isVirtual: boolean;
  connected: boolean;
}

const SETTINGS_KEY = "sentinel.executor.settings.v2";
const MAX_QUEUE_ITEMS = 50;

class SentinelExecutionEngine {
  private mode: ExecutionMode = "PAPER"; // Default to PAPER for safety
  private autoState: AutoExecutionState = "OFF"; // Default to OFF
  private pauseReason?: string;

  private riskSettings: RiskSettings = { ...DEFAULT_RISK_SETTINGS };

  private activeAccount: AccountSession | null = null;
  private derivClient: DerivClient | null = null;

  // Signal Queue
  private signalQueue: SignalQueueItem[] = [];
  private activeStagedSignal: ExecutionSignal | null = null;

  // Open Contracts & Subscriptions
  private openContracts = new Map<string, OpenContract>();
  private activeSubIds = new Map<string, string>(); // contractId -> ws subId
  private listeners = new Set<() => void>();

  // Session Metrics & Recovery
  private sessionState: SessionState = {
    startingBalance: null,
    sessionProfit: 0,
    sessionLoss: 0,
    netPnl: 0,
    tradesCount: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    consecutiveLosses: 0,
    currentRecoveryStep: 0,
    currentCalculatedStake: DEFAULT_RISK_SETTINGS.stake,
    isTargetProfitReached: false,
    isStopLossReached: false,
    isMaxConsecutiveLossesReached: false,
    cooldownUntil: 0,
    autoState: "OFF",
  };

  private lastExecutionTime = 0;
  private lastIncomingTickTime = Date.now();
  private pipelineStep: string = "IDLE";
  private latestError: string | null = null;

  constructor() {
    this.loadPersistedSettings();
    this.initTickListener();
    this.recalculateEffectiveStake();
  }

  private loadPersistedSettings() {
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem(SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.riskSettings = { ...DEFAULT_RISK_SETTINGS, ...parsed };
      }
    } catch {
      this.riskSettings = { ...DEFAULT_RISK_SETTINGS };
    }
  }

  private persistSettings() {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.riskSettings));
    } catch {
      // ignore
    }
  }

  private initTickListener() {
    // Monitor global Deriv tick flow to track feed health and paper execution
    derivBus.onTick(() => {
      this.lastIncomingTickTime = Date.now();
    });
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  // --- Configuration & State Getters ---

  getMode(): ExecutionMode {
    return this.mode;
  }

  setMode(mode: ExecutionMode) {
    this.mode = mode;
    executionJournal.logEvent({
      type: "RISK_CHECK_PASSED",
      signalId: "SYS",
      message: `Execution mode changed to ${mode} (${mode === "LIVE" ? "REAL MONEY" : "SIMULATED"})`,
    });
    this.recalculateEffectiveStake();
    this.notify();
  }

  getAutoState(): AutoExecutionState {
    return this.autoState;
  }

  isAutoArmed(): boolean {
    return this.autoState === "ON";
  }

  setAutoState(state: AutoExecutionState, reason?: string) {
    this.autoState = state;
    this.pauseReason = reason;
    this.sessionState.autoState = state;
    this.sessionState.pauseReason = reason;

    if (state === "ON") {
      executionJournal.logEvent({
        type: "RISK_CHECK_PASSED",
        signalId: "SYS",
        message: "Auto Execution MASTER SWITCH turned ON",
      });
      // Immediately evaluate and execute any staged or pending signal
      setTimeout(() => this.executeNextPendingAutoSignal(), 50);
    } else if (state === "PAUSED") {
      executionJournal.logEvent({
        type: "AUTO_PAUSED",
        signalId: "SYS",
        message: `Auto Execution PAUSED: ${reason || "User or Safety Pause"}`,
      });
    } else {
      executionJournal.logEvent({
        type: "RISK_CHECK_PASSED",
        signalId: "SYS",
        message: "Auto Execution turned OFF",
      });
    }

    this.notify();
  }

  pauseAuto(reason: string = "Manual Pause") {
    this.setAutoState("PAUSED", reason);
  }

  resumeAuto() {
    this.setAutoState("ON");
  }

  stopAutoTrading() {
    // Emergency stop: switches auto state immediately to OFF, preserves records & open trades
    this.setAutoState("OFF", "Emergency Stop Triggered");
    executionJournal.logEvent({
      type: "EMERGENCY_STOP",
      signalId: "SYS",
      message: "EMERGENCY STOP TRIGGERED: Auto execution stopped immediately.",
    });
    this.notify();
  }

  getRiskSettings(): RiskSettings {
    return { ...this.riskSettings };
  }

  updateRiskSettings(update: Partial<RiskSettings>) {
    this.riskSettings = { ...this.riskSettings, ...update };
    this.persistSettings();
    this.recalculateEffectiveStake();
    this.notify();
  }

  setAccount(account: AccountSession | null, client: DerivClient | null) {
    this.activeAccount = account;
    this.derivClient = client;
    if (account && this.sessionState.startingBalance === null) {
      this.sessionState.startingBalance = account.balance;
    }
    this.recalculateEffectiveStake();
    this.notify();
  }

  getAccount(): AccountSession | null {
    return this.activeAccount;
  }

  getSessionState(): SessionState {
    return { ...this.sessionState };
  }

  resetSessionMetrics() {
    this.sessionState = {
      ...this.sessionState,
      sessionProfit: 0,
      sessionLoss: 0,
      netPnl: 0,
      tradesCount: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      consecutiveLosses: 0,
      currentRecoveryStep: 0,
      isTargetProfitReached: false,
      isStopLossReached: false,
      isMaxConsecutiveLossesReached: false,
      cooldownUntil: 0,
      pauseReason: undefined,
    };
    if (this.activeAccount) {
      this.sessionState.startingBalance = this.activeAccount.balance;
    }
    this.recalculateEffectiveStake();
    this.notify();
  }

  getSignalQueue(): SignalQueueItem[] {
    return [...this.signalQueue];
  }

  clearSignalQueue() {
    this.signalQueue = [];
    this.notify();
  }

  getStagedSignal(): ExecutionSignal | null {
    return this.activeStagedSignal;
  }

  stageSignal(signal: ExecutionSignal | null) {
    this.activeStagedSignal = signal;
    if (signal) {
      const qItem = this.signalQueue.find((q) => q.signal.id === signal.id);
      if (qItem && qItem.state === "RECEIVED") {
        qItem.state = "LOADED";
      }
      executionJournal.logEvent({
        type: "SIGNAL_LOADED",
        signalId: signal.id,
        message: `Signal ${signal.id} loaded into execution staging`,
        details: { market: signal.market, contract: signal.contractLabel },
      });
    }
    this.notify();
  }

  getOpenContracts(): OpenContract[] {
    return Array.from(this.openContracts.values());
  }

  getPipelineStep(): string {
    return this.pipelineStep;
  }

  getLatestError(): string | null {
    return this.latestError;
  }

  getStatus(): ExecutorStatus {
    const feedAge = Date.now() - this.lastIncomingTickTime;
    if (feedAge > 7000) {
      return "FEED_STALE";
    }

    if (this.mode === "LIVE" && (!this.activeAccount?.connected || !this.derivClient)) {
      return "ACCOUNT_DISCONNECTED";
    }

    if (this.pipelineStep === "PROPOSAL" || this.pipelineStep === "BUYING") {
      return "EXECUTING";
    }

    if (this.autoState === "PAUSED") {
      return "PAUSED";
    }

    if (this.autoState === "ON") {
      return "ARMED";
    }

    return "AUTO_OFF";
  }

  // --- Authoritative Stake & Recovery Calculator ---

  private recalculateEffectiveStake(): number {
    const calc = calculateStake({
      baseStake: this.riskSettings.baseStake || this.riskSettings.stake,
      martingaleEnabled: this.riskSettings.martingaleEnabled,
      martingaleMultiplier: this.riskSettings.martingaleMultiplier,
      recoveryStep: this.sessionState.currentRecoveryStep,
      maxStake: this.riskSettings.maxStake,
      maxRecoveryStake: this.riskSettings.maxRecoveryStake,
      accountBalance:
        this.mode === "LIVE"
          ? this.activeAccount?.balance
          : 10000,
    });

    this.sessionState.currentCalculatedStake = calc.stake;
    return calc.stake;
  }

  getEffectiveNextStake(): number {
    return this.recalculateEffectiveStake();
  }

  // --- Independent Signal Reception & Queue ---

  /**
   * Receives an incoming signal from Sentinel.
   * Loads it immediately into the Executor's Incoming Signals Queue.
   * Does NOT reject or filter based on Sentinel analytical classification.
   */
  receiveSignal(signal: ExecutionSignal): void {
    const structCheck = validateSignalStructure(signal);
    const existingIndex = this.signalQueue.findIndex((item) => item.signal.id === signal.id);

    const queueState: SignalQueueState = structCheck.valid ? "RECEIVED" : "REJECTED";
    const queueItem: SignalQueueItem = {
      signal,
      state: queueState,
      receivedAt: Date.now(),
      rejectionReason: structCheck.valid ? undefined : structCheck.reason,
    };

    if (existingIndex >= 0) {
      // Update existing item while preserving active/executing states
      const prev = this.signalQueue[existingIndex];
      if (prev.state === "EXECUTING" || prev.state === "EXECUTED") {
        return;
      }
      this.signalQueue[existingIndex] = queueItem;
    } else {
      // Prepend to top of incoming queue
      this.signalQueue.unshift(queueItem);
      if (this.signalQueue.length > MAX_QUEUE_ITEMS) {
        this.signalQueue.length = MAX_QUEUE_ITEMS;
      }
    }

    // Auto-stage first valid signal if none currently active
    if (!this.activeStagedSignal && structCheck.valid) {
      this.activeStagedSignal = signal;
    }

    this.lastIncomingTickTime = Date.now();

    executionJournal.logEvent({
      type: "SIGNAL_RECEIVED",
      signalId: signal.id,
      message: `Incoming signal queued: ${signal.market} ${signal.contractLabel} (Sentinel status: ${signal.sentinelStatus})`,
      details: {
        score: signal.score,
        confidence: signal.confidence,
        sentinelStatus: signal.sentinelStatus,
      },
    });

    // Check Auto Execution Policy
    if (this.autoState === "ON" && structCheck.valid) {
      this.processAutoExecution(signal, queueItem);
    }

    this.notify();
  }

  /**
   * Evaluates and executes any pending or staged unexecuted signal when AUTO turns on.
   */
  executeNextPendingAutoSignal(): void {
    if (this.autoState !== "ON") return;

    // Check if there are unexecuted signals in the queue
    const pendingItem = this.signalQueue.find(
      (item) => item.state === "RECEIVED" || item.state === "LOADED"
    );
    if (pendingItem) {
      this.processAutoExecution(pendingItem.signal, pendingItem);
      return;
    }

    // Or execute active staged signal if present
    if (this.activeStagedSignal) {
      const existing = this.signalQueue.find((i) => i.signal.id === this.activeStagedSignal!.id);
      if (!existing || existing.state === "RECEIVED" || existing.state === "LOADED") {
        const item = existing ?? {
          signal: this.activeStagedSignal,
          state: "RECEIVED" as SignalQueueState,
          receivedAt: Date.now(),
        };
        if (!existing) this.signalQueue.unshift(item);
        this.processAutoExecution(this.activeStagedSignal, item);
      }
    }
  }

  /**
   * Evaluates and dispatches a signal when AUTO mode is active.
   */
  private processAutoExecution(signal: ExecutionSignal, queueItem: SignalQueueItem) {
    const effectiveStake = this.recalculateEffectiveStake();
    const gate = this.evaluateGates(signal, "AUTO", effectiveStake);

    if (!gate.ok) {
      queueItem.state = "SKIPPED";
      queueItem.rejectionReason = gate.reason;
      return;
    }

    // All execution gates passed -> update state and execute
    queueItem.state = "EXECUTING";
    this.notify();

    void this.executeSignal(signal, "AUTO", effectiveStake).then((res) => {
      if (res.ok) {
        queueItem.state = "EXECUTED";
        queueItem.executedContractId = res.contractId;
      } else {
        queueItem.state = "REJECTED";
        queueItem.rejectionReason = res.error;
      }
      this.notify();
    });
  }

  /**
   * Evaluates all execution gates for a candidate trade.
   */
  evaluateGates(
    signal: ExecutionSignal,
    trigger: ExecutionTrigger,
    stakeOverride?: number
  ): GateEvaluationResult {
    const effectiveStake = stakeOverride ?? this.recalculateEffectiveStake();
    const feedAge = Date.now() - this.lastIncomingTickTime;

    return riskManager.evaluateExecutionGates({
      signal,
      mode: this.mode,
      isAutoTrigger: trigger === "AUTO",
      autoState: this.autoState,
      risk: this.riskSettings,
      session: this.sessionState,
      account: {
        connected: this.mode === "PAPER" ? true : !!this.activeAccount?.connected,
        loginid: this.mode === "PAPER" ? "PAPER_VIRTUAL" : this.activeAccount?.loginid,
        balance: this.mode === "PAPER" ? 10000 : this.activeAccount?.balance,
        currency: this.mode === "PAPER" ? "USD" : this.activeAccount?.currency,
      },
      feedFresh: feedAge <= 5000,
      lastTickAgeMs: feedAge,
      openContractsCount: Array.from(this.openContracts.values()).filter((c) => c.status === "open").length,
      effectiveStake,
    });
  }

  /**
   * The Single Authoritative Execution Pipeline used by both Manual and Auto execution.
   */
  async executeSignal(
    signal: ExecutionSignal,
    trigger: ExecutionTrigger,
    customStake?: number
  ): Promise<{ ok: boolean; contractId?: string; error?: string }> {
    const mode = this.mode;
    const accountId = mode === "PAPER" ? "PAPER_VIRTUAL" : this.activeAccount?.loginid || "ANONYMOUS";
    const lockKey = `${signal.id}:${accountId}`;

    const effectiveStake = customStake ?? this.recalculateEffectiveStake();

    // 1. Double check and acquire execution lock (Prevent duplicate requests)
    if (!riskManager.acquireLock(lockKey)) {
      const err = `Execution lock active for signal ${signal.id}`;
      this.latestError = err;
      return { ok: false, error: err };
    }

    try {
      this.pipelineStep = "GATES_CHECK";
      this.notify();

      // 2. Validate gates
      const gate = this.evaluateGates(signal, trigger, effectiveStake);
      if (!gate.ok) {
        const reason = gate.reason || "Execution gate failure";
        this.recordRejection(signal, trigger, effectiveStake, reason);
        this.latestError = reason;
        this.pipelineStep = "IDLE";
        this.notify();
        return { ok: false, error: reason };
      }

      executionJournal.logEvent({
        type: "RISK_CHECK_PASSED",
        signalId: signal.id,
        message: `All execution gates cleared for ${signal.market} ${signal.contractLabel} ($${effectiveStake.toFixed(2)})`,
        details: { mode, trigger, stake: effectiveStake },
      });

      // 3. Request Live Deriv Proposal
      this.pipelineStep = "PROPOSAL";
      this.notify();

      const proposal = await this.fetchProposal(signal, effectiveStake);
      if (!proposal || !proposal.id) {
        const err = "Failed to obtain valid Deriv price proposal";
        this.latestError = err;
        this.recordRejection(signal, trigger, effectiveStake, err);
        this.pipelineStep = "IDLE";
        this.notify();
        return { ok: false, error: err };
      }

      executionJournal.logEvent({
        type: "PROPOSAL_RECEIVED",
        signalId: signal.id,
        message: `Proposal received: id=${proposal.id} ask=$${proposal.ask_price} payout=$${proposal.payout}`,
        details: proposal,
      });

      // 4. Submit BUY Request
      this.pipelineStep = "BUYING";
      this.notify();

      let contractId: string;
      let buyPrice = proposal.ask_price;
      let payout = proposal.payout;

      if (mode === "LIVE") {
        const buyRes = await this.executeLiveBuy(proposal.id, buyPrice);
        if (!buyRes.ok || !buyRes.contractId) {
          const err = buyRes.error || "Deriv BUY request failed";
          this.latestError = err;
          executionJournal.logEvent({
            type: "BUY_FAILED",
            signalId: signal.id,
            message: `Buy failed: ${err}`,
          });
          this.recordRejection(signal, trigger, effectiveStake, err);
          this.pipelineStep = "IDLE";
          this.notify();
          return { ok: false, error: err };
        }
        contractId = String(buyRes.contractId);
        buyPrice = buyRes.buyPrice || buyPrice;
        payout = buyRes.payout || payout;
      } else {
        // PAPER execution simulation
        contractId = `paper_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      }

      // 5. Create and monitor Open Contract
      const openContract: OpenContract = {
        contractId,
        signalId: signal.id,
        market: signal.market,
        marketName: signal.marketName,
        contractType: signal.contractType,
        contractLabel: signal.contractLabel,
        barrier: signal.barrier,
        durationTicks: signal.duration,
        buyPrice,
        potentialPayout: payout,
        currentProfit: 0,
        status: "open",
        buyTime: Date.now(),
        isSellable: false,
        mode,
        accountLoginid: accountId,
      };

      this.openContracts.set(contractId, openContract);
      this.lastExecutionTime = Date.now();
      this.sessionState.tradesCount++;
      riskManager.markSignalExecuted(signal.id);

      // Record trade in journal
      const auditMode =
        mode === "LIVE"
          ? trigger === "AUTO"
            ? "LIVE_AUTO"
            : "LIVE_MANUAL"
          : trigger === "AUTO"
          ? "PAPER_AUTO"
          : "PAPER_MANUAL";

      executionJournal.recordTrade({
        signalId: signal.id,
        mode: auditMode,
        status: "EXECUTED",
        account: accountId,
        market: signal.market,
        contract: signal.contractLabel,
        barrier: signal.barrier,
        duration: signal.duration,
        stake: buyPrice,
        proposalId: proposal.id,
        contractId,
        buyPrice,
        payout,
        confidence: signal.confidence,
        confluence: signal.confluence,
        psychologySummary: signal.psychology?.summary,
        pressureSummary: signal.pressure?.summary,
        dangerScore: signal.danger?.composite,
        liquidityStatus: signal.liquiditySweep?.status,
      });

      executionJournal.logEvent({
        type: "BUY_CONFIRMED",
        signalId: signal.id,
        message: `Trade confirmed: ${contractId} on ${signal.market} (${mode})`,
        details: { contractId, buyPrice, payout },
      });

      // 6. Begin Monitoring
      this.pipelineStep = "MONITORING";
      this.notify();

      if (mode === "LIVE") {
        this.monitorLiveContract(contractId);
      } else {
        this.monitorPaperContract(contractId, signal);
      }

      return { ok: true, contractId };
    } catch (e: any) {
      const err = e?.message || "Execution exception occurred";
      this.latestError = err;
      executionJournal.logEvent({
        type: "EXECUTION_FAILED",
        signalId: signal.id,
        message: `Execution failed: ${err}`,
      });
      return { ok: false, error: err };
    } finally {
      riskManager.releaseLock(lockKey);
      setTimeout(() => {
        if (this.pipelineStep === "MONITORING" && this.openContracts.size === 0) {
          this.pipelineStep = "IDLE";
          this.notify();
        }
      }, 500);
    }
  }

  // --- Deriv API Interactions ---

  private async fetchProposal(
    signal: ExecutionSignal,
    stake: number
  ): Promise<{
    id: string;
    ask_price: number;
    payout: number;
  } | null> {
    const currency = this.activeAccount?.currency || "USD";

    // In LIVE mode with an active client: request directly through DerivClient WS
    if (this.mode === "LIVE" && this.derivClient) {
      try {
        const res = await this.derivClient.send({
          proposal: 1,
          amount: stake,
          basis: "stake",
          contract_type: signal.contractType,
          currency,
          duration: signal.duration,
          duration_unit: signal.durationUnit,
          symbol: signal.market,
          barrier: String(signal.barrier),
        });

        if (res.error) {
          console.error("Proposal error:", res.error);
          return null;
        }

        const p = res.proposal;
        if (!p?.id) return null;

        return {
          id: p.id,
          ask_price: Number(p.ask_price),
          payout: Number(p.payout),
        };
      } catch (err) {
        console.error("Proposal exception:", err);
        return null;
      }
    }

    // In PAPER mode: Generate a realistic Deriv proposal based on standard digit probabilities
    const winningDigitsCount =
      signal.contractType === "DIGITUNDER" ? signal.barrier : 9 - signal.barrier;
    const prob = winningDigitsCount / 10;
    const fairMultiplier = (1 / Math.max(0.1, prob)) * 0.965;
    const calculatedPayout = Number((stake * fairMultiplier).toFixed(2));

    return {
      id: `prop_paper_${Date.now()}_${signal.market}`,
      ask_price: stake,
      payout: calculatedPayout,
    };
  }

  private async executeLiveBuy(
    proposalId: string,
    price: number
  ): Promise<{ ok: boolean; contractId?: string; buyPrice?: number; payout?: number; error?: string }> {
    if (!this.derivClient) {
      return { ok: false, error: "Deriv client not initialized" };
    }

    try {
      const res = await this.derivClient.send({
        buy: proposalId,
        price,
      });

      if (res.error) {
        return { ok: false, error: res.error.message || "Deriv buy error" };
      }

      const b = res.buy;
      return {
        ok: true,
        contractId: String(b.contract_id),
        buyPrice: Number(b.buy_price),
        payout: Number(b.payout),
      };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Failed to execute buy" };
    }
  }

  private monitorLiveContract(contractId: string) {
    if (!this.derivClient) return;

    this.derivClient
      .subscribe(
        {
          proposal_open_contract: 1,
          contract_id: Number(contractId),
        },
        (msg) => {
          const poc = msg.proposal_open_contract;
          if (!poc) return;

          const contract = this.openContracts.get(contractId);
          if (!contract) return;

          contract.currentSpot = poc.current_spot ? Number(poc.current_spot) : contract.currentSpot;
          contract.entrySpot = poc.entry_spot ? Number(poc.entry_spot) : contract.entrySpot;
          contract.currentProfit = poc.profit !== undefined ? Number(poc.profit) : contract.currentProfit;
          contract.isSellable = Boolean(poc.is_valid_to_sell);
          contract.bidPrice = poc.bid_price ? Number(poc.bid_price) : undefined;

          // Contract-level Take Profit / Stop Loss check
          if (contract.isSellable && contract.status === "open") {
            if (
              this.riskSettings.contractTakeProfit !== null &&
              contract.currentProfit >= this.riskSettings.contractTakeProfit
            ) {
              void this.sellContract(contractId);
              return;
            }
            if (
              this.riskSettings.contractStopLoss !== null &&
              contract.currentProfit <= -this.riskSettings.contractStopLoss
            ) {
              void this.sellContract(contractId);
              return;
            }
          }

          // Check if settled or expired
          if (poc.is_expired || poc.status === "won" || poc.status === "lost") {
            const isWin = poc.status === "won";
            const finalProfit = Number(
              poc.profit ??
                (isWin ? contract.potentialPayout - contract.buyPrice : -contract.buyPrice)
            );
            const settlementSpot = poc.exit_tick ? Number(poc.exit_tick) : contract.currentSpot;

            this.settleContract(contractId, {
              result: isWin ? "WIN" : "LOSS",
              finalProfit,
              settlementSpot,
              durationMs: Date.now() - contract.buyTime,
            });

            // Cleanup subscription
            const subId = this.activeSubIds.get(contractId);
            if (subId && this.derivClient) {
              void this.derivClient.forget(subId);
              this.activeSubIds.delete(contractId);
            }
          } else {
            this.notify();
          }
        }
      )
      .then(({ subId }) => {
        if (subId) this.activeSubIds.set(contractId, subId);
      })
      .catch((err) => {
        console.error("Live contract subscription failed:", err);
      });
  }

  private monitorPaperContract(contractId: string, signal: ExecutionSignal) {
    let tickCount = 0;
    const requiredTicks = Math.max(1, signal.duration);

    // Subscribe to symbol
    const unsubSubscribe = derivBus.subscribe([signal.market]);

    let resolved = false;

    const cleanup = () => {
      resolved = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      unsubTick();
      unsubSubscribe();
    };

    // Fallback timer: guarantees simulated paper contracts resolve reliably within reasonable duration
    const fallbackTimer = setTimeout(() => {
      if (resolved) return;
      const contract = this.openContracts.get(contractId);
      if (!contract || contract.status !== "open") {
        cleanup();
        return;
      }
      cleanup();

      // Use latest available digit for the symbol if present, else derive from current tick or random
      const digits = derivBus.getDigits(signal.market);
      const exitDigit = digits.length > 0 ? digits[digits.length - 1] : Math.floor(Math.random() * 10);
      const simulatedSpot = contract.buyPrice * 1.0003;
      contract.exitSpot = simulatedSpot;
      contract.exitDigit = exitDigit;

      let isWin = false;
      if (signal.contractType === "DIGITUNDER") {
        isWin = exitDigit < signal.barrier;
      } else if (signal.contractType === "DIGITOVER") {
        isWin = exitDigit > signal.barrier;
      } else if (signal.contractType === "DIGITEVEN") {
        isWin = exitDigit % 2 === 0;
      } else if (signal.contractType === "DIGITODD") {
        isWin = exitDigit % 2 !== 0;
      } else {
        isWin = exitDigit < signal.barrier;
      }

      const profit = isWin ? contract.potentialPayout - contract.buyPrice : -contract.buyPrice;

      this.settleContract(contractId, {
        result: isWin ? "WIN" : "LOSS",
        finalProfit: Number(profit.toFixed(2)),
        settlementSpot: simulatedSpot,
        durationMs: Date.now() - contract.buyTime,
      });
    }, Math.max(2200, requiredTicks * 1500));

    const unsubTick = derivBus.onTick((sym, tick) => {
      if (resolved || sym !== signal.market) return;
      tickCount++;

      const contract = this.openContracts.get(contractId);
      if (!contract) {
        cleanup();
        return;
      }

      contract.currentSpot = tick.price;
      if (!contract.entrySpot) {
        contract.entrySpot = tick.price;
      }

      if (tickCount >= requiredTicks) {
        cleanup();
        // Determine win / loss from exit spot digit
        const pip = derivBus.getPipSize(signal.market);
        const factor = Math.pow(10, pip);
        const lastDigit = Math.abs(Math.round(tick.price * factor)) % 10;
        contract.exitSpot = tick.price;
        contract.exitDigit = lastDigit;

        let isWin = false;
        if (signal.contractType === "DIGITUNDER") {
          isWin = lastDigit < signal.barrier;
        } else if (signal.contractType === "DIGITOVER") {
          isWin = lastDigit > signal.barrier;
        } else if (signal.contractType === "DIGITEVEN") {
          isWin = lastDigit % 2 === 0;
        } else if (signal.contractType === "DIGITODD") {
          isWin = lastDigit % 2 !== 0;
        } else {
          isWin = lastDigit < signal.barrier;
        }

        const profit = isWin ? contract.potentialPayout - contract.buyPrice : -contract.buyPrice;

        this.settleContract(contractId, {
          result: isWin ? "WIN" : "LOSS",
          finalProfit: Number(profit.toFixed(2)),
          settlementSpot: tick.price,
          durationMs: Date.now() - contract.buyTime,
        });
      } else {
        this.notify();
      }
    });
  }

  private settleContract(
    contractId: string,
    settlement: {
      result: "WIN" | "LOSS" | "SOLD";
      finalProfit: number;
      settlementSpot?: number;
      durationMs: number;
    }
  ) {
    const contract = this.openContracts.get(contractId);
    if (!contract) return;

    contract.status = settlement.result === "WIN" ? "won" : settlement.result === "LOSS" ? "lost" : "sold";
    contract.currentProfit = settlement.finalProfit;
    contract.settleTime = Date.now();
    contract.exitSpot = settlement.settlementSpot;

    // 1. Update Session State Metrics
    if (settlement.result === "WIN") {
      this.sessionState.wins++;
      this.sessionState.sessionProfit += settlement.finalProfit;
      this.sessionState.consecutiveLosses = 0;

      // Recovery Reset on Win
      if (this.riskSettings.resetAfterWin) {
        this.sessionState.currentRecoveryStep = 0;
        executionJournal.logEvent({
          type: "RECOVERY_RESET",
          signalId: contract.signalId,
          message: "Martingale recovery reset to step 0 after WIN",
        });
      }
    } else if (settlement.result === "LOSS") {
      this.sessionState.losses++;
      this.sessionState.sessionLoss += Math.abs(settlement.finalProfit);
      this.sessionState.consecutiveLosses++;

      // Progressive Martingale Step Advance
      if (this.riskSettings.martingaleEnabled) {
        if (this.sessionState.currentRecoveryStep < this.riskSettings.maxRecoverySteps) {
          this.sessionState.currentRecoveryStep++;
          executionJournal.logEvent({
            type: "RECOVERY_STEP_ADVANCED",
            signalId: contract.signalId,
            message: `Martingale step advanced to ${this.sessionState.currentRecoveryStep} of ${this.riskSettings.maxRecoverySteps}`,
          });
        } else {
          // Max recovery steps exhausted
          this.pauseAuto("MAX RECOVERY STEPS REACHED");
        }
      }
    }

    this.sessionState.netPnl = Number(
      (this.sessionState.sessionProfit - this.sessionState.sessionLoss).toFixed(2)
    );
    const totalFinished = this.sessionState.wins + this.sessionState.losses;
    this.sessionState.winRate = totalFinished > 0 ? Math.round((this.sessionState.wins / totalFinished) * 100) : 0;

    // 2. Cooldown timer
    if (this.riskSettings.cooldownSeconds > 0) {
      this.sessionState.cooldownUntil = Date.now() + this.riskSettings.cooldownSeconds * 1000;
      executionJournal.logEvent({
        type: "COOLDOWN_STARTED",
        signalId: contract.signalId,
        message: `Cooldown active for ${this.riskSettings.cooldownSeconds}s`,
      });
    }

    // 3. Check Target Profit Limit
    if (
      this.riskSettings.targetProfit !== null &&
      this.sessionState.accountPnl >= this.riskSettings.targetProfit
    ) {
      this.sessionState.isTargetProfitReached = true;
      this.pauseAuto("TARGET PROFIT REACHED");
      if (this.riskSettings.resetAfterTargetProfit) {
        this.sessionState.currentRecoveryStep = 0;
      }
      executionJournal.logEvent({
        type: "TARGET_PROFIT_REACHED",
        signalId: contract.signalId,
        message: `TARGET PROFIT REACHED: account P/L +${this.sessionState.accountPnl.toFixed(2)}`,
      });
    }

    // 4. Check Stop Loss Limit
    if (
      this.riskSettings.stopLoss !== null &&
      this.sessionState.accountPnl <= -Math.abs(this.riskSettings.stopLoss)
    ) {
      this.sessionState.isStopLossReached = true;
      this.pauseAuto("STOP LOSS REACHED");
      if (this.riskSettings.resetAfterStopLoss) {
        this.sessionState.currentRecoveryStep = 0;
      }
      executionJournal.logEvent({
        type: "STOP_LOSS_REACHED",
        signalId: contract.signalId,
        message: `STOP LOSS REACHED: account P/L ${this.sessionState.accountPnl.toFixed(2)}`,
      });
    }

    // 5. Check Max Consecutive Losses
    if (
      this.riskSettings.maxConsecutiveLosses !== null &&
      this.sessionState.consecutiveLosses >= this.riskSettings.maxConsecutiveLosses
    ) {
      this.sessionState.isMaxConsecutiveLossesReached = true;
      this.pauseAuto("CONSECUTIVE LOSS LIMIT REACHED");
    }

    // Recalculate next stake
    this.recalculateEffectiveStake();

    // 6. Update Journal
    executionJournal.updateTradeOutcome(contractId, {
      settlementSpot: settlement.settlementSpot,
      result: settlement.result,
      pnl: settlement.finalProfit,
      durationMs: settlement.durationMs,
    });

    executionJournal.logEvent({
      type: "CONTRACT_SETTLED",
      signalId: contract.signalId,
      message: `Contract ${contractId} settled: ${settlement.result} (${settlement.finalProfit >= 0 ? "+" : ""}$${settlement.finalProfit.toFixed(2)})`,
      details: { contractId, ...settlement },
    });

    // Remove from active open contracts after display
    setTimeout(() => {
      this.openContracts.delete(contractId);
      if (this.openContracts.size === 0) {
        this.pipelineStep = "IDLE";
      }
      this.notify();
    }, 2500);

    this.notify();
  }

  async sellContract(contractId: string): Promise<{ ok: boolean; error?: string }> {
    const contract = this.openContracts.get(contractId);
    if (!contract) return { ok: false, error: "Contract not found" };

    if (this.mode === "LIVE" && this.derivClient) {
      try {
        const res = await this.derivClient.send({
          sell: Number(contractId),
          price: 0,
        });

        if (res.error) {
          return { ok: false, error: res.error.message || "Failed to sell contract" };
        }

        const soldPrice = Number(res.sell?.sold_for ?? 0);
        const profit = soldPrice - contract.buyPrice;

        this.settleContract(contractId, {
          result: "SOLD",
          finalProfit: Number(profit.toFixed(2)),
          durationMs: Date.now() - contract.buyTime,
        });

        return { ok: true };
      } catch (err: any) {
        return { ok: false, error: err?.message || "Sell exception" };
      }
    }

    // PAPER Sell
    const profit = contract.currentProfit;
    this.settleContract(contractId, {
      result: "SOLD",
      finalProfit: profit,
      durationMs: Date.now() - contract.buyTime,
    });

    return { ok: true };
  }

  private recordRejection(
    signal: ExecutionSignal,
    trigger: ExecutionTrigger,
    stake: number,
    reason: string
  ) {
    const mode = this.mode;
    const auditMode =
      mode === "LIVE"
        ? trigger === "AUTO"
          ? "LIVE_AUTO"
          : "LIVE_MANUAL"
        : trigger === "AUTO"
        ? "PAPER_AUTO"
        : "PAPER_MANUAL";

    executionJournal.recordRejection({
      signalId: signal.id,
      account: mode === "PAPER" ? "PAPER_VIRTUAL" : this.activeAccount?.loginid || "ANONYMOUS",
      market: signal.market,
      contract: signal.contractLabel,
      barrier: signal.barrier,
      duration: signal.duration,
      stake,
      confidence: signal.confidence,
      confluence: signal.confluence,
      reason,
      mode: auditMode,
    });
  }
}

export const sentinelExecutor = new SentinelExecutionEngine();
