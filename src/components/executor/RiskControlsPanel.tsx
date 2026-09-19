import { useState } from "react";
import { Shield, AlertTriangle, Sliders, CheckCircle2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RiskSettings } from "@/lib/executor/types";

interface RiskControlsPanelProps {
  settings: RiskSettings;
  onUpdateSettings: (update: Partial<RiskSettings>) => void;
  currency?: string | null;
}

export function RiskControlsPanel({ settings, onUpdateSettings, currency }: RiskControlsPanelProps) {
  const [stakeInput, setStakeInput] = useState(String(settings.stake));
  const [maxStakeInput, setMaxStakeInput] = useState(String(settings.maxStake));
  const [dailyLossInput, setDailyLossInput] = useState(String(settings.maxDailyLoss));
  const [consecLossInput, setConsecLossInput] = useState(String(settings.maxConsecutiveLosses));
  const [cooldownInput, setCooldownInput] = useState(String(settings.cooldownSeconds));
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    const stake = parseFloat(stakeInput);
    const maxStake = parseFloat(maxStakeInput);
    const maxDailyLoss = parseFloat(dailyLossInput);
    const maxConsecutiveLosses = parseInt(consecLossInput, 10);
    const cooldownSeconds = parseInt(cooldownInput, 10);

    onUpdateSettings({
      stake: !isNaN(stake) && stake >= 0.35 ? stake : settings.stake,
      maxStake: !isNaN(maxStake) && maxStake >= 0.35 ? maxStake : settings.maxStake,
      maxDailyLoss: !isNaN(maxDailyLoss) ? maxDailyLoss : settings.maxDailyLoss,
      maxConsecutiveLosses: !isNaN(maxConsecutiveLosses) ? maxConsecutiveLosses : settings.maxConsecutiveLosses,
      cooldownSeconds: !isNaN(cooldownSeconds) ? cooldownSeconds : settings.cooldownSeconds,
    });

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-4 rounded-xl border border-border/80 bg-card/60 backdrop-blur-xs space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-border/60">
        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
          <Sliders size={14} className="text-primary" />
          Execution Gates & Risk Armor
        </h3>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
          <Lock size={10} /> NO MARTINGALE
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-[11px] font-mono text-muted-foreground">Stake ({currency || "USD"})</Label>
          <Input
            type="number"
            step="0.1"
            min="0.35"
            value={stakeInput}
            onChange={(e) => setStakeInput(e.target.value)}
            className="h-8 font-mono text-xs"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] font-mono text-muted-foreground">Max Stake Cap</Label>
          <Input
            type="number"
            step="0.5"
            min="0.35"
            value={maxStakeInput}
            onChange={(e) => setMaxStakeInput(e.target.value)}
            className="h-8 font-mono text-xs"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] font-mono text-muted-foreground">Max Daily Loss ($)</Label>
          <Input
            type="number"
            step="1"
            min="1"
            value={dailyLossInput}
            onChange={(e) => setDailyLossInput(e.target.value)}
            className="h-8 font-mono text-xs"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] font-mono text-muted-foreground">Max Consecutive Losses</Label>
          <Input
            type="number"
            step="1"
            min="1"
            max="10"
            value={consecLossInput}
            onChange={(e) => setConsecLossInput(e.target.value)}
            className="h-8 font-mono text-xs"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] font-mono text-muted-foreground">Cooldown (seconds)</Label>
          <Input
            type="number"
            step="1"
            min="1"
            value={cooldownInput}
            onChange={(e) => setCooldownInput(e.target.value)}
            className="h-8 font-mono text-xs"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] font-mono text-muted-foreground">Max Signal Age (s)</Label>
          <div className="h-8 flex items-center px-3 rounded-md bg-secondary/50 border border-border/60 text-xs font-mono">
            {settings.maxSignalAgeSeconds}s TTL
          </div>
        </div>
      </div>

      <div className="pt-2 flex items-center justify-between border-t border-border/60">
        <span className="text-[10px] text-muted-foreground">
          Single contract limit: {settings.maxOpenContracts} active trade max
        </span>
        <Button
          size="sm"
          onClick={handleSave}
          className="h-7 text-xs font-semibold px-4"
        >
          {saved ? "Saved ✓" : "Apply Limits"}
        </Button>
      </div>
    </div>
  );
}
