"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRadarPolling } from "@/hooks/use-radar-polling";
import type { TooltipData } from "@/components/radar/globe-3d";
import AccountCard from "@/components/radar/account-card";
import { useLocale } from "@/i18n/locale-context";
import { formatTime, formatNumber } from "@/lib/format";
import { localeToIntl } from "@/i18n/locale-context";

// Two-column row for tooltip values — keeps every line in lockstep.
function Row({
  label,
  value,
  valueClass = "text-foreground font-semibold",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex justify-between items-center gap-3">
      <span className="text-muted-foreground uppercase tracking-widest text-[10px] min-w-[120px]">
        {label}
      </span>
      <span className={`font-mono text-xs ${valueClass}`}>{value}</span>
    </div>
  );
}

// 3D globe is client-only (uses three.js / WebGL)
const Globe3D = dynamic(() => import("@/components/radar/globe-3d"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-muted-foreground tracking-wider uppercase">
      Loading globe…
    </div>
  ),
});

export default function RadarPage() {
  const { data, lastSync, error, loading } = useRadarPolling(2000);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { t, locale } = useLocale();
  const intl = localeToIntl(locale);

  const closeTooltip = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setTooltip(null);
  }, []);

  const openTooltip = useCallback((data: TooltipData, remainingMs: number) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setTooltip(data);
    timeoutRef.current = setTimeout(() => {
      setTooltip(null);
      timeoutRef.current = null;
    }, Math.max(500, remainingMs));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeTooltip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeTooltip]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div className="w-full h-full relative overflow-hidden bg-background">
      {/* Background 3D Globe — full screen, interactive (drag to rotate, scroll to zoom) */}
      <div className="absolute inset-0 z-0 pointer-events-auto">
        <Globe3D transactions={data.transactions} onSelectPlane={openTooltip} />
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

      {/* Pinned Tooltip — left dead-space, click-to-open, X / Esc / auto-close */}
      {tooltip && (
        <div
          className="absolute top-24 left-6 z-30 glass-card rounded-2xl p-5 shadow-xl w-[300px] pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={closeTooltip}
            aria-label={t("radar.tooltip.close")}
            className="absolute top-3 right-3 w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 text-sm transition-colors"
          >
            ✕
          </button>
          <div className="flex items-center justify-between mb-4 border-b border-slate-200/50 pb-3 pr-9">
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
          <div className="space-y-3">
            <Row
              label={t("radar.tooltip.amount")}
              value={formatNumber(tooltip.amount, 0, intl)}
              valueClass="text-foreground font-bold text-sm"
            />
            <Row label={t("radar.tooltip.paymentType")} value={tooltip.payment_type} />
            <Row label={t("radar.tooltip.valueDate")} value={tooltip.value_date} />
            <Row
              label={t("radar.tooltip.delay")}
              value={`${tooltip.clearing_delay_days}d`}
              valueClass="text-warning font-semibold"
            />
            <Row label={t("radar.tooltip.from")} value={tooltip.src} />
            <Row label={t("radar.tooltip.to")} value={tooltip.dst} />
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
      </div>
    </div>
  );
}
