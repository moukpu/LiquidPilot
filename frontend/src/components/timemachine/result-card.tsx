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

  // Build a tight viewbox covering both baseline + stress + floor so the
  // floor line is always visible relative to the trajectories.
  const allValues = result.horizon.flatMap((p) => [p.baseline_p50, p.stress_p50]);
  const minV = Math.min(...allValues, result.floor);
  const maxV = Math.max(...allValues, result.floor);
  const range = maxV - minV || 1;
  const n = Math.max(1, result.horizon.length - 1);

  const toY = (v: number) => 60 - ((v - minV) / range) * 50;
  const baselinePath = result.horizon
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"} ${(i * 260) / n} ${toY(p.baseline_p50).toFixed(1)}`
    )
    .join(" ");
  const stressPath = result.horizon
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"} ${(i * 260) / n} ${toY(p.stress_p50).toFixed(1)}`
    )
    .join(" ");
  const floorY = toY(result.floor);

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

      <svg viewBox="0 0 260 70" className="w-full h-16 mb-3" preserveAspectRatio="none">
        <line
          x1="0"
          x2="260"
          y1={floorY}
          y2={floorY}
          stroke="#dc2626"
          strokeWidth="0.5"
          strokeDasharray="2 2"
          opacity="0.6"
        />
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
