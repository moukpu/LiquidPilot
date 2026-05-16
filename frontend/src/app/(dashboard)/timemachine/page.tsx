"use client";

import { useState } from "react";
import { localeToIntl, useLocale } from "@/i18n/locale-context";
import { formatNumber } from "@/lib/format";
import { runStressTest } from "@/lib/api";
import type {
  StressRequest,
  StressResult,
  StressScenario,
} from "@/types/api";
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
                      : "text-emerald-500"
                  }`}
                >
                  {result.total_delta_usd >= 0 ? "+" : ""}$
                  {formatNumber(result.total_delta_usd, 0, intl)}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  {t("timemachine.newBreaches")}
                </div>
                <div
                  className={`text-xl font-bold ${
                    result.new_breach_count > 0
                      ? "text-rose-500"
                      : "text-emerald-500"
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

        {result && (
          <>
            {result.new_breach_count === 0 && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/60 text-emerald-700 text-xs leading-snug">
                {t("timemachine.summary.noBreaches")}
              </div>
            )}
            <div
              className="grid gap-3"
              style={{
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              }}
            >
              {result.accounts.map((acc) => (
                <ResultCard
                  key={acc.account_id}
                  result={acc}
                  intl={intl}
                  scenarioParams={req}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
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
      : "timemachine.hint.bankHoliday";
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
