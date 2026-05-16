"use client";

import type { Account, Transaction } from "@/types/api";
import { useLocale, localeToIntl } from "@/i18n/locale-context";
import { currencySymbol, formatNumber } from "@/lib/format";

interface AccountCardProps {
  account: Account;
  transactions: Transaction[];
}

export default function AccountCard({ account, transactions }: AccountCardProps) {
  const { t, locale } = useLocale();
  const intl = localeToIntl(locale);
  const sym = currencySymbol(account.currency);

  const related = transactions.filter((tx) => tx.account_id === account.account_id);
  const inTx = related.filter((tx) => tx.direction === "IN");
  const outTx = related.filter((tx) => tx.direction === "OUT");
  const inSum = inTx.reduce((s, tx) => s + tx.amount, 0);
  const outSum = outTx.reduce((s, tx) => s + tx.amount, 0);

  const pctOfOpening = account.opening_balance
    ? ((account.current_ledger_balance / account.opening_balance) * 100).toFixed(1)
    : "0.0";

  const aboveFloor = account.current_ledger_balance - account.min_balance;
  const bufferBreach = account.current_ledger_balance < account.min_balance + account.alert_buffer;
  const headroomAmount = `${sym}${formatNumber(Math.abs(aboveFloor), 2, intl)}`;
  const headroomText =
    aboveFloor >= 0
      ? t("account.aboveFloor", { amount: headroomAmount })
      : t("account.belowFloor", { amount: headroomAmount });

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-mono text-xs font-semibold uppercase tracking-wide text-primary">
            {account.account_id}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {account.currency}·{account.country}
          </div>
        </div>
        {bufferBreach && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/25">
            {t("account.bufferBreach")}
          </span>
        )}
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
          {t("account.ledgerBalance")}
        </div>
        <div className="text-2xl font-mono font-bold tabular-nums text-foreground">
          {sym}
          {formatNumber(account.current_ledger_balance, 2, intl)}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {t("account.percentOfOpening", { percent: pctOfOpening })} ·{" "}
          <span className={aboveFloor < 0 ? "text-rose-400" : "text-emerald-400"}>
            {headroomText}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
        <div>
          <div className="text-[10px] uppercase text-emerald-400 mb-0.5">{t("account.in")}</div>
          <div className="font-mono text-sm font-semibold tabular-nums">
            +{sym}
            {formatNumber(inSum, 2, intl)}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {t("account.txCount", { n: inTx.length })}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-rose-400 mb-0.5">{t("account.out")}</div>
          <div className="font-mono text-sm font-semibold tabular-nums">
            -{sym}
            {formatNumber(outSum, 2, intl)}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {t("account.txCount", { n: outTx.length })}
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <div className="text-[10px] text-muted-foreground pt-1">
          {t("account.inTransit", { amount: related.length })}
        </div>
      )}
    </div>
  );
}
