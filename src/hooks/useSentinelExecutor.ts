// SENTINEL EXECUTOR REACT HOOK
// Connects the Sentinel Intelligence stream, Deriv Account, Risk Gates, and the Standalone Execution Engine.

import { useEffect, useState, useCallback, useRef } from "react";
import { useApexSentinel } from "./useApexSentinel";
import { useDerivAccount } from "@/lib/deriv/account-context";
import { playAlertSound } from "@/hooks/useAlertSound";
import { sentinelExecutor } from "@/lib/executor/engine";
import { executionJournal } from "@/lib/executor/execution-journal";
import { buildExecutionSignal } from "@/lib/executor/signal-adapter";
import type {
  ExecutionSignal,
  ExecutionMode,
  ExecutorStatus,
  RiskSettings,
  OpenContract,
  ExecutionAuditRecord,
  AuditEvent,
  SignalQueueItem,
  AutoExecutionState,
  SessionState,
} from "@/lib/executor/types";

export function useSentinelExecutor() {
  const apex = useApexSentinel();
  const deriv = useDerivAccount();

  const [, setTick] = useState(0);
  const rerender = useCallback(() => setTick((t) => t + 1), []);

  // Subscribe to engine and journal updates
  useEffect(() => {
    const unsubExec = sentinelExecutor.subscribe(rerender);
    const unsubJour = executionJournal.subscribe(rerender);
    return () => {
      unsubExec();
      unsubJour();
    };
  }, [rerender]);

  // Keep Deriv account context synced with the executor engine
  useEffect(() => {
    if (deriv.account && deriv.client) {
      sentinelExecutor.setAccount(
        {
          loginid: deriv.account.loginid,
          token: deriv.account.token,
          currency: deriv.currency || deriv.account.currency || "USD",
          balance: deriv.balance ?? deriv.account.balance ?? 0,
          isVirtual: deriv.account.is_virtual,
          connected: deriv.status === "open",
        },
        deriv.client
      );
    } else {
      sentinelExecutor.setAccount(null, null);
    }
  }, [deriv.account, deriv.client, deriv.currency, deriv.balance, deriv.status]);

  // Feed Sentinel signals that come with a sound alert directly into the standalone Executor
  // In Sentinel, the audible alert is triggered when a new surfaced signal is found (apex.surfacedSignalId).
  // Only signals with a sound alert are loaded, preventing unvetted candidates from spamming the queue.
  const lastProcessedSignalIdRef = useRef<string | null>(null);

  useEffect(() => {
    const sigId = apex.surfacedSignalId;
    const opp = apex.surfacedOpportunity;

    if (!opp || !opp.symbol || !opp.contract) {
      return;
    }

    // When a sound alert event fires with a new signalId, load it into the Executor
    if (sigId && sigId !== lastProcessedSignalIdRef.current) {
      lastProcessedSignalIdRef.current = sigId;
      const sig = buildExecutionSignal(opp);
      sig.id = `SIG-${opp.symbol}-${opp.contract.id}-${sigId}`;
      sig.createdAt = Date.now();
      const settings = sentinelExecutor.getRiskSettings();
      sig.metadata = {
        ...sig.metadata,
        baseSignalId: sig.id,
        runIndex: 1,
        runsTotal: settings.runsPerSignal,
        recoveryDigit: settings.recoveryDigit,
      };

      sentinelExecutor.receiveSignal(sig);
      sentinelExecutor.stageSignal(sig);
    }
  }, [apex.surfacedSignalId, apex.surfacedOpportunity]);

  // Initial populate: if no signal is staged and a vetted opportunity is available, stage it for manual review
  useEffect(() => {
    if (!sentinelExecutor.getStagedSignal() && apex.surfacedOpportunity) {
      const opp = apex.surfacedOpportunity;
      if (opp && opp.symbol && opp.contract) {
        const sig = buildExecutionSignal(opp);
        const settings = sentinelExecutor.getRiskSettings();
        sig.metadata = {
          ...sig.metadata,
          baseSignalId: sig.id,
          runIndex: 1,
          runsTotal: settings.runsPerSignal,
          recoveryDigit: settings.recoveryDigit,
        };
        sentinelExecutor.receiveSignal(sig);
        sentinelExecutor.stageSignal(sig);
      }
    }
  }, [apex.surfacedOpportunity]);

  const risk = sentinelExecutor.getRiskSettings();
  const activeSignal = sentinelExecutor.getStagedSignal();
  const signalQueue: SignalQueueItem[] = sentinelExecutor.getSignalQueue();
  const openContracts = sentinelExecutor.getOpenContracts();
  const session: SessionState = sentinelExecutor.getSessionState();
  const status: ExecutorStatus = sentinelExecutor.getStatus();
  const mode: ExecutionMode = sentinelExecutor.getMode();
  const autoState: AutoExecutionState = sentinelExecutor.getAutoState();
  const isAutoArmed = sentinelExecutor.isAutoArmed();
  const pipelineStep = sentinelExecutor.getPipelineStep();
  const latestError = sentinelExecutor.getLatestError();
  const effectiveStake = sentinelExecutor.getEffectiveNextStake();

  const journalRecords = executionJournal.getRecords();
  const auditEvents = executionJournal.getEvents();
  const stats = executionJournal.getStats();

  // Manual execution callback
  const executeManual = useCallback(
    async (signal: ExecutionSignal, customStake?: number) => {
      return sentinelExecutor.executeSignal(signal, "MANUAL", customStake);
    },
    []
  );

  const stageSignal = useCallback((signal: ExecutionSignal | null) => {
    sentinelExecutor.stageSignal(signal);
  }, []);

  const sellContract = useCallback(async (contractId: string) => {
    return sentinelExecutor.sellContract(contractId);
  }, []);

  const setAutoState = useCallback((state: AutoExecutionState, reason?: string) => {
    sentinelExecutor.setAutoState(state, reason);
  }, []);

  const pauseAuto = useCallback((reason?: string) => {
    sentinelExecutor.pauseAuto(reason);
  }, []);

  const resumeAuto = useCallback(() => {
    sentinelExecutor.resumeAuto();
  }, []);

  const stopAutoTrading = useCallback(() => {
    sentinelExecutor.stopAutoTrading();
  }, []);

  const setMode = useCallback((newMode: ExecutionMode) => {
    sentinelExecutor.setMode(newMode);
  }, []);

  const updateRiskSettings = useCallback((update: Partial<RiskSettings>) => {
    sentinelExecutor.updateRiskSettings(update);
  }, []);

  const resetSessionMetrics = useCallback(() => {
    sentinelExecutor.resetSessionMetrics();
  }, []);

  const clearSignalQueue = useCallback(() => {
    sentinelExecutor.clearSignalQueue();
  }, []);

  const triggerSoundAlertSignal = useCallback(() => {
    playAlertSound();
    const opp = apex.surfacedOpportunity || (apex.ranked && apex.ranked[0]);
    if (opp && opp.symbol && opp.contract) {
      const sig = buildExecutionSignal(opp);
      const testId = `SIG-${opp.symbol}-${opp.contract.id}-${Date.now()}`;
      sig.id = testId;
      sig.createdAt = Date.now();
      const settings = sentinelExecutor.getRiskSettings();
      sig.metadata = {
        ...sig.metadata,
        baseSignalId: sig.id,
        runIndex: 1,
        runsTotal: settings.runsPerSignal,
        recoveryDigit: settings.recoveryDigit,
      };
      sentinelExecutor.receiveSignal(sig);
      sentinelExecutor.stageSignal(sig);
      return sig;
    }
    return null;
  }, [apex.surfacedOpportunity, apex.ranked]);

  return {
    // Current State
    status,
    mode,
    autoState,
    isAutoArmed,
    pipelineStep,
    latestError,
    effectiveStake,

    // Signal Queue & Staged Signal
    signalQueue,
    activeSignal,
    stageSignal,
    clearSignalQueue,

    // Open Positions & Account
    openContracts,
    account: deriv.account,
    balance: deriv.balance ?? deriv.account?.balance ?? null,
    currency: deriv.currency || deriv.account?.currency || "USD",
    isVirtual: deriv.account?.is_virtual ?? false,
    isConnected: deriv.status === "open",

    // Configuration & Risk
    risk,
    updateRiskSettings,

    // Session Metrics & Recovery State
    session,
    resetSessionMetrics,

    // Journal & Audits
    journalRecords,
    auditEvents,
    stats,

    // Actions
    executeManual,
    sellContract,
    setAutoState,
    pauseAuto,
    resumeAuto,
    stopAutoTrading,
    setMode,
    triggerSoundAlertSignal,
  };
}
