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

export function formatTime(d: Date | null, locale: IntlLocale = "en-US"): string {
  if (!d) return "--:--:--";
  return d.toLocaleTimeString(locale, { hour12: false });
}

export function formatDate(s: string): string {
  return s;
}
