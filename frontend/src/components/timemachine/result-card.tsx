"use client";

import { useLocale } from "@/i18n/locale-context";
import { formatNumber, type IntlLocale } from "@/lib/format";
import type { AccountStressResult } from "@/types/api";

interface Props {
  result: AccountStressResult;
  intl: IntlLocale;
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

  const baselinePath = result.horizon
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(p.baseline_p50).toFixed(1)}`
    )
    .join(" ");
  const stressPath = result.horizon
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(p.stress_p50).toFixed(1)}`
    )
    .join(" ");

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
