import { CheckCircle2, Radio, Clock, ShieldCheck, Zap, Layers, RefreshCw } from "lucide-react";
import type { ExecutorStatus } from "@/lib/executor/types";

interface ExecutionPipelineTrackerProps {
  status: ExecutorStatus;
  pipelineStep: string;
  hasOpenContracts: boolean;
  hasQualifiedSignal: boolean;
  derivConnected: boolean;
}

export function ExecutionPipelineTracker({
  status,
  pipelineStep,
  hasOpenContracts,
  hasQualifiedSignal,
  derivConnected,
}: ExecutionPipelineTrackerProps) {
  const steps = [
    {
      id: "feed",
      label: "Deriv Feed",
      active: status !== "FEED_STALE",
      desc: status === "FEED_STALE" ? "Stale" : "Live Ticks",
    },
    {
      id: "sentinel",
      label: "Sentinel Brain",
      active: hasQualifiedSignal,
      desc: hasQualifiedSignal ? "ENTER NOW" : "Scanning",
    },
    {
      id: "gates",
      label: "Risk Gates",
      active: pipelineStep !== "IDLE" || status === "ARMED",
      desc: "Fresh & Vetted",
    },
    {
      id: "proposal",
      label: "Proposal",
      active: pipelineStep === "PROPOSAL" || pipelineStep === "BUYING" || hasOpenContracts,
      desc: pipelineStep === "PROPOSAL" ? "Pricing..." : "Validated",
    },
    {
      id: "buy",
      label: "Deriv Buy",
      active: pipelineStep === "BUYING" || hasOpenContracts,
      desc: pipelineStep === "BUYING" ? "Submitting..." : "Confirmed",
    },
    {
      id: "open",
      label: "Open Contract",
      active: hasOpenContracts,
      desc: hasOpenContracts ? "Monitoring" : "Idle",
    },
    {
      id: "settle",
      label: "Settlement",
      active: hasOpenContracts,
      desc: "Realized P/L",
    },
  ];

  return (
    <div className="p-3.5 rounded-xl border border-border/70 bg-card/40 backdrop-blur-xs">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Autonomous Execution Lifecycle
        </span>
        <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          Single Authoritative Pipe
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
        {steps.map((s, idx) => (
          <div
            key={s.id}
            className={`p-2 rounded-lg border text-center transition-all ${
              s.active
                ? "bg-primary/10 border-primary/40 text-foreground"
                : "bg-background/40 border-border/40 text-muted-foreground/60"
            }`}
          >
            <div className="text-[10px] font-mono text-muted-foreground/80 mb-0.5">
              0{idx + 1}
            </div>
            <div className="text-xs font-bold leading-tight truncate">{s.label}</div>
            <div className="text-[10px] font-mono mt-1 opacity-90">{s.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
