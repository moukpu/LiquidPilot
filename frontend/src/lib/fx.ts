export const FX_TO_USD: Record<string, number> = {
  EUR: 1.08,
  USD: 1.0,
  GBP: 1.27,
  CHF: 1.12,
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

export function amountInUsd(
  amount: number,
  currency: string
): number {
  const fx = FX_TO_USD[currency] ?? 1.0;
  return Math.abs(amount) * fx;
}
