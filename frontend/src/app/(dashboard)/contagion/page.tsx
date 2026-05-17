"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/i18n/locale-context";
import { getContagionNetwork, runCascade } from "@/lib/api";
import type {
  CascadeRequest,
  CascadeResult,
  ContagionNetwork,
} from "@/types/api";
import ShockForm from "@/components/contagion/shock-form";
import NetworkGraph from "@/components/contagion/network-graph";
import ResultPanel from "@/components/contagion/result-panel";

export default function ContagionPage() {
  const { t } = useLocale();

  const [network, setNetwork] = useState<ContagionNetwork | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);

  const [req, setReq] = useState<CascadeRequest>({
    // Default = the hub from the fixture. Mirrors the curl demo in
    // 0009's verification log so the page reproduces the same numbers
    // out of the box.
    shocked_account_id: "USD-Correspondent",
    intensity: 1.0,
    horizon_days: 7,
  });
  const [result, setResult] = useState<CascadeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch the bilateral exposure graph once on mount. This endpoint
  // is safe before warm-up (returns opening balances).
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
      // Backend returns 503 with "Engine warming up" body when not
      // ready. Map to a friendly localised message.
      if (msg.includes("503") || msg.toLowerCase().includes("warming")) {
        setError(t("contagion.error.engineWarming"));
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      <div className="glass-card rounded-2xl px-5 py-3 mx-6 mt-4 shrink-0">
        <h1 className="text-xl font-bold leading-tight">
          {t("contagion.title")}
        </h1>
        <p className="text-xs text-muted-foreground mt-1 leading-snug">
          {t("contagion.subtitle")}
        </p>
      </div>

      <div className="flex-1 min-h-0 p-4">
        <div className="grid grid-cols-1 lg:grid-cols-[18rem,1fr,22rem] gap-4 h-full">
          {network ? (
            <ShockForm
              nodes={network.nodes}
              value={req}
              onChange={setReq}
              onRun={run}
              loading={loading}
            />
          ) : (
            <div className="glass-card rounded-2xl p-4 text-xs font-mono text-muted-foreground">
              {networkError ?? "Loading network…"}
            </div>
          )}

          <div className="glass-card rounded-2xl p-4 flex items-center justify-center min-h-[480px]">
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
