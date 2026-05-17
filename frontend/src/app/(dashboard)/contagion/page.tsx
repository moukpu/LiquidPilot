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
    <div className="flex h-[calc(100vh-4rem)] p-4 gap-4 bg-slate-50/50">
      {/* Left Sidebar: Controls + Results */}
      <div className="w-[340px] flex flex-col gap-4 shrink-0 min-h-0">
        <div className="glass-card rounded-3xl p-5 shadow-sm bg-white shrink-0">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            {t("contagion.title")}
          </h1>
          <p className="text-[10px] text-slate-400 mt-1 mb-6 uppercase tracking-wider font-semibold">
            {t("contagion.page.subtitle")}
          </p>
          {network ? (
            <ShockForm
              nodes={network.nodes}
              value={req}
              onChange={setReq}
              onRun={run}
              onReset={reset}
              loading={loading}
            />
          ) : (
            <div className="text-xs font-mono text-slate-400 py-4 text-center">
              {networkError ?? "Loading network..."}
            </div>
          )}
        </div>

        <div className="glass-card rounded-3xl shadow-sm bg-white flex-1 min-h-0 flex flex-col overflow-hidden">
          <ResultPanel result={result} error={error} />
        </div>
      </div>

      {/* Right Canvas: The Graph */}
      <div className="flex-1 glass-card rounded-3xl shadow-sm bg-white relative overflow-hidden min-h-0 border border-slate-100">
        {result && (
          <div className="absolute top-6 left-6 z-10 flex gap-3 pointer-events-none">
            <div className="bg-white/80 backdrop-blur-xl border border-slate-100 px-5 py-3 rounded-2xl shadow-sm">
              <div className="text-[10px] uppercase text-slate-500 font-bold tracking-widest mb-0.5">
                {t("contagion.result.totalLoss")}
              </div>
              <div className="text-2xl font-black text-rose-500 tabular-nums leading-none tracking-tight">
                ${formatMoneyCompact(result.total_loss_usd, intl)}
              </div>
            </div>
            <div className="bg-white/80 backdrop-blur-xl border border-slate-100 px-5 py-3 rounded-2xl shadow-sm">
              <div className="text-[10px] uppercase text-slate-500 font-bold tracking-widest mb-0.5">
                {t("contagion.metric.affected")}
              </div>
              <div className="text-2xl font-black text-slate-800 tabular-nums leading-none tracking-tight">
                {result.affected.length}
              </div>
            </div>
            <div className="bg-white/80 backdrop-blur-xl border border-slate-100 px-5 py-3 rounded-2xl shadow-sm">
              <div className="text-[10px] uppercase text-slate-500 font-bold tracking-widest mb-0.5">
                {t("contagion.metric.breached")}
              </div>
              <div className="text-2xl font-black text-slate-800 tabular-nums leading-none tracking-tight">
                {result.breached_count}
              </div>
            </div>
          </div>
        )}

        {network ? (
          <NetworkGraph
            nodes={network.nodes}
            edges={network.edges}
            result={result}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm font-mono">
            {networkError ?? "Loading network topology..."}
          </div>
        )}
      </div>
    </div>
  );
}
