// SENTINEL STANDALONE SIGNAL EXECUTOR PAGE
// Autonomous Execution Machine inside Sentinel with Live Signal Queue, Martingale Recovery,
// and Execution Risk Armor.

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useSentinelExecutor } from "@/hooks/useSentinelExecutor";
import { ExecutorTopStatus } from "@/components/executor/ExecutorTopStatus";
import { ExecutorSessionBar } from "@/components/executor/ExecutorSessionBar";
import { ExecutorRecoveryPanel } from "@/components/executor/ExecutorRecoveryPanel";
import { ExecutionPipelineTracker } from "@/components/executor/ExecutionPipelineTracker";
import { ActiveSignalCard } from "@/components/executor/ActiveSignalCard";
import { OpenContractsPanel } from "@/components/executor/OpenContractsPanel";
import { LiveSignalQueue } from "@/components/executor/LiveSignalQueue";
import { AccountConnectionCard } from "@/components/executor/AccountConnectionCard";
import { ExecutionJournalPanel } from "@/components/executor/ExecutionJournalPanel";
import { ExecutorSettingsDialog } from "@/components/executor/ExecutorSettingsDialog";
import type { ExecutionSignal } from "@/lib/executor/types";
import { Sliders, Shield, Zap, Target, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/executor")({
  component: SentinelExecutorPage,
});

