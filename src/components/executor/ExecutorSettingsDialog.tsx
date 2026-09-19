// SENTINEL EXECUTOR COMPREHENSIVE SETTINGS MODAL
// Persisted user configurations for Trade, Recovery/Martingale, Profit/Loss, Limits, and Auto Policy.

import { useState } from "react";
import {
  Sliders,
  Shield,
  Target,
  Clock,
  Zap,
  RotateCcw,
  Check,
  AlertTriangle,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { RiskSettings, AutoSignalPolicy } from "@/lib/executor/types";
import { generateRecoveryStepsTable } from "@/lib/executor/stake-calculator";

interface ExecutorSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: RiskSettings;
  onSaveSettings: (update: Partial<RiskSettings>) => void;
  currency?: string;
}

export function ExecutorSettingsDialog({
  open,
  onOpenChange,
  settings,
  onSaveSettings,
  currency = "USD",
}: ExecutorSettingsDialogProps) {
  const [form, setForm] = useState<RiskSettings>({ ...settings });
  const [activePreset, setActivePreset] = useState<string>(settings.riskPreset || "CUSTOM");
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Sync whenever dialog opens with current settings
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setForm({ ...settings });
      setActivePreset(settings.riskPreset || "CUSTOM");
    }
    onOpenChange(isOpen);
  };

  const applyPreset = (preset: "CONSERVATIVE" | "BALANCED" | "AGGRESSIVE") => {
    setActivePreset(preset);
    if (preset === "CONSERVATIVE") {
      setForm((prev) => ({
        ...prev,
        riskPreset: "CONSERVATIVE",
        stake: 0.35,
        baseStake: 0.35,
        martingaleEnabled: false,
        martingaleMultiplier: 1.15,
        maxRecoverySteps: 4,
        maxRecoveryStake: 3.0,
        targetProfit: 5.0,
        stopLoss: 3.0,
        cooldownSeconds: 2,
        maxConsecutiveLosses: 3,
        autoSignalPolicy: "SELECTED_TYPES",
        allowedContractTypes: ["DIGITUNDER", "DIGITOVER"],
      }));
    } else if (preset === "BALANCED") {
      setForm((prev) => ({
        ...prev,
        riskPreset: "BALANCED",
        stake: 0.35,
        baseStake: 0.35,
        martingaleEnabled: false,
        martingaleMultiplier: 1.2,
        maxRecoverySteps: 6,
        maxRecoveryStake: 5.0,
        targetProfit: 10.0,
        stopLoss: 5.0,
        cooldownSeconds: 0,
        maxConsecutiveLosses: 6,
        autoSignalPolicy: "EXECUTE_ALL",
        allowedContractTypes: ["DIGITUNDER", "DIGITOVER", "DIGITEVEN", "DIGITODD"],
      }));
    } else if (preset === "AGGRESSIVE") {
      setForm((prev) => ({
        ...prev,
        riskPreset: "AGGRESSIVE",
        stake: 0.5,
        baseStake: 0.5,
        martingaleEnabled: true,
        martingaleMultiplier: 1.35,
        maxRecoverySteps: 8,
        maxRecoveryStake: 15.0,
        targetProfit: 25.0,
        stopLoss: 15.0,
        cooldownSeconds: 0,
        maxConsecutiveLosses: 8,
        autoSignalPolicy: "EXECUTE_ALL",
      }));
    }
  };

  const handleSave = () => {
    onSaveSettings(form);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onOpenChange(false);
    }, 500);
  };

  // Preview table for Martingale steps
  const stepsPreview = generateRecoveryStepsTable(
    form.baseStake || form.stake,
    form.martingaleMultiplier,
    form.maxRecoverySteps,
    form.maxRecoveryStake
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto font-mono text-xs">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
            <Sliders size={16} className="text-primary" />
            Executor Configuration & Risk Armor
          </DialogTitle>
          <DialogDescription className="text-xs">
            Persisted execution settings, recovery mechanics, and safety gates.
          </DialogDescription>
        </DialogHeader>

        {/* Presets Quick Selector */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-background/50 border border-border/60">
          <span className="text-[10px] uppercase font-bold text-muted-foreground">
            Risk Profile Presets:
          </span>
          <div className="flex items-center gap-1.5">
            {(["CONSERVATIVE", "BALANCED", "AGGRESSIVE"] as const).map((p) => (
              <Button
                key={p}
                size="sm"
                variant={activePreset === p ? "default" : "outline"}
                onClick={() => applyPreset(p)}
                className="h-6 text-[10px] px-2.5 font-bold uppercase"
              >
                {p}
              </Button>
            ))}
          </div>
        </div>

        {/* Tabbed Settings Sections */}
        <Tabs defaultValue="recovery" className="w-full">
          <TabsList className="grid grid-cols-5 w-full h-8 text-[11px]">
            <TabsTrigger value="trade">Trade</TabsTrigger>
            <TabsTrigger value="recovery">Recovery</TabsTrigger>
            <TabsTrigger value="pnl">Profit/Loss</TabsTrigger>
            <TabsTrigger value="limits">Limits</TabsTrigger>
            <TabsTrigger value="policy">Auto Policy</TabsTrigger>
          </TabsList>

          {/* 1. Trade Settings Tab */}
          <TabsContent value="trade" className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground">
                  Default Stake ({currency})
                </Label>
                <Input
                  type="number"
                  step="0.05"
                  min="0.35"
                  value={form.stake}
                  onChange={(e) =>
                    setForm({ ...form, stake: Math.max(0.35, parseFloat(e.target.value) || 0.35) })
                  }
                  className="h-8 text-xs font-bold"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground">
                  Max Stake Hard Cap ($)
                </Label>
                <Input
                  type="number"
                  step="1"
                  min="1"
                  value={form.maxStake}
                  onChange={(e) =>
                    setForm({ ...form, maxStake: Math.max(1, parseFloat(e.target.value) || 10) })
                  }
                  className="h-8 text-xs font-bold"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground">
                  Default Duration (Ticks)
                </Label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={form.duration || 1}
                  onChange={(e) =>
                    setForm({ ...form, duration: parseInt(e.target.value, 10) || 1 })
                  }
                  className="h-8 text-xs font-bold"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground">
                  Duplicate Signal Protection
                </Label>
                <div className="flex items-center justify-between p-1.5 rounded border border-border/60 bg-background/50">
                  <span className="text-[11px]">One trade per signal ID</span>
                  <Switch
                    checked={form.duplicateProtection}
                    onCheckedChange={(checked) => setForm({ ...form, duplicateProtection: checked })}
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* 2. Recovery / Martingale Tab */}
          <TabsContent value="recovery" className="space-y-3 pt-2">
            <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg border border-border/60 bg-background/50">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground">Runs / Signal</Label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={form.runsPerSignal}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      runsPerSignal: Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 1)),
                    })
                  }
                  className="h-8 text-xs font-bold"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground">Wait Entry Digit</Label>
                <div className="h-8 flex items-center px-2 rounded border border-border/60 bg-background/50">
                  <Switch
                    checked={form.waitForEntryDigit}
                    onCheckedChange={(checked) => setForm({ ...form, waitForEntryDigit: checked })}
                  />
                  <span className="ml-2 text-[10px]">{form.waitForEntryDigit ? "ARMED" : "IMMEDIATE"}</span>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground">Recovery Digit</Label>
                <Input
                  type="number"
                  min="0"
                  max="9"
                  placeholder="OFF"
                  value={form.recoveryDigit ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      recoveryDigit: e.target.value === "" ? null : Math.min(9, Math.max(0, parseInt(e.target.value, 10))),
                    })
                  }
                  className="h-8 text-xs font-bold"
                />
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-background/50 border border-border/60 flex items-center justify-between">
              <div>
                <span className="font-bold uppercase text-foreground">Martingale Recovery Engine</span>
                <p className="text-[10px] text-muted-foreground">
                  Progressively adjusts stake on consecutive losses to recover capital.
                </p>
              </div>
              <Switch
                checked={form.martingaleEnabled}
                onCheckedChange={(checked) => setForm({ ...form, martingaleEnabled: checked })}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground">Base Stake ($)</Label>
                <Input
                  type="number"
                  step="0.05"
                  min="0.35"
                  value={form.baseStake}
                  onChange={(e) =>
                    setForm({ ...form, baseStake: Math.max(0.35, parseFloat(e.target.value) || 0.35) })
                  }
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground">Multiplier (x)</Label>
                <Input
                  type="number"
                  step="0.05"
                  min="1.05"
                  max="3.0"
                  value={form.martingaleMultiplier}
                  onChange={(e) =>
                    setForm({ ...form, martingaleMultiplier: parseFloat(e.target.value) || 1.2 })
                  }
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground">Max Steps</Label>
                <Input
                  type="number"
                  min="1"
                  max="12"
                  value={form.maxRecoverySteps}
                  onChange={(e) =>
                    setForm({ ...form, maxRecoverySteps: parseInt(e.target.value, 10) || 6 })
                  }
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground">Max Recovery Stake ($)</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="1"
                  value={form.maxRecoveryStake}
                  onChange={(e) =>
                    setForm({ ...form, maxRecoveryStake: parseFloat(e.target.value) || 5.0 })
                  }
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Reset Rules */}
            <div className="p-2.5 rounded-lg border border-border/60 bg-background/40 space-y-2">
              <span className="text-[10px] font-bold uppercase text-muted-foreground">
                Recovery Reset Rules
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="flex items-center justify-between p-1.5 rounded border border-border/40">
                  <span className="text-[11px]">Reset on Win</span>
                  <Switch
                    checked={form.resetAfterWin}
                    onCheckedChange={(checked) => setForm({ ...form, resetAfterWin: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-1.5 rounded border border-border/40">
                  <span className="text-[11px]">Reset on Target</span>
                  <Switch
                    checked={form.resetAfterTargetProfit}
                    onCheckedChange={(checked) =>
                      setForm({ ...form, resetAfterTargetProfit: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between p-1.5 rounded border border-border/40">
                  <span className="text-[11px]">Reset on Stop</span>
                  <Switch
                    checked={form.resetAfterStopLoss}
                    onCheckedChange={(checked) => setForm({ ...form, resetAfterStopLoss: checked })}
                  />
                </div>
              </div>
            </div>

            {/* Visual Step Simulation Table */}
            <div className="p-2.5 rounded-lg border border-border/60 bg-background/30 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">
                  Planned Recovery Steps Preview
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Cap: ${form.maxRecoveryStake.toFixed(2)}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {stepsPreview.map((s) => (
                  <div
                    key={s.step}
                    className={`px-2 py-1 rounded text-[11px] font-mono border ${
                      s.isWithinCap
                        ? "bg-primary/5 border-primary/30 text-foreground"
                        : "bg-rose-500/10 border-rose-500/40 text-rose-400"
                    }`}
                  >
                    <span className="text-muted-foreground">S{s.step}:</span>{" "}
                    <strong>${s.stake.toFixed(2)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* 3. Profit / Loss Tab */}
          <TabsContent value="pnl" className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              {/* Target Profit */}
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
                  <Target size={11} className="text-emerald-400" /> Target Profit ($)
                </Label>
                <div className="flex items-center gap-1">
                  {[5, 10, 20].map((tp) => (
                    <Button
                      key={tp}
                      type="button"
                      size="sm"
                      variant={form.targetProfit === tp ? "default" : "outline"}
                      onClick={() => setForm({ ...form, targetProfit: tp })}
                      className="h-6 text-[10px] px-2"
                    >
                      ${tp}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant={form.targetProfit === null ? "default" : "outline"}
                    onClick={() => setForm({ ...form, targetProfit: null })}
                    className="h-6 text-[10px] px-2"
                  >
                    OFF
                  </Button>
                </div>
                <Input
                  type="number"
                  step="1"
                  placeholder="Custom Target ($)"
                  value={form.targetProfit ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      targetProfit: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                  className="h-7 text-xs"
                />
              </div>

              {/* Stop Loss */}
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
                  <Shield size={11} className="text-rose-400" /> Session Stop Loss ($)
                </Label>
                <div className="flex items-center gap-1">
                  {[5, 10, 25].map((sl) => (
                    <Button
                      key={sl}
                      type="button"
                      size="sm"
                      variant={form.stopLoss === sl ? "default" : "outline"}
                      onClick={() => setForm({ ...form, stopLoss: sl })}
                      className="h-6 text-[10px] px-2"
                    >
                      ${sl}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant={form.stopLoss === null ? "default" : "outline"}
                    onClick={() => setForm({ ...form, stopLoss: null })}
                    className="h-6 text-[10px] px-2"
                  >
                    OFF
                  </Button>
                </div>
                <Input
                  type="number"
                  step="1"
                  placeholder="Custom Stop ($)"
                  value={form.stopLoss ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      stopLoss: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                  className="h-7 text-xs"
                />
              </div>

              {/* Contract Early Exit Take Profit */}
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground">
                  Contract Take Profit (Early Exit $)
                </Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="OFF (Hold to expiry)"
                  value={form.contractTakeProfit ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      contractTakeProfit: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                  className="h-8 text-xs"
                />
              </div>

              {/* Contract Early Exit Stop Loss */}
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground">
                  Contract Stop Loss (Early Exit $)
                </Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="OFF (Hold to expiry)"
                  value={form.contractStopLoss ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      contractStopLoss: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </TabsContent>

          {/* 4. Trade Limits Tab */}
          <TabsContent value="limits" className="space-y-3 pt-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground">
                  Max Trades / Session
                </Label>
                <Input
                  type="number"
                  min="1"
                  value={form.maxTradesPerSession}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      maxTradesPerSession: parseInt(e.target.value, 10) || 50,
                    })
                  }
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground">
                  Max Consecutive Losses
                </Label>
                <Input
                  type="number"
                  min="1"
                  max="15"
                  value={form.maxConsecutiveLosses}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      maxConsecutiveLosses: parseInt(e.target.value, 10) || 6,
                    })
                  }
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground">
                  Max Signal Age (TTL Sec)
                </Label>
                <Input
                  type="number"
                  min="1"
                  max="30"
                  value={form.maxSignalAgeSeconds}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      maxSignalAgeSeconds: parseInt(e.target.value, 10) || 5,
                    })
                  }
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Cooldown Settings */}
            <div className="space-y-1.5 p-2.5 rounded-lg border border-border/60 bg-background/50">
              <Label className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
                <Clock size={11} /> Trade Cooldown (Seconds between trades)
              </Label>
              <div className="flex flex-wrap items-center gap-1.5">
                {[0, 1, 2, 5, 10, 30, 60].map((sec) => (
                  <Button
                    key={sec}
                    type="button"
                    size="sm"
                    variant={form.cooldownSeconds === sec ? "default" : "outline"}
                    onClick={() => setForm({ ...form, cooldownSeconds: sec })}
                    className="h-6 text-[10px] px-2.5"
                  >
                    {sec}s
                  </Button>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* 5. Auto Policy Tab */}
          <TabsContent value="policy" className="space-y-3 pt-2">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase text-muted-foreground">
                Auto Signal Dispatch Policy
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  {
                    id: "EXECUTE_ALL",
                    label: "Execute Every Signal",
                    desc: "Auto-executes all valid arriving signals passing risk gates.",
                  },
                  {
                    id: "SELECTED_TYPES",
                    label: "Selected Signal Types",
                    desc: "Only executes approved contract types specified below.",
                  },
                  {
                    id: "MANUAL_CONFIRM",
                    label: "Manual Confirmation Required",
                    desc: "Loads signals automatically, but requires operator click to BUY.",
                  },
                  {
                    id: "LOAD_ONLY",
                    label: "Load Only",
                    desc: "Populates incoming signal feed without triggering trades.",
                  },
                ].map((pol) => (
                  <button
                    key={pol.id}
                    type="button"
                    onClick={() =>
                      setForm({ ...form, autoSignalPolicy: pol.id as AutoSignalPolicy })
                    }
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      form.autoSignalPolicy === pol.id
                        ? "border-primary bg-primary/10 text-foreground shadow-xs"
                        : "border-border/60 bg-background/40 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="font-bold text-xs">{pol.label}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{pol.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Contract Types filter */}
            {form.autoSignalPolicy === "SELECTED_TYPES" && (
              <div className="p-2.5 rounded-lg border border-border/60 bg-background/40 space-y-2">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">
                  Allowed Contract Types:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {["DIGITUNDER", "DIGITOVER", "DIGITEVEN", "DIGITODD", "DIGITMATCH", "DIGITDIFF"].map(
                    (ctype) => {
                      const isAllowed = form.allowedContractTypes.includes(ctype);
                      return (
                        <button
                          key={ctype}
                          type="button"
                          onClick={() => {
                            const updated = isAllowed
                              ? form.allowedContractTypes.filter((t) => t !== ctype)
                              : [...form.allowedContractTypes, ctype];
                            setForm({ ...form, allowedContractTypes: updated });
                          }}
                          className={`px-2.5 py-1.5 rounded text-[11px] font-bold border transition-colors ${
                            isAllowed
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                              : "bg-background/60 text-muted-foreground border-border/60"
                          }`}
                        >
                          {ctype.replace("DIGIT", "")}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/60">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            className="text-xs font-bold bg-primary text-primary-foreground gap-1.5"
          >
            <Check size={13} />
            {savedSuccess ? "Saved!" : "Save Configuration"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
