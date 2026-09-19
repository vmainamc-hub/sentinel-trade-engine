import { AlertTriangle, Shield, Zap, Power, Radio, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { ExecutionMode, ExecutorStatus } from "@/lib/executor/types";

interface AutoExecutionMasterSwitchProps {
  isArmed: boolean;
  onToggleArmed: (armed: boolean) => void;
  mode: ExecutionMode;
  onToggleMode: (mode: ExecutionMode) => void;
  status: ExecutorStatus;
  consecutiveLosses: number;
  dailyLoss: number;
}

export function AutoExecutionMasterSwitch({
  isArmed,
  onToggleArmed,
  mode,
  onToggleMode,
  status,
  consecutiveLosses,
  dailyLoss,
}: AutoExecutionMasterSwitchProps) {
  const getStatusBadge = () => {
    switch (status) {
      case "ARMED":
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 font-mono text-xs font-bold uppercase tracking-wider animate-pulse">
            <Radio size={13} className="text-emerald-400" />
            AUTO ARMED
          </div>
        );
      case "EXECUTING":
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-500/20 border border-amber-500/50 text-amber-300 font-mono text-xs font-bold uppercase tracking-wider animate-bounce">
            <Zap size={13} className="text-amber-400" />
            EXECUTING TRADE
          </div>
        );
      case "FEED_STALE":
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-rose-500/15 border border-rose-500/40 text-rose-400 font-mono text-xs font-bold uppercase tracking-wider">
            <AlertTriangle size={13} className="text-rose-400" />
            FEED STALE — PAUSED
          </div>
        );
      case "ACCOUNT_DISCONNECTED":
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-400 font-mono text-xs font-bold uppercase tracking-wider">
            <Shield size={13} className="text-amber-400" />
            ACCOUNT DISCONNECTED
          </div>
        );
      case "PAUSED":
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-rose-500/15 border border-rose-500/40 text-rose-400 font-mono text-xs font-bold uppercase tracking-wider">
            <AlertTriangle size={13} className="text-rose-400" />
            SAFETY PAUSE (LOSS LIMIT)
          </div>
        );
      case "AUTO_OFF":
      default:
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/40 border border-border/60 text-muted-foreground font-mono text-xs font-bold uppercase tracking-wider">
            <Power size={13} />
            AUTO OFF
          </div>
        );
    }
  };

  return (
    <div className="p-4 rounded-xl border border-border/70 bg-card/60 backdrop-blur-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/25">
          <Zap className="w-5 h-5 text-primary" />
        </div>
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-sm font-bold uppercase tracking-widest text-foreground font-display">
              Executor Control Room
            </h2>
            {getStatusBadge()}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time execution pipeline powered by authoritative Sentinel intelligence
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
        {/* Paper vs Live Toggle */}
        <div className="flex items-center rounded-lg border border-border/70 bg-background/80 p-1 text-xs">
          <button
            type="button"
            onClick={() => onToggleMode("PAPER")}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
              mode === "PAPER"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            PAPER SIMULATOR
          </button>
          <button
            type="button"
            onClick={() => onToggleMode("LIVE")}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
              mode === "LIVE"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            LIVE DERIV
          </button>
        </div>

        {/* Master Auto Switch */}
        <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg border border-border/70 bg-background/80">
          <div className="flex flex-col text-right">
            <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">
              Auto Execution
            </span>
            <span className="text-[9px] font-mono text-muted-foreground">
              {isArmed ? "Armed & Listening" : "Deliberately Disabled"}
            </span>
          </div>
          <Switch
            checked={isArmed}
            onCheckedChange={onToggleArmed}
            aria-label="Toggle Auto Execution"
          />
        </div>
      </div>
    </div>
  );
}
