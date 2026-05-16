"use client";

import { useState } from "react";
import { useRadarPolling } from "@/hooks/use-radar-polling";
import WorldMap, { type TooltipData } from "@/components/radar/world-map";
import AccountCard from "@/components/radar/account-card";
import AlertsPanel from "@/components/radar/alerts-panel";
import { useLocale } from "@/i18n/locale-context";
import { formatTime, formatNumber } from "@/lib/format";
import { localeToIntl } from "@/i18n/locale-context";

export default function RadarPage() {
  const { data, lastSync, error, loading } = useRadarPolling(2000);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const { t, locale } = useLocale();
  const intl = localeToIntl(locale);

  return (
    <div className="w-full h-full relative overflow-hidden bg-background">
      {/* Background Map - Absolute Full Screen */}
      <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-auto">
        <WorldMap transactions={data.transactions} onHoverPlane={setTooltip} />
      </div>

      {/* Floating Status Bar (Top Left) */}
      <div className="absolute top-6 left-6 z-10 glass rounded-full px-5 py-2.5 flex items-center gap-4 text-xs font-mono shadow-lg">
        <span className="text-muted-foreground uppercase tracking-widest">
          {t("status.lastSync")} <span className="text-foreground font-semibold ml-1">{formatTime(lastSync, intl)}</span>
        </span>
        {loading && <span className="text-primary animate-pulse tracking-widest uppercase">Syncing...</span>}
        {error ? (
          <span className="text-rose-400 font-medium tracking-widest uppercase">⚠ {t("status.offline")}</span>
        ) : (
          <div className="flex items-center gap-2 border-l border-slate-200/50 pl-4">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-sm" />
            <span className="text-emerald-400 font-medium tracking-widest uppercase">{t("status.online")}</span>
          </div>
        )}
      </div>

      {/* Floating Legend (Bottom Left) */}
      <div className="absolute bottom-6 left-6 z-10 glass rounded-2xl px-6 py-5 flex flex-col gap-4 text-xs font-mono shadow-lg pointer-events-none">
        <span className="text-muted-foreground uppercase tracking-widest text-[10px]">{t("radar.flowSize")}</span>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="inline-block w-2 h-2 rounded-full bg-[#22c55e] shadow-sm" />
            <span className="text-foreground/90">{t("radar.legend.small")}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-block w-3 h-3 rounded-full bg-[#eab308] shadow-sm" />
            <span className="text-foreground/90">{t("radar.legend.medium")}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-block w-4 h-4 rounded-full bg-[#ef4444] shadow-sm" />
            <span className="text-foreground/90">{t("radar.legend.large")}</span>
          </div>
        </div>
        <span className="mt-1 text-[10px] text-muted-foreground/50 border-t border-slate-200/50 pt-2">{t("radar.legend.hoverHint")}</span>
      </div>

      {/* Floating Tooltip */}
      {tooltip && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 glass-card rounded-2xl p-4 shadow-xl z-30 min-w-[280px] pointer-events-none">
          <div className="flex items-center justify-between mb-3 border-b border-slate-200/50 pb-3">
            <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest">
              {t("radar.tooltip.direction")}
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-widest ${
                tooltip.direction === "IN"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
              }`}
            >
              {tooltip.direction === "IN" ? t("radar.direction.IN") : t("radar.direction.OUT")}
            </span>
          </div>
          <div className="space-y-2.5 font-mono text-xs">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground uppercase tracking-widest text-[10px]">{t("radar.tooltip.amount")}</span>
              <span className="font-bold text-foreground text-sm">{formatNumber(tooltip.amount, 0, intl)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground uppercase tracking-widest text-[10px]">{t("radar.tooltip.paymentType")}</span>
              <span className="text-primary/90">{tooltip.payment_type}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground uppercase tracking-widest text-[10px]">{t("radar.tooltip.valueDate")}</span>
              <span className="text-foreground/80">{tooltip.value_date}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground uppercase tracking-widest text-[10px]">{t("radar.tooltip.delay")}</span>
              <span className="text-warning font-semibold">{tooltip.clearing_delay_days}d</span>
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-slate-200/50 mt-3">
              <span className="text-muted-foreground uppercase tracking-widest text-[10px]">{t("radar.tooltip.from")} → {t("radar.tooltip.to")}</span>
              <span className="font-semibold text-foreground">
                {tooltip.src} → {tooltip.dst}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Right HUD Panel (Floating) */}
      <div 
        className="absolute right-6 top-6 bottom-6 w-[340px] z-20 flex flex-col gap-4 overflow-y-auto pr-2 pb-6 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300/50 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-400/50"
        style={{ maskImage: "linear-gradient(to bottom, black 90%, transparent 100%)" }}
      >
        {data.accounts.map((acc) => (
          <AccountCard
            key={acc.account_id}
            account={acc}
            transactions={data.transactions}
          />
        ))}

        <div className="glass-card rounded-2xl p-5 shrink-0 mt-2">
          <div className="text-[10px] font-mono uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            {t("alerts.title")}
          </div>
          <AlertsPanel
            alerts={data.recommendations.alerts}
            transfers={data.recommendations.transfers}
          />
        </div>
      </div>
    </div>
  );
}
