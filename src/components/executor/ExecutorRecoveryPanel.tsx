// SENTINEL MARTINGALE & RECOVERY ENGINE PANEL
// Dedicated control and telemetry box displaying progressive recovery states and safety limits.

import { Shield, Lock, Unlock, ArrowRight, AlertTriangle, CheckCircle2, Sliders } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import type { RiskSettings, SessionState } from "@/lib/executor/types";
import { generateRecoveryStepsTable } from "@/lib/executor/stake-calculator";

interface ExecutorRecoveryPanelProps {
  risk: RiskSettings;
  session: SessionState;
  effectiveStake: number;
  onUpdateSettings: (update: Partial<RiskSettings>) => void;
  onOpenSettings: () => void;
}

export function ExecutorRecoveryPanel({
  risk,
  session,
  effectiveStake,
  onUpdateSettings,
  onOpenSettings,
}: ExecutorRecoveryPanelProps) {
  const isEnabled = risk.martingaleEnabled;
  const isCapped = effectiveStake >= risk.maxRecoveryStake;

  const stepsPreview = generateRecoveryStepsTable(
    risk.baseStake || risk.stake,
    risk.martingaleMultiplier,
    risk.maxRecoverySteps,
    risk.maxRecoveryStake
  );

  return (
    <div className="p-3.5 rounded-xl border border-border/75 bg-card/60 backdrop-blur-md space-y-3 font-mono text-xs">
      <div className="flex items-center justify-between pb-2 border-b border-border/60">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-primary/10 text-primary">
            <Shield size={14} />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-foreground">
            Martingale & Recovery Engine
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground uppercase font-semibold">
              {isEnabled ? "ENABLED" : "DISABLED"}
            </span>
            <Switch
              checked={isEnabled}
              onCheckedChange={(checked) => onUpdateSettings({ martingaleEnabled: checked })}
            />
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onOpenSettings}
            className="h-6 text-[10px] px-2 text-muted-foreground hover:text-foreground"
          >
            Configure
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {/* Base Stake */}
        <div className="p-2 rounded-lg bg-background/50 border border-border/60 flex flex-col">
          <span className="text-[10px] text-muted-foreground uppercase">Base Stake</span>
          <span className="text-xs font-bold text-foreground">
            ${(risk.baseStake || risk.stake).toFixed(2)}
          </span>
        </div>

        {/* Multiplier */}
        <div className="p-2 rounded-lg bg-background/50 border border-border/60 flex flex-col">
          <span className="text-[10px] text-muted-foreground uppercase">Multiplier</span>
          <span className="text-xs font-bold text-cyan-400">
            {risk.martingaleMultiplier.toFixed(2)}x
          </span>
        </div>

        {/* Current Recovery Step */}
        <div className="p-2 rounded-lg bg-background/50 border border-border/60 flex flex-col">
          <span className="text-[10px] text-muted-foreground uppercase">Current Step</span>
          <span className="text-xs font-bold text-foreground">
            Step {session.currentRecoveryStep} / {risk.maxRecoverySteps}
          </span>
        </div>

        {/* Recovery Max Stake Cap */}
        <div className="p-2 rounded-lg bg-background/50 border border-border/60 flex flex-col">
          <span className="text-[10px] text-muted-foreground uppercase">Max Recovery Cap</span>
          <span className="text-xs font-bold text-amber-400">
            ${risk.maxRecoveryStake.toFixed(2)}
          </span>
        </div>

        {/* Calculated Next Trade Stake */}
        <div className="p-2 rounded-lg bg-primary/10 border border-primary/30 flex flex-col col-span-2 sm:col-span-1">
          <span className="text-[10px] text-primary uppercase font-bold">Next Trade Stake</span>
          <span className="text-sm font-black text-primary">
            ${effectiveStake.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Safety & Reset Status */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-muted-foreground border-t border-border/40">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            Reset on Win:{" "}
            <span className={risk.resetAfterWin ? "text-emerald-400 font-bold" : "text-muted-foreground"}>
              {risk.resetAfterWin ? "ON" : "OFF"}
            </span>
          </span>
          <span>·</span>
          <span className="flex items-center gap-1">
            Reset on Target:{" "}
            <span className={risk.resetAfterTargetProfit ? "text-emerald-400 font-bold" : "text-muted-foreground"}>
              {risk.resetAfterTargetProfit ? "ON" : "OFF"}
            </span>
          </span>
          <span>·</span>
          <span className="flex items-center gap-1">
            Reset on Stop:{" "}
            <span className={risk.resetAfterStopLoss ? "text-emerald-400 font-bold" : "text-muted-foreground"}>
              {risk.resetAfterStopLoss ? "ON" : "OFF"}
            </span>
          </span>
        </div>

        <div>
          {isCapped ? (
            <span className="text-rose-400 font-bold flex items-center gap-1">
              <AlertTriangle size={12} /> RECOVERY CAP REACHED
            </span>
          ) : isEnabled ? (
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle2 size={12} /> Recovery Safe (Within Caps)
            </span>
          ) : (
            <span className="text-muted-foreground">Martingale Off — Fixed Stake</span>
          )}
        </div>
      </div>
    </div>
  );
}
