"use client";

import { useState } from "react";
import { localeToIntl, useLocale } from "@/i18n/locale-context";
import { formatNumber } from "@/lib/format";
import { runStressTest } from "@/lib/api";
import type { StressRequest, StressResult, StressScenario } from "@/types/api";
import ScenarioPicker from "@/components/timemachine/scenario-picker";
import ResultCard from "@/components/timemachine/result-card";
import type { MessageKey } from "@/i18n/messages/en";

export default function TimeMachinePage() {
  const { t, locale } = useLocale();
  const intl = localeToIntl(locale);

  const [req, setReq] = useState<StressRequest>({
    scenario: "rail_delay",
    rail: "SWIFT",
    extra_days: 3,
  });
  const [result, setResult] = useState<StressResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await runStressTest(req);
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      <div className="glass-card rounded-2xl px-5 py-3 mx-6 mt-4 shrink-0">
        <h1 className="text-xl font-bold leading-tight">
          {t("timemachine.title")}
        </h1>
        <p className="text-xs text-muted-foreground mt-1 leading-snug">
          {t("timemachine.subtitle")}
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-[18rem,1fr] gap-4 mb-4 items-stretch">
          <ScenarioPicker
            value={req}
            onChange={setReq}
            onRun={run}
            loading={loading}
          />
          {result ? (
            <div className="glass-card rounded-2xl p-4 flex items-center gap-6">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  {t("timemachine.totalImpact")}
                </div>
                <div
                  className={`text-xl font-bold tabular-nums ${
                    result.total_delta_usd < 0
                      ? "text-rose-500"
                      : "text-muted-foreground"
                  }`}
                >
                  {result.total_delta_usd >= 0 ? "+" : ""}$
                  {formatNumber(result.total_delta_usd, 0, intl)}
                </div>
              </div>
              <div
                title={t("timemachine.breachTooltip")}
                className="cursor-help"
              >
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  {t("timemachine.newBreaches")}
                </div>
                <div
                  className={`text-xl font-bold ${
                    result.new_breach_count > 0
                      ? "text-rose-500"
                      : "text-muted-foreground"
                  }`}
                >
                  {result.new_breach_count}
                </div>
              </div>
            </div>
          ) : (
            <ScenarioHint scenario={req.scenario} />
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 font-mono text-xs">
            {error}
          </div>
        )}

        {result && (() => {
          const applied = result.accounts.filter(
            (a) => a.methodology_inputs?.applied !== false
          );
          const skippedCount = result.accounts.length - applied.length;
          if (applied.length === 0) {
            return <EmptyApplied scenario={req.scenario} req={req} />;
          }
          return (
            <>
              <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground mb-2">
                <LegendDot color="#94a3b8" label={t("timemachine.legend.baseline")} />
                <LegendDot color="#10b981" label={t("timemachine.legend.stress")} />
                <LegendDot color="#dc2626" label={t("timemachine.legend.breach")} />
                {skippedCount > 0 && (
                  <span className="ml-auto text-muted-foreground">
                    {t("timemachine.skippedAccounts", {
                      n: String(skippedCount),
                    })}
                  </span>
                )}
              </div>
              <div
                className="grid gap-3"
                style={{
                  // auto-fill (not auto-fit): keeps empty tracks so a
                  // single applied card stays in its ~280px slot instead
                  // of stretching across the whole page.
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                }}
              >
                {applied.map((acc) => (
                  <ResultCard
                    key={acc.account_id}
                    result={acc}
                    intl={intl}
                    scenarioParams={req}
                  />
                ))}
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block w-3 h-[2px] rounded-full"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

function ScenarioHint({ scenario }: { scenario: StressScenario }) {
  const { t } = useLocale();
  // Empty-state placeholder shown before the user clicks Run. Each
  // scenario gets a one-liner so the page is never visually blank;
  // the line updates live as the user changes scenario in the picker.
  const detailKey: MessageKey =
    scenario === "rail_delay"
      ? "timemachine.hint.railDelay"
      : scenario === "volume_spike"
      ? "timemachine.hint.volumeSpike"
      : scenario === "bank_holiday"
      ? "timemachine.hint.bankHoliday"
      : scenario === "fx_shock"
      ? "timemachine.hint.fxShock"
      : scenario === "counterparty_default"
      ? "timemachine.hint.counterpartyDefault"
      : "timemachine.hint.liquidityFreeze";
  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col gap-2 justify-center">
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        {t("timemachine.hint.pickScenario")}
      </div>
      <p className="text-xs leading-relaxed text-foreground/80">
        {t(detailKey)}
      </p>
    </div>
  );
}

function EmptyApplied({
  scenario,
  req,
}: {
  scenario: StressScenario;
  req: StressRequest;
}) {
  const { t } = useLocale();
  // Shown when the simulation ran but no account in the fleet matches
  // the selected parameters (e.g. a rail no account uses, or a country
  // with no accounts). Tell the treasurer *why* nothing showed and
  // suggest a parameter change — better than a blank page.
  const reason: string =
    scenario === "rail_delay"
      ? t("timemachine.empty.railNotUsed", { rail: String(req.rail ?? "") })
      : scenario === "volume_spike"
      ? t("timemachine.empty.noOutbound")
      : scenario === "bank_holiday"
      ? t("timemachine.empty.noCountryAccount", {
          country: String(req.country ?? ""),
        })
      : scenario === "fx_shock"
      ? t("timemachine.reason.currencyMismatch")
      : scenario === "counterparty_default"
      ? t("timemachine.empty.noOutbound")
      : t("timemachine.reason.notFrozenAccount");
  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col gap-2">
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        {t("timemachine.empty.title")}
      </div>
      <p className="text-xs leading-relaxed text-foreground/80">{reason}</p>
      <p className="text-[11px] text-muted-foreground">
        {t("timemachine.empty.hint")}
      </p>
    </div>
  );
}
