"use client";

import { useState } from "react";
import { useRadarPolling } from "@/hooks/use-radar-polling";
import WorldMap, { type TooltipData } from "@/components/radar/world-map";
import AccountCard from "@/components/radar/account-card";
import AlertsPanel from "@/components/radar/alerts-panel";

export default function RadarPage() {
  const { data, lastSync, error, loading } = useRadarPolling(2000);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  const formatTime = (d: Date | null) => {
    if (!d) return "--:--:--";
    return d.toLocaleTimeString("en-US", { hour12: false });
  };

  return (
    <div className="-m-6 h-[calc(100vh-4rem)] flex overflow-hidden">
      {/* Left: Map */}
      <div className="flex-1 min-w-0 relative flex flex-col">
        {/* Status bar */}
        <div className="h-8 flex items-center justify-between px-4 border-b border-border bg-card/50 backdrop-blur-sm text-[10px] font-mono shrink-0 z-10">
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground">
              Last sync <span className="text-foreground">{formatTime(lastSync)}</span>
            </span>
            {loading && <span className="text-primary animate-pulse">Syncing…</span>}
          </div>
          {error ? (
            <span className="text-rose-400">offline · {error}</span>
          ) : (
            <span className="text-emerald-400">online</span>
          )}
        </div>

        <div className="flex-1 min-h-0 relative">
          <WorldMap transactions={data.transactions} onHoverPlane={setTooltip} />

          {/* Tooltip */}
          {tooltip && (
            <div className="absolute top-3 right-3 bg-card/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-xl z-20 min-w-[220px]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider">
                  Flight Data
                </span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    tooltip.direction === "IN"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-rose-500/20 text-rose-400"
                  }`}
                >
                  {tooltip.direction}
                </span>
              </div>
              <div className="space-y-1 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span>{tooltip.amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span>{tooltip.payment_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Value Date</span>
                  <span>{tooltip.value_date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Clearing</span>
                  <span>{tooltip.clearing_delay_days}d</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Route</span>
                  <span>
                    {tooltip.src} → {tooltip.dst}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="h-10 flex items-center gap-6 px-4 border-t border-border bg-card/50 backdrop-blur-sm text-[10px] font-mono shrink-0">
          <span className="text-muted-foreground uppercase tracking-wider">Flow size</span>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-[#22c55e]" />
            <span className="text-muted-foreground">&lt;50K</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full bg-[#eab308]" />
            <span className="text-muted-foreground">&lt;500K</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-4 h-4 rounded-full bg-[#ef4444]" />
            <span className="text-muted-foreground">≥500K</span>
          </div>
        </div>
      </div>

      {/* Right sidebar */}
      <div className="w-80 border-l border-border bg-card flex flex-col overflow-auto shrink-0">
        <div className="p-4 space-y-3">
          {/* Account cards */}
          {data.accounts.map((acc) => (
            <AccountCard
              key={acc.account_id}
              account={acc}
              transactions={data.transactions}
            />
          ))}

          {/* Alerts */}
          <div className="pt-1">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 px-1">
              Alerts & Recommendations
            </div>
            <AlertsPanel
              alerts={data.recommendations.alerts}
              transfers={data.recommendations.transfers}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
