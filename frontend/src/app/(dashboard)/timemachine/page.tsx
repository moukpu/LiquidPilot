"use client";

import { useState } from "react";
import { localeToIntl, useLocale } from "@/i18n/locale-context";
import { formatNumber } from "@/lib/format";
import { runStressTest } from "@/lib/api";
import type {
  StressRequest,
  StressResult,
} from "@/types/api";
import ScenarioPicker from "@/components/timemachine/scenario-picker";
import ResultCard from "@/components/timemachine/result-card";

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
    <div className="flex flex-col h-full">
      <div className="px-6 pt-4 pb-2 border-b border-border shrink-0">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="text-lg font-bold">{t("timemachine.title")}</h1>
          <p className="text-xs text-muted-foreground">
            {t("timemachine.subtitle")}
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-4">
        <div className="flex gap-4 mb-4 items-stretch">
          <div className="w-72 shrink-0">
            <ScenarioPicker
              value={req}
              onChange={setReq}
              onRun={run}
              loading={loading}
            />
          </div>
          {result && (
            <div className="flex-1 glass-card rounded-2xl p-4 flex items-center gap-6">
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
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 font-mono text-xs">
            {error}
          </div>
        )}

        {result && (
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
        )}
      </div>
    </div>
  );
}
