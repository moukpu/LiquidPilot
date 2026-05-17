// Mirror of backend `FX_RATES_TO_USD` in config.py. Keep in sync — if
// the two diverge, autopilot's "Moved" USD total and the converted
// transfer amounts will silently disagree with what the backend reports.
export const FX_TO_USD: Record<string, number> = {
  EUR: 1.08,
  USD: 1.0,
  GBP: 1.27,
  CHF: 1.1,
  JPY: 0.0067,
  SGD: 0.74,
  KZT: 0.0022,
};

export function fxRate(from: string, to: string): number {
  const usdPerFrom = FX_TO_USD[from];
  const usdPerTo = FX_TO_USD[to];
  if (!usdPerFrom || !usdPerTo) return 1;
  return usdPerFrom / usdPerTo;
}

export function convertFx(
  amount: number,
  from: string,
  to: string
): number {
  return amount * fxRate(from, to);
}

export function formatFxQuote(from: string, to: string): string {
  const r = fxRate(from, to);
  if (r >= 1) return `1 ${from} = ${r.toFixed(2)} ${to}`;
  if (r >= 0.01) return `1 ${from} = ${r.toFixed(4)} ${to}`;
  const inv = 1 / r;
  return `1 ${to} = ${inv.toFixed(2)} ${from}`;
}

export function amountInUsd(
  amount: number,
  currency: string
): number {
  const fx = FX_TO_USD[currency] ?? 1.0;
  return Math.abs(amount) * fx;
}
