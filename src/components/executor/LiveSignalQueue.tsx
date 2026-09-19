// SENTINEL LIVE INCOMING SIGNAL QUEUE
// Displays every signal received from Sentinel intelligence.
// Decouples signal reception and display from analytical classification.
// Provides [ LOAD ] and [ EXECUTE ] actions on each signal.

import { useState } from "react";
import {
  Zap,
  Clock,
  Play,
  Download,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Trash2,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SignalQueueItem, ExecutionSignal, SignalQueueState } from "@/lib/executor/types";

interface LiveSignalQueueProps {
  queue: SignalQueueItem[];
  stagedSignalId?: string;
  onLoadSignal: (signal: ExecutionSignal) => void;
  onExecuteSignal: (signal: ExecutionSignal) => void;
  onClearQueue: () => void;
  isAutoArmed: boolean;
  onTestSignal?: () => void;
}

export function LiveSignalQueue({
  queue,
  stagedSignalId,
  onLoadSignal,
  onExecuteSignal,
  onClearQueue,
  isAutoArmed,
  onTestSignal,
}: LiveSignalQueueProps) {
  const [filterType, setFilterType] = useState<string>("ALL");

  const filteredQueue = queue.filter((item) => {
    if (filterType === "ALL") return true;
    if (filterType === "EXECUTED") return item.state === "EXECUTED";
    if (filterType === "ENTER_NOW") return item.signal.sentinelStatus === "ENTER NOW";
    if (filterType === "UNDER") return item.signal.contractType === "DIGITUNDER";
    if (filterType === "OVER") return item.signal.contractType === "DIGITOVER";
    return true;
  });

  const getStatusBadge = (state: SignalQueueState, reason?: string) => {
    switch (state) {
      case "EXECUTED":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
            EXECUTED
          </span>
        );
      case "EXECUTING":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
            EXECUTING
          </span>
        );
      case "LOADED":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
            LOADED
          </span>
        );
      case "REJECTED":
        return (
          <span
            className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-rose-500/20 text-rose-400 border border-rose-500/40"
            title={reason}
          >
            REJECTED
          </span>
        );
      case "SKIPPED":
        return (
          <span
            className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-muted/60 text-muted-foreground border border-border/60"
            title={reason}
          >
            SKIPPED
          </span>
        );
      case "RECEIVED":
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-primary/10 text-primary border border-primary/30">
            RECEIVED
          </span>
        );
    }
  };

  const getSentinelTag = (status: string) => {
    switch (status) {
      case "ENTER NOW":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";
      case "ARMED":
      case "PREPARE":
        return "bg-amber-500/20 text-amber-300 border-amber-500/40";
      case "WATCH":
        return "bg-cyan-500/20 text-cyan-400 border-cyan-500/40";
      case "BLOCKED":
        return "bg-rose-500/20 text-rose-400 border-rose-500/40";
      default:
        return "bg-muted/60 text-muted-foreground border-border/60";
    }
  };

  return (
    <div className="rounded-xl border border-border/75 bg-card/60 backdrop-blur-md overflow-hidden flex flex-col">
      {/* Queue Header & Filters */}
      <div className="p-3.5 border-b border-border/60 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground font-display">
            Incoming Signals Queue
          </h3>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/30 font-semibold">
            {queue.length} Signals
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Filters */}
          <div className="flex items-center rounded-lg border border-border/60 bg-background/60 p-0.5 text-[11px] font-mono">
            {["ALL", "ENTER_NOW", "UNDER", "OVER", "EXECUTED"].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilterType(f)}
                className={`px-2 py-0.5 rounded uppercase font-semibold transition-colors ${
                  filterType === f
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.replace("_", " ")}
              </button>
            ))}
          </div>

          {queue.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onClearQueue}
              className="h-7 px-2 text-xs font-mono text-muted-foreground hover:text-rose-400"
              title="Clear Queue"
            >
              <Trash2 size={13} />
            </Button>
          )}
        </div>
      </div>

      {/* Queue Items List */}
      <div className="divide-y divide-border/40 max-h-[380px] overflow-y-auto">
        {filteredQueue.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2.5">
            <Clock className="w-6 h-6 text-muted-foreground/50 animate-pulse" />
            <span className="font-semibold text-foreground">Listening for incoming Sentinel sound-alert signals...</span>
            <span className="text-[11px] text-muted-foreground/80 max-w-sm">
              Whenever Sentinel sounds an audio chime for a surfaced opportunity, it loads here automatically. In AUTO mode, it executes immediately.
            </span>
            {onTestSignal && (
              <Button
                size="sm"
                variant="outline"
                onClick={onTestSignal}
                className="mt-2 text-xs font-mono font-bold uppercase gap-1.5 border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
              >
                <Zap size={12} fill="currentColor" />
                Test Sound Alert & Signal
              </Button>
            )}
          </div>
        ) : (
          filteredQueue.map((item) => {
            const sig = item.signal;
            const isStaged = stagedSignalId === sig.id;
            const timeStr = new Date(item.receivedAt).toLocaleTimeString();

            return (
              <div
                key={sig.id}
                className={`p-3 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono ${
                  isStaged ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-accent/20"
                }`}
              >
                {/* Signal Info */}
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Queue State */}
                    {getStatusBadge(item.state, item.rejectionReason)}

                    {/* Sentinel Status */}
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${getSentinelTag(
                        sig.sentinelStatus
                      )}`}
                    >
                      {sig.sentinelStatus}
                    </span>

                    {/* Market & Contract */}
                    <span className="font-bold text-foreground">{sig.marketName}</span>
                    <span className="text-cyan-400 font-bold">{sig.contractLabel}</span>

                    {/* Direction */}
                    <span className="text-muted-foreground text-[11px]">
                      ({sig.direction} barrier {sig.barrier})
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock size={11} /> {timeStr}
                    </span>
                    <span>·</span>
                    <span>Score: {sig.score}</span>
                    <span>·</span>
                    <span>Conf: {sig.confidence}%</span>
                    {sig.entryDigit !== undefined && (
                      <>
                        <span>·</span>
                        <span className="text-emerald-400">Entry: {sig.entryDigit}</span>
                      </>
                    )}
                    {item.rejectionReason && (
                      <span className="text-rose-400 font-sans max-w-xs truncate" title={item.rejectionReason}>
                        ⚠ {item.rejectionReason}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions: LOAD and EXECUTE */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <Button
                    size="sm"
                    variant={isStaged ? "default" : "outline"}
                    onClick={() => onLoadSignal(sig)}
                    className="h-7 px-2.5 text-xs font-mono font-bold uppercase gap-1"
                  >
                    <Eye size={12} />
                    {isStaged ? "STAGED" : "LOAD"}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onExecuteSignal(sig)}
                    className="h-7 px-2.5 text-xs font-mono font-bold uppercase border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 gap-1"
                  >
                    <Play size={11} fill="currentColor" />
                    EXECUTE
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
