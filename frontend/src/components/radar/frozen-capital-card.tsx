"use client";

import { useLocale, localeToIntl } from "@/i18n/locale-context";
import { displayAccountLabel, formatMoneyCompact, formatNumber } from "@/lib/format";

interface Props {
  totalUsd: number;
  perAccount: Record<string, number>;
  accountCurrencies: Record<string, string>;
  totalBalanceUsd: number;
}

export default function FrozenCapitalCard({
  totalUsd,
  perAccount,
  accountCurrencies,
  totalBalanceUsd,
}: Props) {
  const { t, locale } = useLocale();
  const intl = localeToIntl(locale);
  const pct = totalBalanceUsd > 0 ? (totalUsd / totalBalanceUsd) * 100 : 0;

  // Filter out accounts whose idle (frozen) capital is exactly zero.
  // JPY/SGD often sit right at their safety buffer with no surplus, so
  // showing `JPY 0` looks broken — skip them. If literally every row is
  // zero the empty-state hint takes over.
  const idleRows = Object.entries(perAccount).filter(([, amount]) => amount > 0);
  const allDeployed = idleRows.length === 0;

  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
        {t("radar.frozen.title")}
      </div>
      <div className="text-2xl font-bold text-foreground tabular-nums">
        ${formatNumber(totalUsd, 0, intl)}
      </div>
      <div className="text-xs text-muted-foreground mb-3">
        ~{pct.toFixed(0)}% {t("radar.frozen.ofTotal")}
      </div>
      <div className="space-y-1.5 font-mono text-xs border-t border-slate-200/50 pt-3">
        {allDeployed ? (
          <div className="text-[10px] text-muted-foreground italic leading-relaxed">
            {t("radar.frozen.allDeployed")}
          </div>
        ) : (
          idleRows.map(([id, amount]) => {
            const ccy = accountCurrencies[id] ?? "USD";
            return (
              <div key={id} className="flex justify-between items-center gap-3">
                <span className="text-foreground/80 truncate min-w-0">
                  {displayAccountLabel(id)}
                </span>
                <span className="font-semibold text-foreground tabular-nums">
                  {ccy} {formatMoneyCompact(amount, intl)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
