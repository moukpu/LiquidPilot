import type { Account, Alert, TransferSuggestion } from "@/types/api";

const inDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export function synthAlerts(accounts: Account[]): Alert[] {
  if (accounts.length < 2) return [];
  const sorted = [...accounts].sort(
    (a, b) => a.current_ledger_balance - b.current_ledger_balance
  );
  const a1 = sorted[0];
  const a2 = sorted[1];
  return [
    {
      severity: "CRITICAL",
      account_id: a1.account_id,
      currency: a1.currency,
      breach_date: inDays(3),
      projected_balance: a1.min_balance - 250000,
      min_balance: a1.min_balance,
      shortfall: 250000,
      days_until_breach: 3,
      message: `Projected breach of minimum balance on ${inDays(3)}: ${a1.account_id} forecast falls 250,000 ${a1.currency} below floor.`,
    },
    {
      severity: "WARNING",
      account_id: a2.account_id,
      currency: a2.currency,
      breach_date: inDays(6),
      projected_balance: a2.min_balance + a2.alert_buffer * 0.3,
      min_balance: a2.min_balance,
      shortfall: a2.alert_buffer * 0.7,
      days_until_breach: 6,
      message: `${a2.account_id} forecast enters alert buffer on ${inDays(6)} — re-fund within 4 business days.`,
    },
  ];
}

export function synthTransfers(accounts: Account[]): TransferSuggestion[] {
  if (accounts.length < 3) return [];
  const sorted = [...accounts].sort(
    (a, b) => b.current_ledger_balance - a.current_ledger_balance
  );
  const donor = sorted[0];
  const r1 = sorted[1];
  const r2 = sorted[2];
  const requiresFx1 = donor.currency !== r1.currency;
  const requiresFx2 = donor.currency !== r2.currency;
  return [
    {
      from_account: donor.account_id,
      to_account: r1.account_id,
      amount: 750000,
      currency_from: donor.currency,
      currency_to: r1.currency,
      rail: requiresFx1 ? "SWIFT" : "SEPA",
      initiate_by: inDays(2),
      rationale: `Pre-fund ${r1.account_id} ahead of forecasted breach on ${inDays(3)}.`,
      requires_fx: requiresFx1,
      notes: requiresFx1
        ? [`FX leg ${donor.currency}→${r1.currency} adds T+1 settlement risk.`]
        : [],
    },
    {
      from_account: donor.account_id,
      to_account: r2.account_id,
      amount: 350000,
      currency_from: donor.currency,
      currency_to: r2.currency,
      rail: requiresFx2 ? "SWIFT" : "INTERNAL",
      initiate_by: inDays(5),
      rationale: `Top up ${r2.account_id} buffer before alert window closes on ${inDays(6)}.`,
      requires_fx: requiresFx2,
      notes: [],
    },
  ];
}

export function transferKey(t: TransferSuggestion): string {
  return `${t.from_account}>${t.to_account}|${t.amount}|${t.currency_from}|${t.currency_to}|${t.rail}|${t.initiate_by ?? ""}`;
}
