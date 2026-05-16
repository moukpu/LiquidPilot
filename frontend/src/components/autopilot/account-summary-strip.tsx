"use client";

import type { Account, Alert } from "@/types/api";
import { useT } from "@/i18n/locale-context";
import { displayAccountLabel } from "@/lib/format";

export interface AccountSummaryStripProps {
  accounts: Account[];
  alerts: Alert[];
}

type Status = "red" | "amber" | "green";

function statusFor(accountId: string, alerts: Alert[]): Status {
  let worst: Status = "green";
  for (const a of alerts) {
    if (a.account_id !== accountId) continue;
    if (a.severity === "CRITICAL") return "red";
    if (a.severity === "WARNING" && worst === "green") worst = "amber";
  }
  return worst;
}

const DOT_CLASS: Record<Status, string> = {
  red: "bg-rose-500",
  amber: "bg-amber-500",
  green: "bg-emerald-500",
};

// Drop shadow + brighter dot core lifts each status indicator off the
// pill background. Without this the emerald-500 dot blends into the
// pale card-background of the pill on the light theme.
const DOT_SHADOW = "shadow-[0_0_4px_currentColor]";

export default function AccountSummaryStrip({
  accounts,
  alerts,
}: AccountSummaryStripProps) {
  const t = useT();
  return (
    <div className="px-6 py-2 shrink-0 border-b border-border flex items-center gap-3 flex-wrap">
      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        {t("autopilot.summary.label")}
      </span>
      {accounts.length === 0
        ? [0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-6 w-32 rounded-full border border-border bg-card/30 animate-pulse"
            />
          ))
        : accounts.map((a) => {
            const s = statusFor(a.account_id, alerts);
            return (
              <div
                key={a.account_id}
                className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-card border border-border shadow-sm"
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full ${DOT_CLASS[s]} ${DOT_SHADOW}`}
                />
                <span className="font-mono text-xs">
                  {displayAccountLabel(a.account_id)}
                </span>
              </div>
            );
          })}
    </div>
  );
}
