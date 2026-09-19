import { useState } from "react";
import { Wallet, Key, ShieldCheck, RefreshCw, ExternalLink, LogOut, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";\nimport { DERIV_APP_ID } from "@/lib/deriv/api";

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
  const [modalOpen, setModalOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleConnectToken = async () => {
    if (!tokenInput.trim()) return;
    setSubmitting(true);
    setErrorMsg(null);

    try {
      // Connect to Deriv WS with token to test and retrieve details
      const ws = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=${DERIV_APP_ID}");
      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => {
          ws.send(JSON.stringify({ authorize: tokenInput.trim() }));
        };
        ws.onmessage = async (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.error) {
              reject(new Error(data.error.message || "Invalid Deriv token"));
              return;
            }
            if (data.authorize) {
              const auth = data.authorize;
              // Save to Supabase deriv_accounts if user authenticated
              const { data: userData } = await supabase.auth.getUser();
              if (userData.user) {
                // Set all other accounts active=false
                await supabase
                  .from("deriv_accounts")
                  .update({ is_active: false })
                  .eq("user_id", userData.user.id);

                await supabase.from("deriv_accounts").upsert({
                  user_id: userData.user.id,
                  loginid: auth.loginid,
                  token: tokenInput.trim(),
                  currency: auth.currency,
                  is_virtual: Boolean(auth.is_virtual),
                  balance: Number(auth.balance),
                  is_active: true,
                });
              } else {
                // Store in localStorage as fallback session
                localStorage.setItem(
                  "deriv.active_account",
                  JSON.stringify({
                    loginid: auth.loginid,
                    token: tokenInput.trim(),
                    currency: auth.currency,
                    is_virtual: Boolean(auth.is_virtual),
                    balance: Number(auth.balance),
                  })
                );
              }
              ws.close();
              resolve();
            }
          } catch (e: any) {
            reject(e);
          }
        };
        ws.onerror = () => reject(new Error("WebSocket connection error"));
      });

      setModalOpen(false);
      setTokenInput("");
      onRefresh();
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to authorize Deriv token");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        await supabase
          .from("deriv_accounts")
          .update({ is_active: false })
          .eq("user_id", userData.user.id);
      }
      localStorage.removeItem("deriv.active_account");
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const isConnected = !!account && status === "open";

  return (
    <div className="p-4 rounded-xl border border-border/80 bg-card/60 backdrop-blur-xs space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-border/60">
        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
          <Wallet size={14} className="text-primary" />
          Deriv Account Nexus
        </h3>
        <span
          className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase flex items-center gap-1 ${
            isConnected
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
              : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
          {isConnected ? "AUTHORIZED" : "DISCONNECTED"}
        </span>
      </div>

      {account ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-foreground font-mono">
                {account.loginid}
              </div>
              <div className="text-[10px] text-muted-foreground uppercase">
                {account.is_virtual ? "Demo / Virtual" : "Real Money Account"}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-mono uppercase text-muted-foreground">Available</div>
              <div className="text-sm font-bold text-emerald-400 font-mono">
                ${(balance ?? account.balance ?? 0).toFixed(2)} {currency || account.currency}
              </div>
            </div>
          </div>

          <div className="pt-2 flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onRefresh}
              className="h-7 text-xs flex-1"
            >
              <RefreshCw size={11} className="mr-1" /> Refresh
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDisconnect}
              className="h-7 text-xs text-destructive hover:bg-destructive/10"
            >
              <LogOut size={11} className="mr-1" /> Disconnect
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3 text-center py-2">
          <p className="text-xs text-muted-foreground">
            Connect your Deriv account using an API token with <strong>Read</strong> and <strong>Trade</strong> scopes.
          </p>
          <Button
            size="sm"
            onClick={() => setModalOpen(true)}
            className="w-full h-8 text-xs font-semibold uppercase bg-primary hover:bg-primary/90"
          >
            <Key size={13} className="mr-1.5" /> Connect Deriv Token
          </Button>
        </div>
      )}

      {/* Token modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <Key className="w-4 h-4 text-primary" /> Connect Deriv API Token
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Generate a token at <span className="text-primary font-mono">Deriv Settings &gt; API Token</span> with &apos;Read&apos; and &apos;Trade&apos; scopes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Deriv API Token</Label>
              <Input
                type="password"
                placeholder="Enter your Deriv API token..."
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            {errorMsg && (
              <p className="text-xs text-rose-400 font-mono">{errorMsg}</p>
            )}

            <div className="p-3 rounded-md bg-secondary/40 text-[11px] text-muted-foreground space-y-1">
              <p>• Requires <strong>Read</strong> (for balance) and <strong>Trade</strong> (for buy/sell).</p>
              <p>• You can use either a Real or Virtual account token.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleConnectToken} disabled={submitting || !tokenInput.trim()}>
              {submitting ? "Authorizing..." : "Authorize & Connect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
