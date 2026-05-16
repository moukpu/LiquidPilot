"use client";

import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { Alert, TransferSuggestion } from "@/types/api";

interface AlertsPanelProps {
  alerts: Alert[];
  transfers: TransferSuggestion[];
}

function severityIcon(severity: string) {
  switch (severity) {
    case "CRITICAL":
      return <AlertTriangle className="w-4 h-4 text-rose-400" />;
    case "WARNING":
      return <AlertTriangle className="w-4 h-4 text-amber-400" />;
    default:
      return <Info className="w-4 h-4 text-primary" />;
  }
}

function severityBadgeClass(severity: string): string {
  switch (severity) {
    case "CRITICAL":
      return "bg-rose-500/15 text-rose-400 border-rose-500/25";
    case "WARNING":
      return "bg-amber-500/15 text-amber-400 border-amber-500/25";
    default:
      return "bg-primary/15 text-primary border-primary/25";
  }
}

export default function AlertsPanel({ alerts, transfers }: AlertsPanelProps) {
  const empty = alerts.length === 0 && transfers.length === 0;

  if (empty) {
    return (
      <div className="rounded-lg border border-border bg-card p-5 flex items-center gap-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
        <div>
          <div className="text-sm font-medium">All clear</div>
          <div className="text-xs text-muted-foreground">No alerts or suggested transfers.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert, idx) => (
        <div
          key={`alert-${idx}`}
          className={`rounded-lg border p-3 flex items-start gap-3 ${severityBadgeClass(alert.severity)}`}
        >
          {severityIcon(alert.severity)}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider">{alert.severity}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{alert.account_id}</span>
              <span className="font-mono text-[10px] text-muted-foreground">· {alert.breach_date}</span>
              <span className="font-mono text-[10px] text-muted-foreground">· in {alert.days_until_breach}d</span>
            </div>
            <p className="text-xs mt-1 leading-relaxed">{alert.message}</p>
            <div className="text-[10px] font-mono text-muted-foreground mt-1">
              Shortfall {alert.shortfall.toLocaleString("en-US", { maximumFractionDigits: 0 })} {alert.currency}
              {" · "}
              Projected {alert.projected_balance.toLocaleString("en-US", { maximumFractionDigits: 0 })} vs floor {alert.min_balance.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>
      ))}

      {transfers.map((tx, idx) => (
        <div
          key={`tx-${idx}`}
          className="rounded-lg border border-border bg-card p-3 space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Suggested transfer</span>
            <span className="text-[10px] font-mono text-primary">
              {tx.currency_from}→{tx.currency_to}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="font-mono font-medium">{tx.from_account}</span>
            <span className="text-muted-foreground">→</span>
            <span className="font-mono font-medium">{tx.to_account}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{tx.rail}</span>
            <span className="font-mono text-foreground">{tx.amount.toLocaleString()}</span>
          </div>
          <div className="text-[10px] text-muted-foreground">
            Initiate by {tx.initiate_by ?? "ASAP"}
          </div>
          {tx.notes.length > 0 && (
            <div className="text-[10px] text-amber-400/80 leading-snug">
              {tx.notes.join(" ")}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
