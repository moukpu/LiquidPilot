"use client";

import { useState } from "react";
import { useLocale, localeToIntl } from "@/i18n/locale-context";
import { displayAccountLabel, formatMoneyCompact, formatLoss } from "@/lib/format";
import type { CascadeResult, CascadeHop } from "@/types/api";

interface Props {
  result: CascadeResult | null;
  error: string | null;
}

export default function ResultPanel({ result, error }: Props) {
  const { t, locale } = useLocale();
  const intl = localeToIntl(locale);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (accountId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
  };

  if (error) {
    return (
      <div className="glass-card rounded-2xl p-4 space-y-2 h-full">
        <h2 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          {t("contagion.result.title")}
        </h2>
        <p className="text-xs text-rose-700 font-mono leading-relaxed">
          {error}
        </p>
      </div>
    );
  }

  if (!result || result.affected.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-4 space-y-2 h-full">
        <h2 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          {t("contagion.result.title")}
        </h2>
        <p className="text-sm font-mono text-muted-foreground leading-relaxed">
          {t("contagion.result.empty")}
        </p>
      </div>
    );
  }

  // Group by hops
  const hopsObj = result.affected.reduce((acc, hop) => {
    const k = hop.hops_from_shock;
    if (!acc[k]) acc[k] = [];
    acc[k].push(hop);
    return acc;
  }, {} as Record<number, CascadeHop[]>);

  const hopKeys = Object.keys(hopsObj)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="glass-card rounded-2xl p-4 flex flex-col h-full max-h-[600px]">
      <h2 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-4 shrink-0">
        {t("contagion.result.title")}
      </h2>

      <div className="space-y-4 overflow-y-auto pr-2 flex-1">
        {hopKeys.map((hopNum) => {
          const hops = hopsObj[hopNum];
          return (
            <div key={hopNum} className="space-y-2">
              <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 border-b border-slate-200 pb-1">
                {t("contagion.result.hopGroup", { n: hopNum, count: hops.length })}
              </h3>
              <div className="space-y-1.5">
                {hops.map((hop) => {
                  const isExpanded = expanded.has(hop.account_id);
                  const isBreached = hop.breached;
                  return (
                    <div
                      key={hop.account_id}
                      className={`rounded-lg border overflow-hidden transition-colors ${
                        isBreached
                          ? "bg-rose-50 border-rose-200"
                          : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleExpand(hop.account_id)}
                        className="w-full text-left px-3 py-2 flex items-center justify-between hover:bg-black/5"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-1 h-3 rounded-full ${
                              isBreached ? "bg-rose-500" : "bg-slate-400"
                            }`}
                          />
                          <span className="font-mono text-sm font-semibold">
                            {displayAccountLabel(hop.account_id)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`text-xs font-mono font-bold tabular-nums ${
                              hop.incoming_loss_usd > 0
                                ? "text-rose-600"
                                : "text-slate-500"
                            }`}
                          >
                            {formatLoss(hop.incoming_loss_usd, intl)}
                          </span>
                          <span
                            className={`text-slate-400 text-[10px] transition-transform ${
                              isExpanded ? "rotate-90" : ""
                            }`}
                          >
                            ▶
                          </span>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-3 pb-3 pt-1 text-[10px] font-mono border-t border-black/5">
                          <div className="grid grid-cols-2 gap-2 mb-2">
                            <div>
                              <div className="text-muted-foreground uppercase tracking-widest text-[8px] mb-0.5">
                                {t("contagion.result.postBalance")}
                              </div>
                              <div
                                className={`font-semibold tabular-nums ${
                                  isBreached ? "text-rose-600" : "text-foreground"
                                }`}
                              >
                                ${formatMoneyCompact(hop.post_shock_balance_usd, intl)}
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground uppercase tracking-widest text-[8px] mb-0.5">
                                {t("contagion.result.minBalance")}
                              </div>
                              <div className="font-semibold tabular-nums text-foreground">
                                ${formatMoneyCompact(hop.min_balance_usd, intl)}
                              </div>
                            </div>
                          </div>
                          {hop.contributors.length > 0 && (
                            <div className="text-slate-500">
                              <span className="uppercase tracking-widest text-[8px] mr-1">
                                {t("contagion.result.via")}
                              </span>
                              {hop.contributors.map(displayAccountLabel).join(", ")}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
