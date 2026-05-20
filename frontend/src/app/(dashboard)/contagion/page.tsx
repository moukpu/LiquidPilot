"use client";

import { useEffect, useState } from "react";
import { useLocale, localeToIntl } from "@/i18n/locale-context";
import { getContagionNetwork, runCascade } from "@/lib/api";
import { displayAccountLabel, formatMoneyCompact } from "@/lib/format";
import type {
  CascadeRequest,
  CascadeResult,
  ContagionEdge,
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
  const [selectedEdge, setSelectedEdge] = useState<ContagionEdge | null>(null);

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
    setSelectedEdge(null);
  };

  const onSelectAccount = (accountId: string) => {
    setReq((prev) => ({ ...prev, shocked_account_id: accountId }));
    setSelectedEdge(null);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] p-4 gap-4 bg-slate-50/50">
      <div className="w-[340px] flex flex-col gap-4 shrink-0 min-h-0">
        <div className="glass-card rounded-3xl p-5 shadow-sm bg-white shrink-0">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            {t("contagion.title")}
          </h1>
          <p className="text-[10px] text-slate-400 mt-1 mb-4 uppercase tracking-wider font-semibold">
            {t("contagion.page.subtitle")}
          </p>
          <p className="text-[11px] text-slate-500 mb-4 leading-snug">
            {t("contagion.tip.clickNode")}
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
              {networkError ?? t("contagion.loading")}
            </div>
          )}
        </div>

        <div className="glass-card rounded-3xl shadow-sm bg-white flex-1 min-h-0 flex flex-col overflow-hidden">
          <ResultPanel result={result} error={error} />
        </div>
      </div>

      <div className="flex-1 glass-card rounded-3xl shadow-sm bg-white relative overflow-hidden min-h-0 border border-slate-100">
        {result && (
          <div className="absolute top-6 left-6 z-10 flex gap-3 pointer-events-none">
            <div className="bg-white/95 backdrop-blur-xl border border-slate-100 px-5 py-3 rounded-2xl shadow-sm">
              <div className="text-[10px] uppercase text-slate-500 font-bold tracking-widest mb-0.5">
                {t("contagion.result.totalLoss")}
              </div>
              <div className="text-2xl font-black text-rose-500 tabular-nums leading-none tracking-tight">
                ${formatMoneyCompact(result.total_loss_usd, intl)}
              </div>
            </div>
            <div className="bg-white/95 backdrop-blur-xl border border-slate-100 px-5 py-3 rounded-2xl shadow-sm">
              <div className="text-[10px] uppercase text-slate-500 font-bold tracking-widest mb-0.5">
                {t("contagion.metric.affected")}
              </div>
              <div className="text-2xl font-black text-slate-800 tabular-nums leading-none tracking-tight">
                {result.affected.length}
              </div>
            </div>
            <div className="bg-white/95 backdrop-blur-xl border border-slate-100 px-5 py-3 rounded-2xl shadow-sm">
              <div className="text-[10px] uppercase text-slate-500 font-bold tracking-widest mb-0.5">
                {t("contagion.metric.breached")}
              </div>
              <div className="text-2xl font-black text-slate-800 tabular-nums leading-none tracking-tight">
                {result.breached_count}
              </div>
            </div>
          </div>
        )}

        {selectedEdge && (
          <div className="absolute top-6 right-6 z-20 w-[300px] bg-white border border-slate-200 rounded-2xl shadow-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                {t("contagion.edge.detail.title")}
              </div>
              <button
                type="button"
                onClick={() => setSelectedEdge(null)}
                className="text-slate-400 hover:text-slate-700 text-sm"
                aria-label={t("contagion.edge.detail.close")}
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <div className="text-slate-400 uppercase tracking-wider text-[9px]">
                  {t("contagion.edge.detail.from")}
                </div>
                <div className="font-semibold text-slate-900">
                  {displayAccountLabel(selectedEdge.from)}
                </div>
              </div>
              <div>
                <div className="text-slate-400 uppercase tracking-wider text-[9px]">
                  {t("contagion.edge.detail.to")}
                </div>
                <div className="font-semibold text-slate-900">
                  {displayAccountLabel(selectedEdge.to)}
                </div>
              </div>
              <div>
                <div className="text-slate-400 uppercase tracking-wider text-[9px]">
                  {t("contagion.edge.detail.amount")}
                </div>
                <div className="font-bold text-slate-900 tabular-nums">
                  ${formatMoneyCompact(selectedEdge.exposure_usd, intl)}
                </div>
              </div>
              <div>
                <div className="text-slate-400 uppercase tracking-wider text-[9px]">
                  {t("contagion.edge.detail.kind")}
                </div>
                <div className="font-semibold text-slate-900">
                  {t(`contagion.edge.kind.${selectedEdge.kind}` as never)}
                </div>
              </div>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-600 border-t border-slate-100 pt-3">
              {selectedEdge.description}
            </p>
            <p className="text-[10px] leading-snug text-slate-500 italic">
              {t("contagion.edge.detail.why")}
            </p>
          </div>
        )}

        {network ? (
          <NetworkGraph
            nodes={network.nodes}
            edges={network.edges}
            result={result}
            selectedAccount={req.shocked_account_id}
            onSelectAccount={onSelectAccount}
            onSelectEdge={setSelectedEdge}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm font-mono">
            {networkError ?? t("contagion.loadingTopology")}
          </div>
        )}
      </div>
    </div>
  );
}
