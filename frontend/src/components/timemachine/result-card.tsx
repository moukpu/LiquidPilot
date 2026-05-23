"use client";

import { useLocale } from "@/i18n/locale-context";
import type { MessageKey } from "@/i18n/messages/en";
import { formatNumber, formatMoneyCompact, type IntlLocale } from "@/lib/format";
import type { AccountStressResult, StressRequest } from "@/types/api";

function formatStatAmount(amount: number, intl: IntlLocale): string {
  // Compact for absolute values ≥ 100k. Below that, the three-digit
  // figure is short enough to read uncompacted in a 280px card. The
  // currency code is dropped from the visible cell (it lives in the
  // card header `account_id`); full amount + currency stays in the
  // hover `title` for the precise number.
  if (Math.abs(amount) >= 100_000) {
    return formatMoneyCompact(amount, intl);
  }
  return formatNumber(amount, 0, intl);
}

function translateReason(
  raw: unknown,
  t: (k: MessageKey) => string
): string {
  const s = String(raw ?? "");
  // Order matters: more specific patterns first.
  if (s.includes("no inbound transactions on this rail")) return t("timemachine.reason.noInboundOnRail");
  if (s.includes("no outbound transactions on this rail")) return t("timemachine.reason.noOutboundOnRail");
  if (s.includes("no outbound transactions match")) return t("timemachine.reason.noFilterMatch");
  if (s.includes("no inbound transactions on this account")) return t("timemachine.reason.noInbound");
  if (s.includes("no historical OUT")) return t("timemachine.reason.noOutbound");
  if (s.includes("country") && s.includes("not")) return t("timemachine.reason.countryMismatch");
  if (s.includes("currency does not match")) return t("timemachine.reason.currencyMismatch");
  if (s.includes("multiplier")) return t("timemachine.reason.zeroMultiplier");
  if (s.includes("shock magnitude is 0")) return t("timemachine.reason.zeroShock");
  if (s.includes("no counterparty selected")) return t("timemachine.reason.noCounterpartySelected");
  if (s.includes("no frozen account selected")) return t("timemachine.reason.noFrozenSelected");
  if (s.includes("not the frozen account")) return t("timemachine.reason.notFrozenAccount");
  if (s.includes("freeze_days=0")) return t("timemachine.reason.zeroFreezeDays");
  if (s.includes("holiday_days=0")) return t("timemachine.reason.zeroHolidayDays");
  if (s.includes("empty horizon")) return t("timemachine.reason.emptyHorizon");
  return t("timemachine.reason.unknown");
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
  // 3 visual states for the stress curve so it never overlaps with
  // baseline: rose (breach worsened), emerald (no breach worsened),
  // slate (not applicable to this account — handled by `applied`
  // branch below as a dashed flat line).
  const stressColor = breachWorsened ? "#dc2626" : "#10b981";

  return (
    <div className="glass-card rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-xs font-semibold">{result.account_id}</span>
        {breachWorsened && (
          <span
            className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-500 border border-rose-500/30 cursor-help"
            title={t("timemachine.breachTooltip")}
          >
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
          <div className="space-y-1">
            <FooterStat
              label={t("timemachine.delta")}
              currency={result.currency}
              amount={result.delta_min_p50}
              intl={intl}
              highlight={result.delta_min_p50 < 0 ? "negative" : undefined}
              showSign
            />
            <FooterStat
              label={t("timemachine.loss")}
              currency={result.currency}
              amount={result.integrated_delta_p50}
              intl={intl}
              highlight={result.integrated_delta_p50 < 0 ? "negative" : undefined}
              showSign
            />
          </div>
        )}
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
      <div className="text-muted-foreground uppercase tracking-widest text-[9px] mb-0.5">
        {label}
      </div>
      <div
        className={`tabular-nums whitespace-nowrap text-xs font-semibold ${
          tone || "text-foreground"
        }`}
        title={`${sign}${currency} ${formatNumber(amount, 0, intl)}`}
      >
        {sign}
        {formatStatAmount(amount, intl)}
      </div>
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
        {t("timemachine.method.notApplied")}: {translateReason(inputs.reason, t)}
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
          label={t("timemachine.method.dailyNetOutflow")}
          value={`${currency} ${formatNumber(Number(inputs.daily_net_outflow), 0, intl)}/d`}
        />
        <Row
          label={t("timemachine.method.deferred")}
          value={`−${currency} ${formatNumber(Number(inputs.deferred_outflow), 0, intl)}`}
          highlight
        />
      </>
    );
  }

  if (scenario === "fx_shock") {
    return (
      <>
        <Row
          label={t("timemachine.method.fxShockPct")}
          value={`${Number(inputs.fx_shock_pct ?? 0).toFixed(2)}%`}
        />
        <Row
          label={t("timemachine.method.fxMagnitude")}
          value={`${Number(inputs.magnitude ?? 0).toFixed(2)}%`}
        />
        <Row
          label={t("timemachine.method.fxFactor")}
          value={`×${Number(inputs.factor ?? 1).toFixed(4)}`}
          highlight
        />
      </>
    );
  }

  if (scenario === "counterparty_default") {
    if (inputs.self_default) {
      return (
        <>
          <Row
            label={t("timemachine.method.counterparty")}
            value={`${String(inputs.counterparty_account)} · ${t("timemachine.method.selfDefault")}`}
          />
          <Row
            label={t("timemachine.method.sample")}
            value={`${inputs.sample_size} tx`}
          />
          <Row
            label={t("timemachine.method.dailyOutflow")}
            value={`−${currency} ${formatNumber(Number(inputs.daily_outflow ?? 0), 0, intl)}/d`}
            highlight
          />
        </>
      );
    }
    return (
      <>
        <Row
          label={t("timemachine.method.counterparty")}
          value={String(inputs.counterparty_account ?? "")}
        />
        <Row
          label={t("timemachine.method.sample")}
          value={`${inputs.sample_size} tx`}
        />
        <Row
          label={t("timemachine.method.dailyInflow")}
          value={`${currency} ${formatNumber(Number(inputs.daily_inflow ?? 0), 0, intl)}/d`}
        />
        <Row
          label={t("timemachine.method.exposureFrac")}
          value={`${(Number(inputs.exposure_fraction ?? 0) * 100).toFixed(0)}%`}
        />
        <Row
          label={t("timemachine.method.lossPerDay")}
          value={`−${currency} ${formatNumber(Number(inputs.loss_per_day ?? 0), 0, intl)}/d`}
          highlight
        />
      </>
    );
  }

  if (scenario === "liquidity_freeze") {
    return (
      <>
        <Row
          label={t("timemachine.method.frozenAccount")}
          value={`${String(inputs.frozen_account)} · ${inputs.freeze_days} ${t("timemachine.method.days")}`}
        />
        <Row
          label={t("timemachine.method.sample")}
          value={`${inputs.sample_size} tx · ${inputs.sample_days} ${t("timemachine.method.days")}`}
        />
        <Row
          label={t("timemachine.method.dailyNetOutflow")}
          value={`${currency} ${formatNumber(Number(inputs.daily_net_outflow ?? 0), 0, intl)}/d`}
        />
        <Row
          label={t("timemachine.method.amplification")}
          value={`×${Number(inputs.amplification ?? 1.1).toFixed(2)}`}
        />
        <Row
          label={t("timemachine.method.queuedDrag")}
          value={`−${currency} ${formatNumber(Number(inputs.queued_drag ?? 0), 0, intl)}`}
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
      <span className="text-muted-foreground">{label}</span>
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

