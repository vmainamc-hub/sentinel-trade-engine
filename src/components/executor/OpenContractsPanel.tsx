import { useState } from "react";
import { Clock, ShieldCheck, TrendingUp, AlertCircle, DollarSign, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { OpenContract } from "@/lib/executor/types";

interface OpenContractsPanelProps {
  contracts: OpenContract[];
  onSellContract: (contractId: string) => Promise<{ ok: boolean; error?: string }>;
}

export function OpenContractsPanel({ contracts, onSellContract }: OpenContractsPanelProps) {
  const [selectedSell, setSelectedSell] = useState<OpenContract | null>(null);
  const [selling, setSelling] = useState(false);

  const handleConfirmSell = async () => {
    if (!selectedSell) return;
    setSelling(true);
    try {
      await onSellContract(selectedSell.contractId);
      setSelectedSell(null);
    } finally {
      setSelling(false);
    }
  };

  if (contracts.length === 0) {
    return (
      <div className="p-4 rounded-xl border border-border/70 bg-card/40 flex items-center justify-center min-h-[140px] text-center">
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <ShieldCheck size={16} className="text-muted-foreground/60" />
          No active open contracts currently monitoring.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Active Open Contracts ({contracts.length})
        </h3>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {contracts.map((c) => {
          const isWinning = c.currentProfit > 0;
          return (
            <div
              key={c.contractId}
              className="p-4 rounded-xl border border-border/80 bg-card/80 backdrop-blur-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground font-display">
                    {c.marketName}
                  </span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground border border-border/60">
                    {c.contractLabel}
                  </span>
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary border border-primary/20">
                    {c.mode}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground font-mono mt-1 flex flex-wrap items-center gap-3">
                  <span>ID: {c.contractId}</span>
                  {c.entrySpot && <span>Entry: {c.entrySpot.toFixed(4)}</span>}
                  {c.currentSpot && <span>Current Spot: {c.currentSpot.toFixed(4)}</span>}
                  <span>Barrier: {c.barrier}</span>
                </div>
              </div>

              <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                <div className="text-right">
                  <div className="text-[10px] font-mono uppercase text-muted-foreground">
                    Stake / Est. Payout
                  </div>
                  <div className="text-xs font-bold text-foreground">
                    ${c.buyPrice.toFixed(2)} → ${c.potentialPayout.toFixed(2)}
                  </div>
                  <div
                    className={`text-sm font-mono font-bold mt-0.5 ${
                      isWinning ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {c.currentProfit >= 0 ? "+" : ""}${c.currentProfit.toFixed(2)}
                  </div>
                </div>

                {/* Sell / Early exit button */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedSell(c)}
                  disabled={!c.isSellable && c.mode === "LIVE"}
                  className="h-8 px-3 border-border hover:bg-destructive/10 hover:text-destructive text-xs font-semibold"
                >
                  SELL
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation modal for manual sell */}
      <Dialog open={!!selectedSell} onOpenChange={(open) => !open && setSelectedSell(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <XCircle className="text-destructive w-4 h-4" />
              Early Contract Exit
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to close this contract before expiration?
            </DialogDescription>
          </DialogHeader>

          {selectedSell && (
            <div className="p-3 rounded-lg bg-secondary/40 border border-border/70 space-y-1.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Contract ID:</span>
                <span className="text-foreground">{selectedSell.contractId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current P/L:</span>
                <span className={selectedSell.currentProfit >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                  {selectedSell.currentProfit >= 0 ? "+" : ""}${selectedSell.currentProfit.toFixed(2)}
                </span>
              </div>
              {selectedSell.bidPrice && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Offered Bid:</span>
                  <span className="text-foreground">${selectedSell.bidPrice.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedSell(null)}
              disabled={selling}
            >
              Keep Contract
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleConfirmSell}
              disabled={selling}
            >
              {selling ? "Selling..." : "Confirm Sell"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
