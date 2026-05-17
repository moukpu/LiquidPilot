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

function pickWeighted<T>(items: Array<{ value: T; weight: number }>): T {
  const total = items.reduce((s, it) => s + it.weight, 0);
  let r = Math.random() * total;
  for (const it of items) {
    r -= it.weight;
    if (r <= 0) return it.value;
  }
  return items[items.length - 1].value;
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const SEVERITIES: Array<{ value: Alert["severity"]; weight: number }> = [
  { value: "CRITICAL", weight: 2 },
  { value: "WARNING", weight: 4 },
  { value: "INFO", weight: 2 },
];

// Rails realistic for same-currency intra-country transfers. Cross-currency
// always routes SWIFT (correspondent banking + FX leg). INTERNAL is the
// same-bank book transfer, available to any currency pair.
const RAIL_BY_CURRENCY: Record<string, readonly string[]> = {
  USD: ["ACH", "INTERNAL", "CARD", "SWIFT"],
  EUR: ["SEPA", "INTERNAL", "CARD"],
  GBP: ["SEPA", "INTERNAL", "CARD"],
  CHF: ["SEPA", "INTERNAL", "SWIFT"],
  JPY: ["SWIFT", "INTERNAL", "CARD"],
  SGD: ["SWIFT", "INTERNAL", "CARD"],
  KZT: ["SWIFT", "INTERNAL", "CARD"],
};

function pickRail(donorCurrency: string, requiresFx: boolean): string {
  if (requiresFx) return "SWIFT";
  const options = RAIL_BY_CURRENCY[donorCurrency] ?? ["INTERNAL", "SWIFT"];
  return pickRandom(options);
}

export interface Situation {
  alert: Alert;
  transfer: TransferSuggestion | null;
}

/** Generate one fresh demo situation. Returns null when not enough accounts
 *  exist to form a plausible alert. `excludeRecipientIds` keeps the new
 *  emission off of accounts that already have a pending situation, so the
 *  queue doesn't stack three CRITICALs on the same account. */
export function nextSituation(
  accounts: Account[],
  excludeRecipientIds: Set<string>
): Situation | null {
  if (accounts.length < 2) return null;

  const eligible = accounts.filter(
    (a) => !excludeRecipientIds.has(a.account_id)
  );
  const pool = eligible.length > 0 ? eligible : accounts;

  // Bias toward lower-balance accounts (they're the realistic candidates
  // for a breach). Pick from the bottom half of the pool with some jitter.
  const sorted = [...pool].sort((a, b) => balanceUsd(a) - balanceUsd(b));
  const half = Math.max(1, Math.ceil(sorted.length / 2));
  const recipient = sorted[Math.floor(Math.random() * half)];

  const severity = pickWeighted(SEVERITIES);

  const daysRange: Record<Alert["severity"], [number, number]> = {
    CRITICAL: [1, 3],
    WARNING: [3, 7],
    INFO: [5, 10],
  };
  const [lo, hi] = daysRange[severity];
  const days = lo + Math.floor(Math.random() * (hi - lo + 1));

  const shortfallBase = recipient.alert_buffer * (0.3 + Math.random() * 0.9);
  const shortfall = Math.max(1, Math.round(shortfallBase));

  const projected =
    severity === "CRITICAL"
      ? recipient.min_balance - shortfall
      : Math.round(
          recipient.min_balance + recipient.alert_buffer * Math.random() * 0.5
        );

  const alert: Alert = {
    severity,
    account_id: recipient.account_id,
    currency: recipient.currency,
    breach_date: inDays(days),
    projected_balance: projected,
    min_balance: recipient.min_balance,
    shortfall,
    days_until_breach: days,
    message:
      severity === "CRITICAL"
        ? `Projected breach of minimum balance on ${inDays(days)}: ${recipient.account_id} forecast falls ${shortfall} ${recipient.currency} below floor.`
        : severity === "WARNING"
        ? `${recipient.account_id} forecast enters alert buffer on ${inDays(days)} — re-fund within ${Math.max(1, days - 1)} business days.`
        : `${recipient.account_id} tracking near buffer in ${days} days — monitor, no action required yet.`,
  };

  // INFO-only situations have no paired transfer — the user just dismisses
  // them from the info-only stack in the queue.
  if (severity === "INFO") {
    return { alert, transfer: null };
  }

  // Pick the donor with the largest USD-equivalent surplus over its floor.
  const donors = accounts.filter((a) => a.account_id !== recipient.account_id);
  if (donors.length === 0) return { alert, transfer: null };
  const donor = donors.reduce((best, acc) => {
    const bestExcess =
      balanceUsd(best) - best.min_balance * (FX_TO_USD[best.currency] ?? 1);
    const accExcess =
      balanceUsd(acc) - acc.min_balance * (FX_TO_USD[acc.currency] ?? 1);
    return accExcess > bestExcess ? acc : best;
  });

  const requiresFx = donor.currency !== recipient.currency;
  const amount = convertFx(shortfall * 1.2, recipient.currency, donor.currency);
  const rail = pickRail(donor.currency, requiresFx);

  const transfer: TransferSuggestion = {
    from_account: donor.account_id,
    to_account: recipient.account_id,
    amount: Math.round(amount),
    currency_from: donor.currency,
    currency_to: recipient.currency,
    rail,
    initiate_by: inDays(Math.max(1, days - 1)),
    rationale: `Pre-fund ${recipient.account_id} ahead of ${alert.breach_date} breach — covers shortfall ${shortfall} ${recipient.currency}.`,
    requires_fx: requiresFx,
    notes: requiresFx
      ? [`FX leg ${donor.currency}→${recipient.currency} adds T+1 settlement risk.`]
      : [],
  };

  return { alert, transfer };
}

export function transferKey(t: TransferSuggestion): string {
  return `${t.from_account}>${t.to_account}|${t.amount}|${t.currency_from}|${t.currency_to}|${t.rail}|${t.initiate_by ?? ""}`;
}
