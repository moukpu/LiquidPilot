"use client";

import { useLocale } from "@/i18n/locale-context";
import { formatNumber, formatMoneyCompact, type IntlLocale } from "@/lib/format";
import type { AccountStressResult, StressRequest } from "@/types/api";

function formatStatAmount(amount: number, intl: IntlLocale): string {
  // Compact only for absolute values ≥ 1,000,000.
  // Smaller values show full number with separators so thousands read.
  if (Math.abs(amount) >= 1_000_000) {
    return formatMoneyCompact(amount, intl);
  }
  return formatNumber(amount, 0, intl);
}

interface Props {
  result: AccountStressResult;
  intl: IntlLocale;
  /** Currently-selected scenario request. Currently unused inside the
   *  card but threaded through from the page so a future contextual
   *  badge / per-rail copy can pick it up without re-plumbing. */
  scenarioParams: StressRequest;
}

// Cardinal-spline path builder (tension 0.2). Mirrors d3.curveCardinal so
// we get the Robinhood / Mercury "smooth swoop" look without pulling in
// a chart library. Each segment's control points are derived from the
// neighbouring data points as tangent vectors; endpoint tangents fold
// back on themselves so the curve doesn't overshoot at the edges.
function smoothPath(points: Array<[number, number]>): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0][0]} ${points[0][1]}`;
  if (points.length === 2) {
    return `M ${points[0][0]} ${points[0][1]} L ${points[1][0]} ${points[1][1]}`;
  }

  const tension = 0.2;
  let path = `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i < points.length - 2 ? points[i + 2] : p2;

    const cp1x = p1[0] + (p2[0] - p0[0]) * tension;
    const cp1y = p1[1] + (p2[1] - p0[1]) * tension;
    const cp2x = p2[0] - (p3[0] - p1[0]) * tension;
    const cp2y = p2[1] - (p3[1] - p1[1]) * tension;

    path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return path;
}

export default function ResultCard({ result, intl }: Props) {
  const { t } = useLocale();

  // When the scenario is not applicable to this account (e.g. bank
  // holiday for a non-matching country) we render a flat neutral
  // stub instead of two overlapping curves, which would otherwise
  // imply that something was computed.
  const applied = result.methodology_inputs?.applied !== false;

  // Y range built from baseline + stress only. Floor used to render as
  // a dashed reference line + 'floor' text label, but it confused the
  // stress signal so it's gone entirely. The breach-count badge below
  // still uses methodology_inputs.floor server-side; the chart itself
  // shows just baseline (grey) vs stress (rose/grey).
  const baselineVals = result.horizon.map((p) => p.baseline_p50);
  const stressVals = result.horizon.map((p) => p.stress_p50);
  const dataVals = [...baselineVals, ...stressVals];
  const dataMin = Math.min(...dataVals);
  const dataMax = Math.max(...dataVals);
  // Edge case: baseline == stress (e.g. country mismatch in bank_holiday)
  // gives zero range. Fall back to 1% of magnitude, then to 1 absolute.
  const dataRange = dataMax - dataMin || Math.abs(dataMax) * 0.01 || 1;
  const padding = dataRange * 0.15;
  const yMin = dataMin - padding;
  const yMax = dataMax + padding;
  const yRange = yMax - yMin;

  const W = 260;
  const H = 70;
  const PAD_X = 4;
  const PAD_TOP = 6;
  const PAD_BOT = 14;
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_TOP - PAD_BOT;

  const toX = (i: number) =>
    PAD_X + (i / Math.max(1, result.horizon.length - 1)) * innerW;
  const toY = (v: number) => PAD_TOP + ((yMax - v) / yRange) * innerH;

  const baselinePoints: Array<[number, number]> = result.horizon.map(
    (p, i) => [toX(i), toY(p.baseline_p50)]
  );
  const stressPoints: Array<[number, number]> = result.horizon.map(
    (p, i) => [toX(i), toY(p.stress_p50)]
  );
  const baselinePath = smoothPath(baselinePoints);
  const stressPath = smoothPath(stressPoints);

  const breachWorsened = result.stress_breaches > result.baseline_breaches;
  // No green: stress can never visually claim improvement. We only
  // distinguish "worsened" (rose) from "neutral" (slate).
  const stressColor = breachWorsened ? "#dc2626" : "#94a3b8";

  return (
    <div className="glass-card rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-xs font-semibold">{result.account_id}</span>
        {breachWorsened && (
          <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-500 border border-rose-500/30">
            {t("timemachine.breach")}
          </span>
        )}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-12 mb-2">
        {applied ? (
          <>
            <path d={baselinePath} fill="none" stroke="#94a3b8" strokeWidth="1.5" />
            <path d={stressPath} fill="none" stroke={stressColor} strokeWidth="1.5" />
          </>
        ) : (
          <line
            x1={PAD_X}
            x2={W - PAD_X}
            y1={H / 2}
            y2={H / 2}
            stroke="#cbd5e1"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
        )}
      </svg>

      <div
        className={`grid gap-2 text-[10px] font-mono pt-1 border-t border-border/50 ${
          applied ? "grid-cols-3" : "grid-cols-2"
        }`}
      >
        <FooterStat
          label={t("timemachine.baselineMin")}
          currency={result.currency}
          amount={result.baseline_min_p50}
          intl={intl}
        />
        <FooterStat
          label={t("timemachine.stressMin")}
          currency={result.currency}
          amount={result.stress_min_p50}
          intl={intl}
        />
        {applied && (
          <FooterStat
            label={t("timemachine.delta")}
            currency={result.currency}
            amount={result.delta_min_p50}
            intl={intl}
            highlight={result.delta_min_p50 < 0 ? "negative" : undefined}
            showSign
          />
        )}
      </div>
    </div>
  );
}

function FooterStat({
  label,
  currency,
  amount,
  intl,
  highlight,
  showSign,
}: {
  label: string;
  currency: string;
  amount: number;
  intl: IntlLocale;
  highlight?: "positive" | "negative";
  showSign?: boolean;
}) {
  const sign = showSign && amount >= 0 ? "+" : "";
  const tone =
    highlight === "negative"
      ? "text-rose-500 font-bold"
      : highlight === "positive"
      ? "text-emerald-500 font-bold"
      : "";
  return (
    <div className="min-w-0">
      <div className="text-muted-foreground uppercase tracking-widest text-[9px]">
        {label}
      </div>
      <div
        className={`tabular-nums text-right whitespace-nowrap text-[10px] ${tone}`}
        title={`${sign}${currency} ${formatNumber(amount, 0, intl)}`}
      >
        {sign}
        {currency} {formatStatAmount(amount, intl)}
      </div>
    </div>
  );
}

