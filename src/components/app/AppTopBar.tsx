import { Link } from "@tanstack/react-router";
import { useStream } from "@/lib/stream-context";
import { useDerivAccount } from "@/lib/deriv/account-context";
import { Wifi, WifiOff, Radio, Pause, Play, Wallet, Shield, Zap } from "lucide-react";
import { AlertSoundToggle } from "@/components/app/AlertSoundToggle";

export function AppTopBar() {
  const s = useStream();
  const { account, balance, currency, status: derivStatus } = useDerivAccount();

  return (
    <header className="h-14 border-b border-border/40 glass sticky top-0 z-20 flex items-center gap-3 px-4">
      <div className="flex items-center gap-2.5 mr-2">
        <div className="grid place-items-center w-8 h-8 rounded-lg bg-[var(--accent)]/15 border border-[var(--accent)]/30">
          <Shield className="w-4 h-4 text-[var(--accent)]" />
        </div>
        <div className="flex flex-col">
          <span className="text-[12px] font-bold uppercase tracking-[0.18em] text-foreground font-display">
            Sentinel
          </span>
          <span className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground -mt-0.5">
            Intelligence Engine
          </span>
        </div>
      </div>

      <nav className="flex items-center gap-1.5 ml-2" aria-label="Primary">
        <Link
          to="/app/apex"
          activeProps={{ className: "bg-primary/20 text-primary border-primary/40 font-bold" }}
          inactiveProps={{ className: "bg-secondary/40 text-muted-foreground hover:text-foreground border-border/50" }}
          className="h-8 px-3 rounded-md text-xs uppercase tracking-wider flex items-center gap-1.5 border transition-all"
        >
          <Shield size={13} /> Sentinel Brain
        </Link>
        <Link
          to="/app/executor"
          activeProps={{ className: "bg-primary/20 text-primary border-primary/40 font-bold" }}
          inactiveProps={{ className: "bg-secondary/40 text-muted-foreground hover:text-foreground border-border/50" }}
          className="h-8 px-3 rounded-md text-xs uppercase tracking-wider flex items-center gap-1.5 border transition-all"
        >
          <Zap size={13} className="text-amber-400" /> Executor
        </Link>
      </nav>

      <div className="flex items-center gap-2 ml-2">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border/60 bg-secondary/40 text-[11px] text-muted-foreground">
          {s.status === "live" ? <Wifi size={12} className="text-[var(--bull)] pulse-dot" /> : s.status === "connecting" ? <Radio size={12} className="text-[var(--accent)] pulse-dot" /> : <WifiOff size={12} className="text-[var(--bear)]" />}
          {s.status.toUpperCase()}
        </div>
        <select value={s.symbol} onChange={(e) => { s.setSymbol(e.target.value); s.setRunning(true); }} className="h-8 px-2 rounded-md bg-secondary/40 border border-border/60 text-[11px] text-foreground focus:outline-none">
          {s.symbols.map((sym) => <option key={sym.symbol} value={sym.symbol}>{sym.name}</option>)}
        </select>
        <button onClick={() => s.setRunning(!s.running)} className="h-8 px-3 rounded-md bg-secondary hover:bg-secondary/70 border border-border/60 text-xs flex items-center gap-1.5">
          {s.running ? <><Pause size={12} /> Pause</> : <><Play size={12} /> Resume</>}
        </button>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <AlertSoundToggle />
        {account ? (
          <div className="flex items-center gap-2 h-8 px-3 rounded-md border border-border/60 bg-secondary/30 text-[11px]">
            <Wallet size={12} className={derivStatus === "open" ? "text-[var(--bull)]" : "text-muted-foreground"} />
            <span className="tabular text-foreground">{balance !== null ? balance.toFixed(2) : "—"} {currency ?? ""}</span>
            <span className="text-muted-foreground">· {account.loginid}</span>
            {account.is_virtual && <span className="text-[9px] text-[var(--accent)] uppercase tracking-widest">Demo</span>}
          </div>
        ) : (
          <div className="h-8 px-3 rounded-md bg-secondary/40 border border-border/60 text-muted-foreground text-[11px] flex items-center gap-1.5">
            <Wallet size={12} /> Not connected
          </div>
        )}
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground hidden md:block">{s.ticks.length} ticks</div>
      </div>
    </header>
  );
}
