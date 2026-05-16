"use client";

import { useLocale, localeToIntl } from "@/i18n/locale-context";
import { formatNumber } from "@/lib/format";

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
        {Object.entries(perAccount).map(([id, amount]) => {
          const ccy = accountCurrencies[id] ?? "USD";
          return (
            <div key={id} className="flex justify-between items-center gap-3">
              <span className="text-foreground/80 truncate min-w-0">{id}</span>
              <span className="font-semibold text-foreground tabular-nums">
                {ccy} {formatNumber(amount, 0, intl)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 pt-3 border-t border-slate-200/50 text-[10px] text-muted-foreground leading-relaxed">
        {t("radar.frozen.hint")}
      </div>
    </div>
  );
}
