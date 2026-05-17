"use client";

import { useEffect, useState } from "react";
import { useLocale, localeToIntl } from "@/i18n/locale-context";
import { getContagionNetwork, runCascade } from "@/lib/api";
import { formatMoneyCompact } from "@/lib/format";
import type {
  CascadeRequest,
  CascadeResult,
  ContagionNetwork,
} from "@/types/api";
import ShockForm from "@/components/contagion/shock-form";
import NetworkGraph from "@/components/contagion/network-graph";
import ResultPanel from "@/components/contagion/result-panel";

export default function ContagionPage() {
  const { t, locale } = useLocale();
  const intl = localeToIntl(locale);

  const [network, setNetwork] = useState<ContagionNetwork | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);

  const defaultReq: CascadeRequest = {
    shocked_account_id: "USD-Correspondent",
    intensity: 0.5,
    horizon_days: 7,
  };

  const [req, setReq] = useState<CascadeRequest>(defaultReq);
  const [result, setResult] = useState<CascadeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getContagionNetwork(controller.signal)
      .then((data) => {
        setNetwork(data);
        setNetworkError(null);
      })
      .catch((e) => {
        if ((e as Error).name === "AbortError") return;
        setNetworkError(t("contagion.error.network"));
      });
    return () => controller.abort();
  }, [t]);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await runCascade(req);
      setResult(r);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("503") || msg.toLowerCase().includes("warming")) {
        setError(t("contagion.error.engineWarming"));
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setReq(defaultReq);
    setResult(null);
    setError(null);
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      <div className="glass-card rounded-2xl px-5 py-3 mx-6 mt-4 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold leading-tight">
            {t("contagion.title")}
          </h1>
          <p className="text-xs text-muted-foreground mt-1 leading-snug">
            {t("contagion.subtitle")}
          </p>
        </div>
        {result && (
          <div className="text-right">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-0.5">
              {t("contagion.result.totalLoss")}
            </div>
            <div className="text-xl font-bold tabular-nums">
              {t("contagion.hero.summary", {
                loss: `$${formatMoneyCompact(result.total_loss_usd, intl)}`,
                affected: String(result.affected.length),
                breached: String(result.breached_count),
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 p-4 flex flex-col gap-4">
        {network ? (
          <div className="glass-card rounded-2xl px-5 py-3">
            <ShockForm
              nodes={network.nodes}
              value={req}
              onChange={setReq}
              onRun={run}
              onReset={reset}
              loading={loading}
            />
          </div>
        ) : (
          <div className="glass-card rounded-2xl p-4 text-xs font-mono text-muted-foreground">
            {networkError ?? "Loading network…"}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr,22rem] gap-4 h-full min-h-[480px]">
          <div className="glass-card rounded-2xl p-4 flex items-center justify-center relative">
            {network ? (
              <NetworkGraph
                nodes={network.nodes}
                edges={network.edges}
                result={result}
              />
            ) : (
              <span className="text-xs font-mono text-muted-foreground">
                {networkError ?? "Loading network…"}
              </span>
            )}
          </div>

          <ResultPanel result={result} error={error} />
        </div>
      </div>
    </div>
  );
}
