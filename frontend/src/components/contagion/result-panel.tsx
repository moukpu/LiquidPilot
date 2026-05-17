"use client";

import { useLocale, localeToIntl } from "@/i18n/locale-context";
import { displayAccountLabel, formatMoneyCompact, formatLoss } from "@/lib/format";
import type { CascadeResult } from "@/types/api";

interface Props {
  result: CascadeResult | null;
  error: string | null;
}

export default function ResultPanel({ result, error }: Props) {
  const { t, locale } = useLocale();
  const intl = localeToIntl(locale);

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-5 border-b border-slate-100 shrink-0">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          Impact Analysis
        </h2>
      </div>

      {error ? (
        <div className="p-5 text-sm text-rose-600 font-mono bg-rose-50/50 flex-1">
          {error}
        </div>
      ) : !result || result.affected.length === 0 ? (
        <div className="p-5 text-sm text-slate-400 flex-1 flex items-center justify-center text-center px-8 leading-relaxed">
          Run a cascade simulation to see the downstream impact.
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {result.affected.map((hop) => (
            <div
              key={hop.account_id}
              className={`p-3 rounded-xl flex items-center justify-between border ${
                hop.breached
                  ? "bg-rose-50/30 border-rose-100"
                  : "bg-white border-transparent hover:border-slate-100 hover:bg-slate-50/50"
              } transition-colors`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black tracking-tighter ${
                    hop.breached
                      ? "bg-rose-100 text-rose-600"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  H{hop.hops_from_shock}
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">
                    {displayAccountLabel(hop.account_id)}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                    Floor: ${formatMoneyCompact(hop.min_balance_usd, intl)}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div
                  className={`text-sm font-bold tabular-nums ${
                    hop.incoming_loss_usd > 0
                      ? "text-rose-600"
                      : "text-slate-900"
                  }`}
                >
                  {formatLoss(hop.incoming_loss_usd, intl)}
                </div>
                <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                  Post: ${formatMoneyCompact(hop.post_shock_balance_usd, intl)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