function SentinelExecutorPage() {
  const {
    status,
    mode,
    autoState,
    isAutoArmed,
    pipelineStep,
    latestError,
    effectiveStake,

    signalQueue,
    activeSignal,
    stageSignal,
    clearSignalQueue,

    openContracts,
    account,
    balance,
    currency,
    isVirtual,
    isConnected,

    risk,
    updateRiskSettings,

    session,
    resetSessionMetrics,

    journalRecords,
    auditEvents,
    stats,

    executeManual,
    sellContract,
    setAutoState,
    pauseAuto,
    resumeAuto,
    stopAutoTrading,
    setMode,
    triggerSoundAlertSignal,
  } = useSentinelExecutor();

  const [settingsOpen, setSettingsOpen] = useState(false);

  // Manual execution handler
  const handleManualExecute = async (signal: ExecutionSignal, customStake?: number) => {
    toast.loading("Sending order to execution engine...", { id: "exec-toast" });
    const res = await executeManual(signal, customStake);
    if (res.ok) {
      toast.success(`Trade successfully opened (${res.contractId})`, { id: "exec-toast" });
    } else {
      toast.error(`Execution blocked: ${res.error || "Gate failure"}`, { id: "exec-toast" });
    }
    return res;
  };

  // Early sell contract handler
  const handleSellContract = async (contractId: string) => {
    toast.loading("Submitting sell order to Deriv...", { id: "sell-toast" });
    const res = await sellContract(contractId);
    if (res.ok) {
      toast.success(`Contract ${contractId} closed`, { id: "sell-toast" });
    } else {
      toast.error(`Sell failed: ${res.error}`, { id: "sell-toast" });
    }
    return res;
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 space-y-5">
      {/* 1. Top Status & Mode Bar (Section 30) */}
      <ExecutorTopStatus
        mode={mode}
        onSetMode={(newMode) => {
          setMode(newMode);
          toast.info(
            `Switched to ${newMode === "LIVE" ? "LIVE REAL MONEY" : "PAPER SIMULATION"} mode`,
          );
        }}
        autoState={autoState}
        onSetAutoState={(st) => {
          setAutoState(st);
          if (st === "ON") {
            toast.success("Auto Trader ARMED. Processing incoming signals according to policy.");
          } else {
            toast.info("Auto Trader switched OFF.");
          }
        }}
        onPauseAuto={() => {
          pauseAuto("Manual Pause");
          toast.warning("Auto execution PAUSED.");
        }}
        onResumeAuto={() => {
          resumeAuto();
          toast.success("Auto execution RESUMED.");
        }}
        onEmergencyStop={() => {
          stopAutoTrading();
          toast.error("EMERGENCY STOP: Auto execution stopped immediately.");
        }}
        status={status}
        accountLoginid={account?.loginid}
        isVirtual={isVirtual}
        balance={balance}
        currency={currency}
        isConnected={isConnected}
        onOpenSettings={() => setSettingsOpen(true)}
        onTestAlertSignal={() => {
          const sig = triggerSoundAlertSignal();
          if (sig) {
            toast.success(`Alert chime played! Signal ${sig.marketName} loaded on Executor.`);
          } else {
            toast.info("Alert chime tested. Scanning live markets for signal...");
          }
        }}
      />

      {/* 2. Session Metrics Bar */}
      <ExecutorSessionBar
        session={session}
        risk={risk}
        effectiveStake={effectiveStake}
        currency={currency}
        onResetSession={() => {
          resetSessionMetrics();
          toast.info("Session PnL and trade metrics reset.");
        }}
      />

      {/* 3. Martingale & Progressive Recovery Box */}
      <ExecutorRecoveryPanel
        risk={risk}
        session={session}
        effectiveStake={effectiveStake}
        onUpdateSettings={(up) => {
          updateRiskSettings(up);
          toast.info("Recovery settings updated");
        }}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* 4. Execution Pipeline Tracker */}
      <ExecutionPipelineTracker
        status={status}
        pipelineStep={pipelineStep}
        hasOpenContracts={openContracts.length > 0}
        hasQualifiedSignal={!!activeSignal}
        derivConnected={isConnected}
      />

      {/* 5. Main Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Columns: Staged Execution, Open Contracts, Incoming Queue */}
        <div className="lg:col-span-2 space-y-5">
          {/* Active Staged Signal Execution Station */}
          <ActiveSignalCard
            signal={activeSignal}
            mode={mode}
            risk={risk}
            effectiveStake={effectiveStake}
            accountLoginid={account?.loginid}
            balance={balance}
            currency={currency}
            onExecute={handleManualExecute}
          />

          {/* Live Open Contracts */}
          <OpenContractsPanel contracts={openContracts} onSellContract={handleSellContract} />

          {/* Incoming Signals Queue */}
          <LiveSignalQueue
            queue={signalQueue}
            stagedSignalId={activeSignal?.id}
            onLoadSignal={(sig) => {
              stageSignal(sig);
              toast.info(`Loaded ${sig.marketName} into execution card`);
            }}
            onExecuteSignal={(sig) => {
              void handleManualExecute(sig);
            }}
            onClearQueue={() => {
              clearSignalQueue();
              toast.info("Signal queue cleared");
            }}
            isAutoArmed={isAutoArmed}
            onTestSignal={() => {
              const sig = triggerSoundAlertSignal();
              if (sig) {
                toast.success(`Sound alert played! Loaded ${sig.marketName} on Executor.`);
              }
            }}
          />
        </div>

        {/* Right Column: Deriv Account & Execution Policy Summary */}
        <div className="space-y-5">
          {/* Deriv Account Connector Card */}
          <AccountConnectionCard
            account={account}
            balance={balance}
            currency={currency}
            status={isConnected ? "open" : "disconnected"}
          />

          {/* Execution Policy & Risk Rules Summary Card */}
          <div className="p-4 rounded-xl border border-border/75 bg-card/60 backdrop-blur-md space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <span className="font-bold uppercase text-foreground flex items-center gap-1.5">
                <Shield size={14} className="text-primary" /> Active Execution Policy
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSettingsOpen(true)}
                className="h-6 text-[10px] px-2 text-muted-foreground hover:text-foreground"
              >
                Edit
              </Button>
            </div>

            <div className="space-y-2 text-[11px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Auto Policy:</span>
                <span className="font-bold text-foreground">
                  {risk.autoSignalPolicy.replace("_", " ")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duplicate Protection:</span>
                <span className="text-emerald-400 font-bold">
                  {risk.duplicateProtection ? "ON (1 trade/sig)" : "OFF"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cooldown:</span>
                <span className="text-foreground">{risk.cooldownSeconds}s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max Signal TTL:</span>
                <span className="text-foreground">{risk.maxSignalAgeSeconds}s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max Open Contracts:</span>
                <span className="text-foreground">{risk.maxOpenContracts}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max Daily Loss:</span>
                <span className="text-rose-400 font-bold">${risk.maxDailyLoss ?? 25}</span>
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setSettingsOpen(true)}
              className="w-full text-xs font-mono uppercase mt-1 gap-1.5"
            >
              <Sliders size={13} />
              Open All Settings
            </Button>
          </div>
        </div>
      </div>

      {/* 6. Forensic Execution Journal & Audit Log */}
      <ExecutionJournalPanel
        records={journalRecords}
        events={auditEvents}
        stats={stats}
        onClear={() => {
          toast.info("Execution journal cleared");
        }}
      />

      {/* 7. Comprehensive Settings Dialog */}
      <ExecutorSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={risk}
        onSaveSettings={(update) => {
          updateRiskSettings(update);
          toast.success("Executor settings saved successfully");
        }}
        currency={currency}
      />
    </div>
  );
}
