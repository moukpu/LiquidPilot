"use client";

import { useMemo } from "react";
import { localeToIntl, useLocale } from "@/i18n/locale-context";
import { formatMoney } from "@/lib/format";
import type { Alert, TransferSuggestion } from "@/types/api";
import { transferKey } from "@/lib/autopilot-synth";
import type { ExecutedMeta } from "@/hooks/use-autopilot-state";

interface Props {
  transfers: TransferSuggestion[];
  alerts: Alert[];
  actionStates: Record<string, ExecutedMeta>;
}

// Static FX snapshot for aggregating "moved" totals into a single USD figure.
// Matches the backend's FX_RATES_TO_USD so the two surfaces agree.
const FX_TO_USD: Record<string, number> = {
  EUR: 1.08,
  USD: 1.0,
  GBP: 1.27,
  CHF: 1.1,
  JPY: 0.0067,
  SGD: 0.74,
  KZT: 0.0022,
};

export default function SessionSummary({
  transfers,
  alerts,
  actionStates,
}: Props) {
  const { t, locale } = useLocale();
  const intl = localeToIntl(locale);

  const stats = useMemo(() => {
    let acceptedCount = 0;
    let movedUsd = 0;
    for (const tr of transfers) {
      const meta = actionStates[transferKey(tr)];
      if (meta?.state === "executed") {
        acceptedCount += 1;
        movedUsd += tr.amount * (FX_TO_USD[tr.currency_from] ?? 1.0);
      }
    }
    // "Open alerts" = alerts whose paired transfer (by destination account)
    // has not yet been executed or skipped. Alerts without any paired
    // transfer also count as open.
    const remaining = alerts.filter((a) => {
      const tr = transfers.find((x) => x.to_account === a.account_id);
      if (!tr) return true;
      const meta = actionStates[transferKey(tr)];
      return !meta || (meta.state !== "executed" && meta.state !== "skipped");
    }).length;
    return { acceptedCount, movedUsd, remaining };
  }, [transfers, alerts, actionStates]);

  return (
    <div className="glass-card rounded-full px-8 py-3 flex items-center gap-8 shadow-2xl shadow-slate-200/50">
      <div className="flex items-center gap-3">
        <span className="text-slate-500 uppercase tracking-widest text-[10px] font-bold">
          {t("autopilot.session.accepted")}
        </span>
        <span className="font-display font-bold text-lg text-emerald-600">
          {stats.acceptedCount}
        </span>
      </div>
      <div className="w-px h-6 bg-slate-200" />
      <div className="flex items-center gap-3">
        <span className="text-slate-500 uppercase tracking-widest text-[10px] font-bold">
          {t("autopilot.session.moved")}
        </span>
        <span className="font-display font-bold text-xl text-slate-800 tabular-nums">
          {formatMoney(stats.movedUsd, "USD", { fractionDigits: 0 }, intl)}
        </span>
      </div>
      <div className="w-px h-6 bg-slate-200" />
      <div className="flex items-center gap-3">
        <span className="text-slate-500 uppercase tracking-widest text-[10px] font-bold">
          {t("autopilot.session.remaining")}
        </span>
        <span
          className={`font-display font-bold text-lg ${
            stats.remaining > 0 ? "text-amber-500" : "text-emerald-500"
          }`}
        >
          {stats.remaining}
        </span>
      </div>
    </div>
  );
}
