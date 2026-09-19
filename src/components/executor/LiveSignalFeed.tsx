import { Zap, Clock, ShieldAlert, CheckCircle2, Play, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ExecutionSignal } from "@/lib/executor/types";

interface LiveSignalFeedProps {
  signals: ExecutionSignal[];
  onSelectSignal: (signal: ExecutionSignal) => void;
  isAutoArmed: boolean;
}

export function LiveSignalFeed({ signals, onSelectSignal, isAutoArmed }: LiveSignalFeedProps) {
  if (signals.length === 0) {
    return (
      <div className="p-6 rounded-xl border border-border/60 bg-card/30 text-center text-xs text-muted-foreground">
        Scanning universe for candidate setups...
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Zap size={14} className="text-primary" />
          Live Sentinel Signal Stream
        </h3>
        <span className="text-[10px] font-mono text-muted-foreground">
          Top {signals.length} Candidates
        </span>
      </div>

      <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
        {signals.map((sig) => {
          const isEnter = sig.sentinelStatus === "ENTER NOW";
          const isBlocked = sig.sentinelStatus === "BLOCKED" || sig.qualificationStatus === "REJECTED";

          return (
            <div
              key={sig.id}
              className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                isEnter && !isBlocked
                  ? "border-emerald-500/40 bg-emerald-500/5"
                  : isBlocked
                  ? "border-border/40 bg-background/40 opacity-75"
                  : "border-border/60 bg-card/60"
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${
                      isEnter && !isBlocked
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                        : isBlocked
                        ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isBlocked ? "BLOCKED" : sig.sentinelStatus}
                  </span>
                  <span className="text-xs font-bold text-foreground">{sig.marketName}</span>
                  <span className="text-xs font-mono font-semibold text-cyan-400">
                    {sig.contractLabel}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground font-mono">
                  <span>Score: {sig.score}</span>
                  <span>·</span>
                  <span>Conf: {sig.confidence}%</span>
                  <span>·</span>
                  <span>Danger: {sig.danger.composite}</span>
                  {sig.entryDigit !== undefined && (
                    <>
                      <span>·</span>
                      <span className="text-emerald-400">Entry: {sig.entryDigit}</span>
                    </>
                  )}
                </div>

                {isBlocked && sig.rejectionReasons && (
                  <div className="text-[10px] text-rose-400/90 font-mono flex items-center gap-1">
                    <AlertTriangle size={10} /> {sig.rejectionReasons[0]}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                {isAutoArmed && isEnter && !isBlocked && (
                  <span className="text-[10px] font-mono text-emerald-400 uppercase font-semibold animate-pulse">
                    Auto-Queue
                  </span>
                )}
                <Button
                  size="sm"
                  variant={isEnter && !isBlocked ? "default" : "outline"}
                  onClick={() => onSelectSignal(sig)}
                  disabled={isBlocked}
                  className="h-7 text-xs px-3 font-semibold uppercase"
                >
                  Stage
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
