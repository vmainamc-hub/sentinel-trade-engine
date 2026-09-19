// SENTINEL EXECUTOR TOP STATUS BAR
// Authoritative top bar matching Section 30 specifications.
// Displays connection, mode, auto state, account details, balance, and emergency stop.

import { useState } from "react";
import {
  Shield,
  Zap,
  Power,
  Radio,
  Pause,
  Play,
  Octagon,
  Sliders,
  Wallet,
  AlertTriangle,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ExecutionMode, AutoExecutionState, ExecutorStatus } from "@/lib/executor/types";
import { Bell } from "lucide-react";

interface ExecutorTopStatusProps {
  mode: ExecutionMode;
  onSetMode: (mode: ExecutionMode) => void;
  autoState: AutoExecutionState;
  onSetAutoState: (state: AutoExecutionState) => void;
  onPauseAuto: () => void;
  onResumeAuto: () => void;
  onEmergencyStop: () => void;
  status: ExecutorStatus;
  accountLoginid?: string;
  isVirtual?: boolean;
  balance?: number | null;
  currency?: string;
  isConnected: boolean;
  onOpenSettings: () => void;
  onTestAlertSignal?: () => void;
}

export function ExecutorTopStatus({
  mode,
  onSetMode,
  autoState,
  onSetAutoState,
  onPauseAuto,
  onResumeAuto,
  onEmergencyStop,
  status,
  accountLoginid,
  isVirtual,
  balance,
  currency = "USD",
  isConnected,
  onOpenSettings,
  onTestAlertSignal,
}: ExecutorTopStatusProps) {
  const [confirmEmergencyStop, setConfirmEmergencyStop] = useState(false);

  return (
    <div className="p-3.5 rounded-xl border border-border/80 bg-card/85 backdrop-blur-md shadow-sm space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Module Identity & Deriv Connection */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/25 text-primary">
            <Zap size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black tracking-wider uppercase font-display text-foreground">
                SENTINEL EXECUTOR
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border/50">
                v3.2 BOT
              </span>
              {isConnected ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  CONNECTED
                </span>
              ) : (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center gap-1 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                  DISCONNECTED
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <span>Account:</span>
              <span className="font-mono font-bold text-foreground">
                {accountLoginid || (mode === "PAPER" ? "PAPER_VIRTUAL" : "NOT AUTHORIZED")}
              </span>
              <span>·</span>
              <span>Balance:</span>
              <span className="font-mono font-bold text-emerald-400">
                {balance !== null && balance !== undefined
                  ? `${currency} ${balance.toFixed(2)}`
                  : mode === "PAPER"
                  ? `${currency} 10,000.00 (SIM)`
                  : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Mode Switch, Auto Controls & Emergency Stop */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Paper vs Live Mode Switch */}
          <div className="flex items-center rounded-lg border border-border/80 bg-background/90 p-0.5 text-xs font-mono">
            <button
              type="button"
              onClick={() => onSetMode("PAPER")}
              className={`px-3 py-1 rounded-md font-bold uppercase transition-all flex items-center gap-1.5 ${
                mode === "PAPER"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              PAPER TRADING
            </button>
            <button
              type="button"
              onClick={() => onSetMode("LIVE")}
              className={`px-3 py-1 rounded-md font-bold uppercase transition-all flex items-center gap-1.5 ${
                mode === "LIVE"
                  ? "bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-xs animate-pulse"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              LIVE REAL MONEY
            </button>
          </div>

          {/* Execution Strategy: Manual vs Auto Bot */}
          <div className="flex items-center rounded-lg border border-border/80 bg-background/90 p-0.5 text-xs font-mono">
            <button
              type="button"
              onClick={() => {
                if (autoState !== "OFF") onSetAutoState("OFF");
              }}
              className={`px-3 py-1 rounded-md font-bold uppercase transition-all flex items-center gap-1.5 ${
                autoState === "OFF"
                  ? "bg-primary/20 text-primary border border-primary/40 shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              MANUAL
            </button>
            <button
              type="button"
              onClick={() => {
                if (autoState === "OFF") onSetAutoState("ON");
                else if (autoState === "PAUSED") onResumeAuto();
              }}
              className={`px-3 py-1 rounded-md font-bold uppercase transition-all flex items-center gap-1.5 ${
                autoState === "ON"
                  ? "bg-amber-500/25 text-amber-300 border border-amber-500/50 shadow-xs animate-pulse"
                  : autoState === "PAUSED"
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Zap size={12} fill="currentColor" />
              AUTO BOT
            </button>
          </div>

          {/* Pause / Emergency Stop controls when Auto is active */}
          {autoState !== "OFF" && (
            <div className="flex items-center gap-1.5">
              {autoState === "PAUSED" ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onResumeAuto}
                  className="h-8 text-xs font-bold font-mono uppercase border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 gap-1.5"
                >
                  <Play size={13} fill="currentColor" />
                  RESUME
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onPauseAuto()}
                  className="h-8 text-xs font-bold font-mono uppercase border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 gap-1.5"
                >
                  <Pause size={13} />
                  PAUSE
                </Button>
              )}

              <Button
                size="sm"
                variant="destructive"
                onClick={onEmergencyStop}
                className="h-8 text-xs font-bold font-mono uppercase bg-rose-600 hover:bg-rose-700 text-white gap-1.5 shadow-md shadow-rose-900/30"
              >
                <Octagon size={13} />
                STOP
              </Button>
            </div>
          )}

          {/* Test Signal Trigger Button */}
          {onTestAlertSignal && (
            <Button
              size="sm"
              variant="outline"
              onClick={onTestAlertSignal}
              className="h-8 text-xs font-semibold gap-1.5 font-mono uppercase border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
              title="Test sound alert chime and load signal into executor"
            >
              <Bell size={12} />
              TEST ALERT
            </Button>
          )}

          {/* Settings Modal Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={onOpenSettings}
            className="h-8 text-xs font-semibold gap-1.5 font-mono uppercase border-border/80"
          >
            <Sliders size={13} />
            SETTINGS
          </Button>
        </div>
      </div>

      {/* Prominent Active Mode Warning Banner */}
      <div className="flex flex-col sm:flex-row gap-2">
        {mode === "LIVE" ? (
          <div className="flex-1 px-3 py-1.5 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-mono flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold uppercase">
              <AlertTriangle size={14} className="text-rose-400 shrink-0" />
              <span>🔴 LIVE TRADING ACTIVE — REAL CAPITAL AT RISK</span>
            </div>
            <span className="text-[11px] text-rose-300/80 hidden sm:inline">
              Trades execute directly against your real Deriv wallet.
            </span>
          </div>
        ) : (
          <div className="flex-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
              <span>🟢 PAPER TRADING — NO REAL MONEY (RISK-FREE SIMULATION)</span>
            </div>
            <span className="text-[11px] text-emerald-300/80 hidden sm:inline">
              Simulated against real live ticks using Deriv digit formulas.
            </span>
          </div>
        )}

        {/* Status of Execution Option */}
        {autoState === "ON" ? (
          <div className="px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-mono flex items-center gap-2 font-bold uppercase">
            <Zap size={14} className="text-amber-400 shrink-0 animate-bounce" />
            <span>AUTO BOT ACTIVE: Every signal is executed automatically</span>
          </div>
        ) : autoState === "PAUSED" ? (
          <div className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono flex items-center gap-2 font-semibold uppercase">
            <Pause size={14} className="text-amber-400 shrink-0" />
            <span>AUTO BOT PAUSED</span>
          </div>
        ) : (
          <div className="px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs font-mono flex items-center gap-2 font-semibold uppercase">
            <span>🎯 MANUAL MODE: Click [Execute] on any loaded signal</span>
          </div>
        )}
      </div>
    </div>
  );
}
