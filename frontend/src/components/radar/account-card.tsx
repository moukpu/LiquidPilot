"use client";

import type { Account, Transaction } from "@/types/api";
import { useLocale, localeToIntl } from "@/i18n/locale-context";
import {
  currencySymbol,
  displayAccountLabel,
  formatMoneyCompact,
} from "@/lib/format";

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
  const inFlightSum = related.reduce((s, tx) => s + Math.abs(tx.amount), 0);

  const aboveFloor = account.current_ledger_balance - account.min_balance;
  const bufferBreach =
    account.current_ledger_balance < account.min_balance + account.alert_buffer;

  return (
    <div className="rounded-2xl glass-card p-5 space-y-4 hover:border-primary/40 transition-colors duration-300 relative overflow-hidden group shrink-0">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      <div className="relative z-10 flex items-start justify-between">
        <div>
          <div className="font-mono text-sm font-semibold uppercase tracking-widest text-primary">
            {displayAccountLabel(account.account_id)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {account.currency} · {account.country}
          </div>
        </div>
        {bufferBreach && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
            {t("account.bufferBreach")}
          </span>
        )}
      </div>

      <div className="relative z-10">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70 mb-1">
          {t("account.ledgerBalance")}
        </div>
        {/* Compact-format the balance so even KZT/JPY billions fit a 220-px
            column. Down from text-3xl → text-2xl: the previous size used
            to overflow on Almaty's ₸2.5B ledger and snip the trailing
            digits behind the chip on the right. */}
        <div className="text-2xl font-mono font-bold tabular-nums text-foreground tracking-tight">
          {sym}
          {formatMoneyCompact(account.current_ledger_balance, intl)}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-mono">
          <span
            className={`px-2 py-0.5 rounded-full ${
              aboveFloor >= 0
                ? "bg-emerald-100 text-emerald-700"
                : "bg-rose-100 text-rose-700"
            }`}
          >
            {aboveFloor >= 0 ? "+" : "−"}
            {sym}
            {formatMoneyCompact(Math.abs(aboveFloor), intl)} {t("account.vsFloor")}
          </span>
        </div>
      </div>

      <div className="relative z-10 grid grid-cols-2 gap-4 pt-4 border-t border-slate-200/50">
        <div>
          <div className="text-[10px] font-mono tracking-widest uppercase text-emerald-400/80 mb-1">
            {t("account.in")}
          </div>
          <div className="font-mono text-sm font-bold tabular-nums text-emerald-500">
            +{sym}
            {formatMoneyCompact(inSum, intl)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {t("account.txCount", { n: inTx.length })}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-mono tracking-widest uppercase text-rose-400/80 mb-1">
            {t("account.out")}
          </div>
          <div className="font-mono text-sm font-bold tabular-nums text-rose-500">
            -{sym}
            {formatMoneyCompact(outSum, intl)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {t("account.txCount", { n: outTx.length })}
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <div className="relative z-10 pt-2 border-t border-slate-200/50 flex items-center justify-between gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70">
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            {t("account.inTransit.count", { n: related.length })}
          </span>
          <span className="tabular-nums">
            {sym}
            {formatMoneyCompact(inFlightSum, intl)}
          </span>
        </div>
      )}
    </div>
  );
}
