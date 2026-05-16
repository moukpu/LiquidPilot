"use client";

import type { Account, Transaction } from "@/types/api";

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: "\u20AC",
  USD: "\u0024",
  GBP: "\u00A3",
};

interface AccountCardProps {
  account: Account;
  transactions: Transaction[];
}

export default function AccountCard({ account, transactions }: AccountCardProps) {
  const sym = CURRENCY_SYMBOLS[account.currency] || account.currency;

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
            Buffer breach
          </span>
        )}
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
          Ledger balance
        </div>
        <div className="text-2xl font-mono font-bold tabular-nums text-foreground">
          {sym}
          {account.current_ledger_balance.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {pctOfOpening}% of opening ·{" "}
          <span className={aboveFloor < 0 ? "text-rose-400" : "text-emerald-400"}>
            {Math.abs(aboveFloor).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>{" "}
          {aboveFloor >= 0 ? "above" : "below"} floor
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
        <div>
          <div className="text-[10px] uppercase text-emerald-400 mb-0.5">In</div>
          <div className="font-mono text-sm font-semibold tabular-nums">
            +{sym}
            {inSum.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-muted-foreground">{inTx.length} tx</div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-rose-400 mb-0.5">Out</div>
          <div className="font-mono text-sm font-semibold tabular-nums">
            -{sym}
            {outSum.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-muted-foreground">{outTx.length} tx</div>
        </div>
      </div>

      {related.length > 0 && (
        <div className="text-[10px] text-muted-foreground pt-1">
          {related.length} in-transit
        </div>
      )}
    </div>
  );
}
