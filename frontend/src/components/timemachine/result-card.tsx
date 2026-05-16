"use client";

import { useLocale } from "@/i18n/locale-context";
import { formatNumber, type IntlLocale } from "@/lib/format";
import type { AccountStressResult, StressRequest } from "@/types/api";

interface Props {
  result: AccountStressResult;
  intl: IntlLocale;
  /** Currently-selected scenario request. Kept for future contextual
   *  copy in the methodology accordion; today only methodology_inputs
   *  is consulted but the request is threaded through so we don't
   *  re-plumb when richer per-rail / per-country messaging is added. */
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

      <div className="grid grid-cols-3 gap-2 text-[10px] font-mono pt-1 border-t border-border/50">
        <div>
          <div className="text-muted-foreground uppercase tracking-widest text-[9px]">
            {t("timemachine.baselineMin")}
          </div>
          <div className="tabular-nums">
            {result.currency}{" "}
            {formatNumber(result.baseline_min_p50, 0, intl)}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground uppercase tracking-widest text-[9px]">
            {t("timemachine.stressMin")}
          </div>
          <div className="tabular-nums">
            {result.currency}{" "}
            {formatNumber(result.stress_min_p50, 0, intl)}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground uppercase tracking-widest text-[9px]">
            {t("timemachine.delta")}
          </div>
          <div
            className={`tabular-nums font-bold ${
              result.delta_min_p50 < 0 ? "text-rose-500" : "text-emerald-500"
            }`}
          >
            {result.delta_min_p50 >= 0 ? "+" : ""}
            {result.currency}{" "}
            {formatNumber(result.delta_min_p50, 0, intl)}
          </div>
        </div>
      </div>

      <details className="mt-2 group">
        <summary className="cursor-pointer text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground py-1 list-none flex items-center gap-1">
          <span className="group-open:rotate-90 transition-transform inline-block">
            ▸
          </span>
          {t("timemachine.methodologyLabel")}
        </summary>
        <div className="mt-1 p-2 rounded bg-card/50 border border-border/50 space-y-1">
          <MethodologyDetails
            inputs={result.methodology_inputs}
            currency={result.currency}
            intl={intl}
          />
        </div>
      </details>
    </div>
  );
}

function MethodologyDetails({
  inputs,
  currency,
  intl,
}: {
  inputs: Record<string, unknown>;
  currency: string;
  intl: IntlLocale;
}) {
  const { t } = useLocale();
  const scenario = inputs.scenario as string | undefined;

  if (inputs.applied === false) {
    return (
      <p className="text-[10px] text-muted-foreground italic">
        {t("timemachine.method.notApplied")}: {String(inputs.reason ?? "n/a")}
      </p>
    );
  }

  if (scenario === "rail_delay") {
    return (
      <>
        <Row
          label={t("timemachine.method.sample")}
          value={`${inputs.sample_size} tx · ${inputs.sample_days} ${t("timemachine.method.days")}`}
        />
        <Row
          label={t("timemachine.method.avgInflow", { rail: String(inputs.rail) })}
          value={`${currency} ${formatNumber(Number(inputs.avg_daily_inflow), 0, intl)}/d`}
        />
        <Row
          label={t("timemachine.method.daysAffected")}
          value={String(inputs.days_affected)}
        />
        <Row
          label={t("timemachine.method.shiftPerDay")}
          value={`−${currency} ${formatNumber(Number(inputs.shift_per_day), 0, intl)}`}
          highlight
        />
      </>
    );
  }

  if (scenario === "volume_spike") {
    return (
      <>
        <Row
          label={t("timemachine.method.sample")}
          value={`${inputs.sample_size} tx · ${inputs.sample_days} ${t("timemachine.method.days")}`}
        />
        <Row
          label={t("timemachine.method.avgOutflow", { rail: String(inputs.affected_rail) })}
          value={`${currency} ${formatNumber(Number(inputs.avg_daily_outflow), 0, intl)}/d`}
        />
        <Row
          label={t("timemachine.method.multiplier")}
          value={`×${Number(inputs.multiplier).toFixed(2)}`}
        />
        <Row
          label={t("timemachine.method.extraPerDay")}
          value={`−${currency} ${formatNumber(Number(inputs.extra_per_day), 0, intl)}`}
          highlight
        />
      </>
    );
  }

  if (scenario === "bank_holiday") {
    return (
      <>
        <Row
          label={t("timemachine.method.country")}
          value={`${String(inputs.country)} · ${inputs.holiday_days} ${t("timemachine.method.days")}`}
        />
        <Row
          label={t("timemachine.method.flatValue")}
          value={`${currency} ${formatNumber(Number(inputs.flat_value), 0, intl)}`}
        />
        <Row
          label={t("timemachine.method.accumulatedDrift")}
          value={`${currency} ${formatNumber(Number(inputs.accumulated_drift), 0, intl)}`}
        />
        <Row
          label={t("timemachine.method.catchUp")}
          value={`${currency} ${formatNumber(Number(inputs.catch_up), 0, intl)}`}
          highlight
        />
      </>
    );
  }

  return null;
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2 text-[10px] font-mono">
      <span className="text-muted-foreground truncate">{label}</span>
      <span
        className={
          highlight ? "tabular-nums font-bold" : "tabular-nums"
        }
      >
        {value}
      </span>
    </div>
  );
}
