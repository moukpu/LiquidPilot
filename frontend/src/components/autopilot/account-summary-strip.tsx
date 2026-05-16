"use client";

import type { Account } from "@/types/api";
import { formatMoney } from "@/lib/format";
import { useLocale, localeToIntl } from "@/i18n/locale-context";

export interface AccountSummaryStripProps {
  accounts: Account[];
}

export default function AccountSummaryStrip({ accounts }: AccountSummaryStripProps) {
  const { t, locale } = useLocale();
  const intl = localeToIntl(locale);
  return (
    <div className="shrink-0 border-b border-border bg-background/40 px-6 py-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {accounts.length === 0 &&
          [0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-lg border border-border bg-card/50 p-3 h-[72px] animate-pulse"
            />
          ))}
        {accounts.map((acc) => {
          const headroom = acc.current_ledger_balance - acc.min_balance;
          const breach = acc.current_ledger_balance < acc.min_balance + acc.alert_buffer;
          return (
            <div
              key={acc.account_id}
              className="rounded-lg border border-border bg-card/60 p-3 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-wider text-primary truncate">
                  {acc.account_id}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {acc.currency} · {acc.country}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono font-semibold tabular-nums text-base leading-tight">
                  {formatMoney(acc.current_ledger_balance, acc.currency, {
                    fractionDigits: 0,
                  }, intl)}
                </div>
                <div
                  className={`text-[10px] font-mono ${
                    breach
                      ? "text-amber-400"
                      : headroom >= 0
                        ? "text-emerald-400"
                        : "text-rose-400"
                  }`}
                >
                  {(() => {
                    const amountStr = `${headroom >= 0 ? "+" : ""}${formatMoney(headroom, acc.currency, { fractionDigits: 0 }, intl)}`;
                    if (breach) return t("account.bufferBreach");
                    return headroom >= 0
                      ? t("account.aboveFloor", { amount: amountStr })
                      : t("account.belowFloor", { amount: amountStr });
                  })()}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
