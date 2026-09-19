import { useState } from "react";
import { Wallet, RefreshCw, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface AccountConnectionCardProps {
  account: {
    loginid: string;
    currency: string;
    is_virtual: boolean;
    balance?: number | null;
  } | null;
  balance?: number | null;
  currency?: string | null;
  status: "idle" | "connecting" | "open" | "closed" | "error";
  onRefresh: () => void;
}

export function AccountConnectionCard({
  account,
  balance,
  currency,
  status,
  onRefresh,
}: AccountConnectionCardProps) {
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const connectWithDeriv = async () => {
    setBusy(true);
    setErrorMsg(null);

    try {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session?.access_token) {
        throw new Error("Sign in to Sentinel before connecting a Deriv account.");
      }

      const response = await fetch("/api/deriv/oauth/start", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const payload = await response.json();
      if (!response.ok || !payload.authorizationUrl) {
        throw new Error(payload.error || "Unable to start Deriv authorization.");
      }

      window.location.assign(payload.authorizationUrl);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Deriv authorization failed.");
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        await supabase
          .from("deriv_accounts")
          .update({ is_active: false })
          .eq("user_id", userData.user.id);
      }
      onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const isConnected = !!account && status === "open";

  return (
    <div className="p-4 rounded-xl border border-border/80 bg-card/60 backdrop-blur-md space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-border/60">
        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
          <Wallet size={14} className="text-primary" />
          Deriv Account
        </h3>
        <span
          className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase flex items-center gap-1 ${
            isConnected
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
              : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${
            isConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
          }`} />
          {isConnected ? "CONNECTED" : "NOT CONNECTED"}
        </span>
      </div>

      {account ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-foreground font-mono">{account.loginid}</div>
              <div className="text-[10px] text-muted-foreground uppercase">
                {account.is_virtual ? "Demo / Virtual" : "Real Money Account"}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-mono uppercase text-muted-foreground">Balance</div>
              <div className="text-sm font-bold text-emerald-400 font-mono">
                {(balance ?? account.balance ?? 0).toFixed(2)} {currency || account.currency}
              </div>
            </div>
          </div>

          <div className="pt-2 flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={onRefresh} disabled={busy} className="h-7 text-xs flex-1">
              <RefreshCw size={11} className="mr-1" /> Refresh
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDisconnect}
              disabled={busy}
              className="h-7 text-xs text-destructive hover:bg-destructive/10"
            >
              <LogOut size={11} className="mr-1" /> Disconnect
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3 text-center py-2">
          <p className="text-xs text-muted-foreground">
            Connect through Deriv OAuth. Sentinel requests only the <strong>trade</strong> permission needed for Options trading.
          </p>
          <Button
            size="sm"
            onClick={connectWithDeriv}
            disabled={busy}
            className="w-full h-9 text-xs font-semibold uppercase"
          >
            <ShieldCheck size={14} className="mr-1.5" />
            {busy ? "Opening Deriv..." : "Connect Deriv"}
          </Button>
          {errorMsg && <p className="text-xs text-rose-400 font-mono">{errorMsg}</p>}
        </div>
      )}
    </div>
  );
}
