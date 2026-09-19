// SENTINEL EXECUTOR SESSION METRICS BAR
// Real-time tracking of Session PnL, Target Profit, Stop Loss, Trade Counts, and Cooldown.

import { useEffect, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Target,
  ShieldAlert,
  RotateCcw,
  Clock,
  Zap,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SessionState, RiskSettings } from "@/lib/executor/types";

interface ExecutorSessionBarProps {
  session: SessionState;
  risk: RiskSettings;
  effectiveStake: number;
  currency?: string;
  onResetSession: () => void;
}

export function ExecutorSessionBar({
  session,
  risk,
  effectiveStake,
  currency = "USD",
  onResetSession,
}: ExecutorSessionBarProps) {
  const [cooldownRemainingSec, setCooldownRemainingSec] = useState(0);

  // Live cooldown countdown ticker
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      if (session.cooldownUntil > now) {
        setCooldownRemainingSec(Math.ceil((session.cooldownUntil - now) / 1000));
      } else {
        setCooldownRemainingSec(0);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [session.cooldownUntil]);

  const isProfitable = session.netPnl >= 0;

  return (
    <div className="p-3 rounded-xl border border-border/70 bg-card/60 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
      <div className="flex flex-wrap items-center gap-4">
        {/* Next Stake */}
        <div className="flex flex-col">
          <span className="text-[10px] uppercase text-muted-foreground">Next Stake</span>
          <span className="text-sm font-bold text-foreground">
            ${effectiveStake.toFixed(2)}
          </span>
        </div>

        <div className="h-6 w-px bg-border/60" />

        {/* Session P/L */}
        <div className="flex flex-col">
          <span className="text-[10px] uppercase text-muted-foreground">Session P/L</span>
          <div className="flex items-center gap-1.5">
            {isProfitable ? (
              <TrendingUp size={14} className="text-emerald-400" />
            ) : (
              <TrendingDown size={14} className="text-rose-400" />
            )}
            <span
              className={`text-sm font-bold ${
                isProfitable ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {isProfitable ? "+" : ""}${session.netPnl.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="h-6 w-px bg-border/60" />

        {/* Target Profit */}
        <div className="flex flex-col">
          <span className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
            <Target size={10} className="text-emerald-400" /> Target Profit
          </span>
          <span className="text-xs font-bold text-emerald-400">
            {risk.targetProfit !== null ? `+$${risk.targetProfit.toFixed(2)}` : "OFF"}
          </span>
        </div>

        <div className="h-6 w-px bg-border/60" />

        {/* Stop Loss */}
        <div className="flex flex-col">
          <span className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
            <ShieldAlert size={10} className="text-rose-400" /> Stop Loss
          </span>
          <span className="text-xs font-bold text-rose-400">
            {risk.stopLoss !== null ? `-$${risk.stopLoss.toFixed(2)}` : "OFF"}
          </span>
        </div>

        <div className="h-6 w-px bg-border/60" />

        {/* Trade Counts */}
        <div className="flex flex-col">
          <span className="text-[10px] uppercase text-muted-foreground">Trades (Session)</span>
          <span className="text-xs font-bold text-foreground">
            {session.tradesCount}{" "}
            {risk.maxTradesPerSession ? `/ ${risk.maxTradesPerSession}` : ""}
          </span>
        </div>

        <div className="h-6 w-px bg-border/60" />

        {/* Win / Loss / Rate */}
        <div className="flex flex-col">
          <span className="text-[10px] uppercase text-muted-foreground">Win / Loss</span>
          <div className="flex items-center gap-1.5">
            <span className="text-emerald-400 font-bold">{session.wins}W</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-rose-400 font-bold">{session.losses}L</span>
            <span className="text-muted-foreground">({session.winRate}%)</span>
          </div>
        </div>

        <div className="h-6 w-px bg-border/60" />

        {/* Consecutive Losses */}
        <div className="flex flex-col">
          <span className="text-[10px] uppercase text-muted-foreground">Streak Losses</span>
          <span
            className={`text-xs font-bold ${
              session.consecutiveLosses > 2 ? "text-rose-400" : "text-foreground"
            }`}
          >
            {session.consecutiveLosses}{" "}
            {risk.maxConsecutiveLosses ? `/ ${risk.maxConsecutiveLosses} max` : ""}
          </span>
        </div>

        {/* Active Cooldown Indicator */}
        {cooldownRemainingSec > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/15 border border-amber-500/40 text-amber-300 animate-pulse text-xs font-bold">
            <Clock size={12} />
            <span>COOLDOWN: {cooldownRemainingSec}s</span>
          </div>
        )}
      </div>

      {/* Reset Session Button */}
      <Button
        size="sm"
        variant="ghost"
        onClick={onResetSession}
        className="h-7 text-xs font-mono uppercase text-muted-foreground hover:text-foreground gap-1 px-2"
        title="Reset session PnL and trade counts"
      >
        <RotateCcw size={12} />
        Reset Session
      </Button>
    </div>
  );
}
