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
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">{t("timemachine.title")}</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {t("timemachine.subtitle")}
      </p>

      <ScenarioPicker value={req} onChange={setReq} onRun={run} loading={loading} />

      {error && (
        <div className="mt-4 p-4 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 font-mono text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-6">
          <div className="mb-4 p-4 rounded-2xl glass-card flex items-center gap-8">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                {t("timemachine.totalImpact")}
              </div>
              <div
                className={`text-2xl font-bold tabular-nums ${
                  result.total_delta_usd < 0 ? "text-rose-500" : "text-emerald-500"
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
                className={`text-2xl font-bold ${
                  result.new_breach_count > 0 ? "text-rose-500" : "text-emerald-500"
                }`}
              >
                {result.new_breach_count}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {result.accounts.map((acc) => (
              <ResultCard key={acc.account_id} result={acc} intl={intl} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
