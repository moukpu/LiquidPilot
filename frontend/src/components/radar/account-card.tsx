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
    <div className="rounded-2xl glass-card p-5 space-y-4 hover:border-primary/40 transition-colors duration-300 relative overflow-hidden group shrink-0">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      
      <div className="relative z-10 flex items-start justify-between">
        <div>
          <div className="font-mono text-sm font-semibold uppercase tracking-widest text-primary text-glow">
            {account.account_id}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {account.currency} · {account.country}
          </div>
        </div>
        {bufferBreach && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.3)]">
            {t("account.bufferBreach")}
          </span>
        )}
      </div>

      <div className="relative z-10">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70 mb-1">
          {t("account.ledgerBalance")}
        </div>
        <div className="text-3xl font-mono font-bold tabular-nums text-white text-glow">
          {sym}
          {formatNumber(account.current_ledger_balance, 2, intl)}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {t("account.percentOfOpening", { percent: pctOfOpening })} ·{" "}
          <span className={aboveFloor < 0 ? "text-rose-400" : "text-emerald-400 font-medium"}>
            {headroomText}
          </span>
        </div>
      </div>

      <div className="relative z-10 grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
        <div>
          <div className="text-[10px] font-mono tracking-widest uppercase text-emerald-400/80 mb-1">{t("account.in")}</div>
          <div className="font-mono text-sm font-bold tabular-nums text-emerald-400">
            +{sym}
            {formatNumber(inSum, 2, intl)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {t("account.txCount", { n: inTx.length })}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-mono tracking-widest uppercase text-rose-400/80 mb-1">{t("account.out")}</div>
          <div className="font-mono text-sm font-bold tabular-nums text-rose-400">
            -{sym}
            {formatNumber(outSum, 2, intl)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {t("account.txCount", { n: outTx.length })}
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <div className="relative z-10 text-[10px] font-mono tracking-widest uppercase text-muted-foreground/70 pt-2 border-t border-white/5 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          {t("account.inTransit", { amount: related.length })}
        </div>
      )}
    </div>
  );
}
