export type IntlLocale = "en-US" | "ru-RU";

const SYMBOLS: Record<string, string> = {
  EUR: "\u20AC",
  USD: "$",
  GBP: "\u00A3",
};

export function currencySymbol(currency: string): string {
  return SYMBOLS[currency] ?? currency;
}

export function formatMoney(
  amount: number,
  currency: string,
  opts: { fractionDigits?: number; compact?: boolean } = {},
  locale: IntlLocale = "en-US"
): string {
  const { fractionDigits = 0, compact = false } = opts;
  const sym = currencySymbol(currency);
  const formatted = compact
    ? new Intl.NumberFormat(locale, {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(amount)
    : amount.toLocaleString(locale, {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      });
  return `${sym}${formatted}`;
}

export function formatNumber(
  amount: number,
  fractionDigits = 0,
  locale: IntlLocale = "en-US"
): string {
  return amount.toLocaleString(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export function formatMoneyCompact(
  amount: number,
  locale: IntlLocale = "en-US"
): string {
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Display-only label for account_id strings. Backend ids stay verbatim
 * (`EUR-Main`, `USD-Correspondent`) — this only affects user-facing
 * text. Single-tower legacy accounts collapse to the bare currency
 * code; everything else becomes `CCY · City`.
 */
export function displayAccountLabel(accountId: string): string {
  if (accountId === "EUR-Main") return "EUR";
  if (accountId === "USD-Correspondent") return "USD";
  const sep = accountId.indexOf("-");
  if (sep < 0) return accountId;
  const ccy = accountId.slice(0, sep);
  const city = accountId.slice(sep + 1);
  return city ? `${ccy} · ${city}` : ccy;
}

export function formatTime(d: Date | null, locale: IntlLocale = "en-US"): string {
  if (!d) return "--:--:--";
  return d.toLocaleTimeString(locale, { hour12: false });
}

export function formatDate(s: string): string {
  return s;
}
