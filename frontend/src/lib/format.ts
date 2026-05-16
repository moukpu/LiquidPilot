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
  opts: { fractionDigits?: number; compact?: boolean } = {}
): string {
  const { fractionDigits = 0, compact = false } = opts;
  const sym = currencySymbol(currency);
  const formatted = compact
    ? new Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(amount)
    : amount.toLocaleString("en-US", {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      });
  return `${sym}${formatted}`;
}

export function formatNumber(amount: number, fractionDigits = 0): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export function formatTime(d: Date | null): string {
  if (!d) return "--:--:--";
  return d.toLocaleTimeString("en-US", { hour12: false });
}

export function formatDate(s: string): string {
  return s;
}
