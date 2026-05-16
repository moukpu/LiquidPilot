import type { Account, Alert, TransferSuggestion } from "@/types/api";
import { FX_TO_USD, convertFx } from "@/lib/fx";

const inDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

function balanceUsd(acc: Account): number {
  return acc.current_ledger_balance * (FX_TO_USD[acc.currency] ?? 1);
}

export function synthAlerts(accounts: Account[]): Alert[] {
  if (accounts.length < 2) return [];
  const sorted = [...accounts].sort(
    (a, b) => balanceUsd(a) - balanceUsd(b)
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
  const alerts = synthAlerts(accounts);
  if (alerts.length === 0) return [];

  const recipientIds = new Set(alerts.map((a) => a.account_id));
  const recipients = alerts.map(
    (a) => accounts.find((acc) => acc.account_id === a.account_id)!
  );

  const eligibleDonors = accounts.filter(
    (acc) => !recipientIds.has(acc.account_id)
  );
  if (eligibleDonors.length === 0) return [];

  const donor = eligibleDonors.reduce((best, acc) => {
    const bestExcess =
      balanceUsd(best) - best.min_balance * (FX_TO_USD[best.currency] ?? 1);
    const accExcess =
      balanceUsd(acc) - acc.min_balance * (FX_TO_USD[acc.currency] ?? 1);
    return accExcess > bestExcess ? acc : best;
  });

  return recipients.map((recipient, i) => {
    const alert = alerts[i];
    const amount = convertFx(
      alert.shortfall * 1.2,
      recipient.currency,
      donor.currency
    );
    const requiresFx = donor.currency !== recipient.currency;
    return {
      from_account: donor.account_id,
      to_account: recipient.account_id,
      amount: Math.round(amount),
      currency_from: donor.currency,
      currency_to: recipient.currency,
      rail: requiresFx ? "SWIFT" : "SEPA",
      initiate_by: inDays(Math.max(1, alert.days_until_breach - 1)),
      rationale: `Pre-fund ${recipient.account_id} ahead of ${alert.breach_date} breach — covers shortfall ${alert.shortfall} ${recipient.currency}.`,
      requires_fx: requiresFx,
      notes: requiresFx
        ? [`FX leg ${donor.currency}→${recipient.currency} adds T+1 settlement risk.`]
        : [],
    };
  });
}

export function transferKey(t: TransferSuggestion): string {
  return `${t.from_account}>${t.to_account}|${t.amount}|${t.currency_from}|${t.currency_to}|${t.rail}|${t.initiate_by ?? ""}`;
}
