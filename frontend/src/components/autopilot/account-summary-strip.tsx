"use client";

import type { Account, Alert, TransferSuggestion } from "@/types/api";
import { useT } from "@/i18n/locale-context";
import { displayAccountLabel } from "@/lib/format";
import { transferKey } from "@/lib/autopilot-synth";
import type { ExecutedMeta } from "@/hooks/use-autopilot-state";

export interface AccountSummaryStripProps {
  accounts: Account[];
  alerts: Alert[];
  transfers: TransferSuggestion[];
  actionStates: Record<string, ExecutedMeta>;
}

type Status = "red" | "amber" | "green";

// Only ACTIVE alerts color the dot. An alert is active when its paired
// transfer (matched by recipient account) hasn't been executed or
// skipped. Without this filter the dot stays red forever after the
// treasurer has already handled the situation.
function statusFor(
  accountId: string,
  alerts: Alert[],
  transfers: TransferSuggestion[],
  actionStates: Record<string, ExecutedMeta>
): Status {
  let worst: Status = "green";
  for (const a of alerts) {
    if (a.account_id !== accountId) continue;
    const tr = transfers.find((t) => t.to_account === a.account_id);
    if (tr) {
      const meta = actionStates[transferKey(tr)];
      const state = meta?.state ?? "queued";
      if (state === "executed" || state === "skipped") continue;
    }
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
  transfers,
  actionStates,
}: AccountSummaryStripProps) {
  const t = useT();
  return (
    <div className="px-8 py-3 shrink-0 glass border-x-0 border-t-0 flex items-center gap-4 flex-wrap z-10 shadow-sm/50">
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
        {t("autopilot.summary.label")}
      </span>
      {accounts.length === 0
        ? [0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-7 w-32 rounded-full border border-slate-200/60 bg-white/40 animate-pulse"
            />
          ))
        : accounts.map((a) => {
            const s = statusFor(a.account_id, alerts, transfers, actionStates);
            return (
              <div
                key={a.account_id}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white/70 backdrop-blur-md border border-slate-200/80 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-default"
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full ${DOT_CLASS[s]} ${DOT_SHADOW} ${s !== 'green' ? 'animate-pulse' : ''}`}
                />
                <span className="font-mono text-xs font-medium text-slate-700">
                  {displayAccountLabel(a.account_id)}
                </span>
              </div>
            );
          })}
    </div>
  );
}
