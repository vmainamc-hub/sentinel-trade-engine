import { useState } from "react";
import {
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Trash2,
  Download,
  Filter,
  Activity,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ExecutionAuditRecord, AuditEvent } from "@/lib/executor/types";

interface ExecutionJournalPanelProps {
  records: ExecutionAuditRecord[];
  events: AuditEvent[];
  stats: {
    totalExecuted: number;
    wins: number;
    losses: number;
    winRate: number;
    totalPnl: number;
    dailyTrades: number;
    consecutiveLosses: number;
    dailyRealizedLoss: number;
    rejectedCount: number;
  };
  onClear: () => void;
}

export function ExecutionJournalPanel({
  records,
  events,
  stats,
  onClear,
}: ExecutionJournalPanelProps) {
  const [filter, setFilter] = useState<"ALL" | "WINS" | "LOSSES" | "REJECTED">("ALL");

  const filteredRecords = records.filter((r) => {
    if (filter === "WINS") return r.result === "WIN";
    if (filter === "LOSSES") return r.result === "LOSS";
    if (filter === "REJECTED") return r.status === "REJECTED";
    return true;
  });

  const exportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ records, events, stats }, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `sentinel-execution-journal-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="p-5 rounded-xl border border-border/80 bg-card/70 backdrop-blur-md shadow-sm space-y-4">
      {/* Header & Stats Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-border/60">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-foreground font-display flex items-center gap-2">
            <FileText size={16} className="text-primary" />
            Execution Journal & Forensic Audit Log
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cryptographically complete audit record of every trade order, execution event, and rejection.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={exportJson}
            className="h-7 text-xs font-semibold px-2.5"
          >
            <Download size={12} className="mr-1" /> Export JSON
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onClear}
            className="h-7 text-xs font-semibold px-2.5 text-muted-foreground hover:text-destructive"
          >
            <Trash2 size={12} className="mr-1" /> Clear
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
        <div className="p-2.5 rounded-lg bg-background/50 border border-border/50">
          <div className="text-[10px] font-mono uppercase text-muted-foreground">Trades Settled</div>
          <div className="text-base font-bold text-foreground mt-0.5">{stats.totalExecuted}</div>
        </div>
        <div className="p-2.5 rounded-lg bg-background/50 border border-border/50">
          <div className="text-[10px] font-mono uppercase text-muted-foreground">Win Rate</div>
          <div className="text-base font-bold text-emerald-400 mt-0.5">
            {stats.winRate.toFixed(1)}%
          </div>
          <div className="text-[10px] text-muted-foreground">
            {stats.wins}W - {stats.losses}L
          </div>
        </div>
        <div className="p-2.5 rounded-lg bg-background/50 border border-border/50">
          <div className="text-[10px] font-mono uppercase text-muted-foreground">Net Realized P/L</div>
          <div
            className={`text-base font-bold mt-0.5 font-mono ${
              stats.totalPnl >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {stats.totalPnl >= 0 ? "+" : ""}${stats.totalPnl.toFixed(2)}
          </div>
        </div>
        <div className="p-2.5 rounded-lg bg-background/50 border border-border/50">
          <div className="text-[10px] font-mono uppercase text-muted-foreground">Trades Today</div>
          <div className="text-base font-bold text-foreground mt-0.5">{stats.dailyTrades}</div>
        </div>
        <div className="p-2.5 rounded-lg bg-background/50 border border-border/50">
          <div className="text-[10px] font-mono uppercase text-muted-foreground">Consecutive Losses</div>
          <div className="text-base font-bold text-amber-400 mt-0.5">{stats.consecutiveLosses}</div>
        </div>
        <div className="p-2.5 rounded-lg bg-background/50 border border-border/50">
          <div className="text-[10px] font-mono uppercase text-muted-foreground">Blocked Signals</div>
          <div className="text-base font-bold text-rose-400 mt-0.5">{stats.rejectedCount}</div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="trades" className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <TabsList className="bg-secondary/40">
            <TabsTrigger value="trades" className="text-xs">
              Trades ({records.filter((r) => r.status === "EXECUTED").length})
            </TabsTrigger>
            <TabsTrigger value="rejections" className="text-xs">
              Rejected ({records.filter((r) => r.status === "REJECTED").length})
            </TabsTrigger>
            <TabsTrigger value="audit" className="text-xs">
              Audit Events ({events.length})
            </TabsTrigger>
          </TabsList>

          {/* Quick Filters */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Filter size={11} /> Filter:
            </span>
            {(["ALL", "WINS", "LOSSES", "REJECTED"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase transition-colors ${
                  filter === f
                    ? "bg-primary text-primary-foreground font-bold"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Tab 1: Trades */}
        <TabsContent value="trades" className="mt-3">
          {filteredRecords.filter((r) => r.status === "EXECUTED").length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground rounded-lg border border-border/50 bg-background/30">
              No executed trades recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground text-[10px] uppercase text-left">
                    <th className="py-2 px-2">Time</th>
                    <th className="py-2 px-2">Mode</th>
                    <th className="py-2 px-2">Market</th>
                    <th className="py-2 px-2">Contract</th>
                    <th className="py-2 px-2">Stake</th>
                    <th className="py-2 px-2">Spots</th>
                    <th className="py-2 px-2">Result</th>
                    <th className="py-2 px-2 text-right">P/L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredRecords
                    .filter((r) => r.status === "EXECUTED")
                    .map((r) => {
                      const isWin = r.result === "WIN";
                      return (
                        <tr key={r.id} className="hover:bg-secondary/20">
                          <td className="py-2 px-2 text-muted-foreground text-[11px]">
                            {new Date(r.timestamp).toLocaleTimeString()}
                          </td>
                          <td className="py-2 px-2">
                            <span className="px-1.5 py-0.5 rounded bg-secondary text-[10px] uppercase">
                              {r.mode}
                            </span>
                          </td>
                          <td className="py-2 px-2 font-bold text-foreground">{r.market}</td>
                          <td className="py-2 px-2 text-cyan-400">{r.contract}</td>
                          <td className="py-2 px-2">${r.stake.toFixed(2)}</td>
                          <td className="py-2 px-2 text-muted-foreground text-[10px]">
                            {r.entrySpot ? `E:${r.entrySpot.toFixed(3)}` : "—"}{" "}
                            {r.settlementSpot ? `X:${r.settlementSpot.toFixed(3)}` : ""}
                          </td>
                          <td className="py-2 px-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                isWin
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : r.result === "LOSS"
                                  ? "bg-rose-500/20 text-rose-400"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {r.result || "OPEN"}
                            </span>
                          </td>
                          <td
                            className={`py-2 px-2 text-right font-bold ${
                              (r.pnl ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {r.pnl !== undefined
                              ? `${r.pnl >= 0 ? "+" : ""}$${r.pnl.toFixed(2)}`
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Rejections */}
        <TabsContent value="rejections" className="mt-3">
          {filteredRecords.filter((r) => r.status === "REJECTED").length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground rounded-lg border border-border/50 bg-background/30">
              No rejected signals.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground text-[10px] uppercase text-left">
                    <th className="py-2 px-2">Time</th>
                    <th className="py-2 px-2">Market</th>
                    <th className="py-2 px-2">Contract</th>
                    <th className="py-2 px-2">Score</th>
                    <th className="py-2 px-2">Reason for Block</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredRecords
                    .filter((r) => r.status === "REJECTED")
                    .map((r) => (
                      <tr key={r.id} className="hover:bg-secondary/20">
                        <td className="py-2 px-2 text-muted-foreground text-[11px]">
                          {new Date(r.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-2 px-2 font-bold text-foreground">{r.market}</td>
                        <td className="py-2 px-2 text-cyan-400">{r.contract}</td>
                        <td className="py-2 px-2">{r.confluence}</td>
                        <td className="py-2 px-2 text-rose-400">{r.rejectionReason}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* Tab 3: Forensic Audit Events */}
        <TabsContent value="audit" className="mt-3">
          {events.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground rounded-lg border border-border/50 bg-background/30">
              No audit events logged.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
              {events.slice(0, 100).map((e) => (
                <div
                  key={e.id}
                  className="p-2 rounded-md bg-secondary/30 border border-border/40 text-xs font-mono flex items-start justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold">
                        {e.type}
                      </span>
                      <span className="text-foreground">{e.message}</span>
                    </div>
                    {e.details && (
                      <div className="text-[10px] text-muted-foreground/80 truncate max-w-xl">
                        {JSON.stringify(e.details)}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(e.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
