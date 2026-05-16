"use client";

import { ShieldAlert, ShieldCheck, Info } from "lucide-react";
import type { Alert } from "@/types/api";
import { formatMoney } from "@/lib/format";

export interface AlertsDetailPanelProps {
  alerts: Alert[];
}

function severityClasses(s: Alert["severity"]) {
  switch (s) {
    case "CRITICAL":
      return {
        border: "border-rose-500/40",
        bg: "bg-rose-500/5",
        text: "text-rose-400",
        pill: "bg-rose-500/15 text-rose-400 border-rose-500/30",
      };
    case "WARNING":
      return {
        border: "border-amber-500/40",
        bg: "bg-amber-500/5",
        text: "text-amber-400",
        pill: "bg-amber-500/15 text-amber-400 border-amber-500/30",
      };
    default:
      return {
        border: "border-primary/40",
        bg: "bg-primary/5",
        text: "text-primary",
        pill: "bg-primary/15 text-primary border-primary/30",
      };
  }
}

function severityIcon(s: Alert["severity"]) {
  if (s === "CRITICAL") return <ShieldAlert className="w-4 h-4 text-rose-400" />;
  if (s === "WARNING") return <ShieldAlert className="w-4 h-4 text-amber-400" />;
  return <Info className="w-4 h-4 text-primary" />;
}

export default function AlertsDetailPanel({ alerts }: AlertsDetailPanelProps) {
  return (
    <section className="flex flex-col min-h-0 rounded-lg border border-border bg-card/30 overflow-hidden">
      <header className="h-10 shrink-0 px-4 flex items-center justify-between border-b border-border">
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary">
          Active alerts
        </span>
        <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
          {alerts.length} {alerts.length === 1 ? "alert" : "alerts"}
        </span>
      </header>

      <div className="flex-1 min-h-0 overflow-auto p-3 space-y-3">
        {alerts.length === 0 ? (
          <div className="rounded-lg border border-border bg-card/50 p-5 flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <div>
              <div className="text-sm font-medium">No active alerts</div>
              <div className="text-xs text-muted-foreground">
                Forecasted balances are above floor across all accounts.
              </div>
            </div>
          </div>
        ) : (
          alerts.map((alert, idx) => {
            const c = severityClasses(alert.severity);
            return (
              <article
                key={`alert-${idx}`}
                className={`rounded-lg border ${c.border} ${c.bg} p-3 flex items-start gap-3`}
              >
                {severityIcon(alert.severity)}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${c.pill}`}
                    >
                      {alert.severity}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {alert.account_id}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      · {alert.breach_date}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      · in {alert.days_until_breach}d
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-foreground/90">
                    {alert.message}
                  </p>
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/60">
                    <div>
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
                        Shortfall
                      </div>
                      <div className={`text-xs font-mono font-semibold tabular-nums ${c.text}`}>
                        {formatMoney(alert.shortfall, alert.currency, {
                          fractionDigits: 0,
                        })}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
                        Projected
                      </div>
                      <div className="text-xs font-mono tabular-nums">
                        {formatMoney(alert.projected_balance, alert.currency, {
                          fractionDigits: 0,
                        })}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
                        Floor
                      </div>
                      <div className="text-xs font-mono tabular-nums text-muted-foreground">
                        {formatMoney(alert.min_balance, alert.currency, {
                          fractionDigits: 0,
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
