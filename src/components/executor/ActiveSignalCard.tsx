// SENTINEL STAGED SIGNAL EXECUTION CARD
// Allows manual inspection, parameter tweaking, and execution of the staged signal.

import { useState, useEffect } from "react";
import {
  Zap,
  Clock,
  Shield,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Activity,
  Play,
  Sliders,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ExecutionSignal, ExecutionMode, RiskSettings } from "@/lib/executor/types";

interface ActiveSignalCardProps {
  signal: ExecutionSignal | null;
  mode: ExecutionMode;
  risk: RiskSettings;
  effectiveStake: number;
  accountLoginid?: string;
  balance?: number | null;
  currency?: string | null;
  onExecute: (signal: ExecutionSignal, customStake?: number) => Promise<{ ok: boolean; error?: string }>;
}

export function ActiveSignalCard({
  signal,
  mode,
  risk,
  effectiveStake,
  accountLoginid,
  balance,
  currency = "USD",
  onExecute,
}: ActiveSignalCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [signalAgeSec, setSignalAgeSec] = useState("0.0");
  const [customStake, setCustomStake] = useState<string>(effectiveStake.toFixed(2));
  const [customDuration, setCustomDuration] = useState<number>(1);

  // Sync custom stake whenever effectiveStake changes
  useEffect(() => {
    setCustomStake(effectiveStake.toFixed(2));
  }, [effectiveStake]);

  // Live signal age ticker
  useEffect(() => {
    if (!signal) return;
    const interval = setInterval(() => {
      const ageMs = Date.now() - signal.createdAt;
      setSignalAgeSec((ageMs / 1000).toFixed(1));
    }, 100);
    return () => clearInterval(interval);
  }, [signal]);

  if (!signal) {
    return (
      <div className="p-6 rounded-xl border border-dashed border-border/80 bg-card/30 flex flex-col items-center justify-center text-center min-h-[300px]">
        <Activity className="w-8 h-8 text-muted-foreground/60 mb-3 animate-pulse" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground font-mono">
          No Signal Staged in Executor
        </h3>
        <p className="text-xs text-muted-foreground max-w-md mt-1 font-sans">
          Select any incoming signal from the Live Signal Queue below using <span className="font-mono font-bold text-foreground">[LOAD]</span> to stage it here for manual parameter review and execution.
        </p>
      </div>
    );
  }

  const parsedStake = parseFloat(customStake) || effectiveStake;
  const isStale = parseFloat(signalAgeSec) > risk.maxSignalAgeSeconds;

  // Theoretical payout estimation
  const winningDigits =
    signal.contractType === "DIGITUNDER" ? signal.barrier : 9 - signal.barrier;
  const prob = winningDigits / 10;
  const payoutMultiplier = (1 / Math.max(0.1, prob)) * 0.965;
  const estimatedPayout = (parsedStake * payoutMultiplier).toFixed(2);
  const estimatedProfit = (parsedStake * payoutMultiplier - parsedStake).toFixed(2);

  const handleConfirmExecute = async () => {
    setExecuting(true);
    try {
      await onExecute(
        {
          ...signal,
          duration: customDuration,
        },
        parsedStake
      );
      setConfirmOpen(false);
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="p-4 rounded-xl border border-border/80 bg-card/75 backdrop-blur-md shadow-md flex flex-col justify-between gap-4 font-mono">
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-border/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-foreground font-display">
                {signal.marketName}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase bg-primary/10 text-primary border border-primary/30">
                {signal.market}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
                {signal.sentinelStatus}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span>Direction:</span>
              <span className="text-cyan-400 font-bold uppercase">{signal.direction}</span>
              <span>·</span>
              <span>Barrier:</span>
              <span className="text-foreground font-bold">{signal.barrier}</span>
              <span>·</span>
              <span>Duration:</span>
              <span className="text-foreground font-bold">{customDuration} Tick</span>
            </div>
          </div>

          {/* Age Ticker */}
          <div
            className={`px-2.5 py-1 rounded-md text-xs font-mono font-bold flex items-center gap-1.5 ${
              isStale
                ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                : "bg-background/80 text-muted-foreground border border-border/60"
            }`}
          >
            <Clock size={12} />
            <span>{signalAgeSec}s</span>
            {isStale && <span className="text-[10px] font-sans uppercase">Stale</span>}
          </div>
        </div>

        {/* Trade Parameters & Telemetry */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-3">
          {/* Stake Input */}
          <div className="space-y-1">
            <Label className="text-[10px] uppercase text-muted-foreground">Stake ({currency})</Label>
            <Input
              type="number"
              step="0.05"
              min="0.35"
              value={customStake}
              onChange={(e) => setCustomStake(e.target.value)}
              className="h-8 font-mono text-xs font-bold"
            />
          </div>

          {/* Duration Input */}
          <div className="space-y-1">
            <Label className="text-[10px] uppercase text-muted-foreground">Duration (Ticks)</Label>
            <Input
              type="number"
              min="1"
              max="10"
              value={customDuration}
              onChange={(e) => setCustomDuration(parseInt(e.target.value, 10) || 1)}
              className="h-8 font-mono text-xs font-bold"
            />
          </div>

          {/* Estimated Payout */}
          <div className="p-2 rounded-lg bg-background/50 border border-border/60 flex flex-col justify-center">
            <span className="text-[10px] uppercase text-muted-foreground">Est. Payout</span>
            <span className="text-xs font-bold text-foreground">
              ${estimatedPayout}
            </span>
          </div>

          {/* Est Profit */}
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex flex-col justify-center">
            <span className="text-[10px] uppercase text-emerald-400 font-bold">Est. Net Profit</span>
            <span className="text-xs font-black text-emerald-400">
              +${estimatedProfit}
            </span>
          </div>
        </div>

        {/* Informational Sentinel Telemetry */}
        <div className="p-2.5 rounded-lg bg-background/40 border border-border/50 text-[11px] text-muted-foreground space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>Sentinel Intelligence Score: <strong className="text-foreground">{signal.score}</strong></span>
            <span>Confidence: <strong className="text-foreground">{signal.confidence}%</strong></span>
            <span>Danger: <strong className="text-foreground">{signal.danger?.composite ?? 0}</strong></span>
            {signal.entryDigit !== undefined && (
              <span>Entry Digit: <strong className="text-emerald-400">{signal.entryDigit}</strong></span>
            )}
          </div>
          {signal.psychology?.summary && (
            <div className="text-[10px] text-muted-foreground/80 font-sans truncate">
              Psychology: {signal.psychology.summary}
            </div>
          )}
        </div>
      </div>

      {/* Execution Action Footer */}
      <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-border/50">
        <div className="text-[11px] text-muted-foreground">
          Mode: <strong className={mode === "LIVE" ? "text-rose-400" : "text-emerald-400"}>{mode}</strong> ·
          Target Wallet: <strong className="text-foreground">{accountLoginid || "PAPER_SIMULATOR"}</strong>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setConfirmOpen(true)}
            disabled={executing || parsedStake < 0.35}
            className="h-8 px-4 text-xs font-bold font-mono uppercase bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 shadow-md"
          >
            <Play size={12} fill="currentColor" />
            {executing ? "EXECUTING..." : "EXECUTE TRADE NOW"}
          </Button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-[420px] font-mono">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <Zap size={16} className="text-primary" />
              Confirm Manual Execution
            </DialogTitle>
            <DialogDescription className="text-xs">
              Confirm contract submission to {mode === "LIVE" ? "Live Deriv Server" : "Paper Simulator"}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2 text-xs border-y border-border/60">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Market:</span>
              <span className="font-bold text-foreground">{signal.marketName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Contract:</span>
              <span className="font-bold text-cyan-400">{signal.contractLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Duration:</span>
              <span className="font-bold text-foreground">{customDuration} Tick</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Stake:</span>
              <span className="font-bold text-foreground">${parsedStake.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Potential Profit:</span>
              <span className="font-bold text-emerald-400">+${estimatedProfit}</span>
            </div>
          </div>

          {mode === "LIVE" && (
            <div className="p-2 rounded bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-300 flex items-center gap-1.5">
              <AlertTriangle size={13} className="text-rose-400 shrink-0" />
              <span>Real capital will be deducted from your account.</span>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={executing}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmExecute}
              disabled={executing}
              className="text-xs font-bold bg-primary text-primary-foreground gap-1.5"
            >
              <Play size={12} fill="currentColor" />
              {executing ? "Sending..." : "Confirm & Execute"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
