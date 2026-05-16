"use client";

import { useLocale } from "@/i18n/locale-context";
import { formatNumber, type IntlLocale } from "@/lib/format";
import type { AccountStressResult } from "@/types/api";

interface Props {
  result: AccountStressResult;
  intl: IntlLocale;
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

  // Y range built from baseline + stress only — including the floor here
  // would compress typical (balance >> floor) traces into a flat line at
  // the top of the chart. The floor is drawn inline when it lands inside
  // the data range, or rendered as a tiny corner label otherwise.
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

  const floorInRange = result.floor >= yMin && result.floor <= yMax;
  const floorY = toY(result.floor);
  const floorAbove = result.floor > yMax;

  const breachWorsened = result.stress_breaches > result.baseline_breaches;
  const stressColor = breachWorsened ? "#dc2626" : "#16a34a";

  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-sm font-semibold">{result.account_id}</span>
        {breachWorsened && (
          <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded bg-rose-500/20 text-rose-500 border border-rose-500/30">
            {t("timemachine.breach")}
          </span>
        )}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16 mb-3">
        {floorInRange && (
          <line
            x1={PAD_X}
            x2={W - PAD_X}
            y1={floorY}
            y2={floorY}
            stroke="#dc2626"
            strokeWidth="0.5"
            strokeDasharray="2 2"
            opacity="0.6"
          />
        )}
        {!floorInRange && (
          <text
            x={PAD_X}
            y={floorAbove ? PAD_TOP + 6 : H - 3}
            fontSize="6"
            fill="#dc2626"
            opacity="0.7"
          >
            {floorAbove ? "\u2191" : "\u2193"} floor
          </text>
        )}
        <path d={baselinePath} fill="none" stroke="#94a3b8" strokeWidth="1.5" />
        <path d={stressPath} fill="none" stroke={stressColor} strokeWidth="1.5" />
      </svg>

      <div className="space-y-1.5 font-mono text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground uppercase tracking-widest text-[10px]">
            {t("timemachine.baselineMin")}
          </span>
          <span className="tabular-nums">
            {result.currency} {formatNumber(result.baseline_min_p50, 0, intl)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground uppercase tracking-widest text-[10px]">
            {t("timemachine.stressMin")}
          </span>
          <span className="tabular-nums">
            {result.currency} {formatNumber(result.stress_min_p50, 0, intl)}
          </span>
        </div>
        <div className="flex justify-between pt-2 border-t border-slate-200/50">
          <span className="text-muted-foreground uppercase tracking-widest text-[10px]">
            {t("timemachine.delta")}
          </span>
          <span
            className={`tabular-nums font-bold ${
              result.delta_min_p50 < 0 ? "text-rose-500" : "text-emerald-500"
            }`}
          >
            {result.delta_min_p50 >= 0 ? "+" : ""}
            {result.currency} {formatNumber(result.delta_min_p50, 0, intl)}
          </span>
        </div>
      </div>
    </div>
  );
}
