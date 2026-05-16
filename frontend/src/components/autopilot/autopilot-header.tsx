"use client";

import { Sparkles } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatTime } from "@/lib/format";
import { useLocale, localeToIntl } from "@/i18n/locale-context";

export interface AutopilotHeaderProps {
  demoMode: boolean;
  onToggleDemoMode: (on: boolean) => void;
  lastSync: Date | null;
  error: string | null;
  counts: {
    queued: number;
    confirming: number;
    executing: number;
    executed: number;
    skipped: number;
  };
}

export default function AutopilotHeader({
  demoMode,
  onToggleDemoMode,
  lastSync,
  error,
  counts,
}: AutopilotHeaderProps) {
  const { t, locale } = useLocale();
  const intl = localeToIntl(locale);
  return (
    <header className="h-14 shrink-0 border-b border-border bg-card/40 backdrop-blur-sm flex items-center px-6 gap-6">
      <div className="flex flex-col leading-tight">
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary">
          {t("autopilot.eyebrow")}
        </span>
        <span className="text-sm font-semibold">{t("autopilot.title")}</span>
      </div>

      <div className="flex-1 flex items-center justify-center gap-4 text-[11px] font-mono">
        <span className="text-muted-foreground">
          {t("status.lastSync")} <span className="text-foreground">{formatTime(lastSync, intl)}</span>
        </span>
        {error ? (
          <span className="text-rose-400">{t("status.offline")} · {error}</span>
        ) : (
          <span className="text-emerald-400">{t("status.online")}</span>
        )}
      </div>

      <div className="flex items-center gap-5">
        <div className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-wider tabular-nums">
          <span className="text-muted-foreground">{t("autopilot.counter.queued", { n: counts.queued })}</span>
          {counts.confirming > 0 && (
            <span className="text-amber-400">{t("autopilot.counter.confirm", { n: counts.confirming })}</span>
          )}
          {counts.executing > 0 && (
            <span className="text-primary">{t("autopilot.counter.exec", { n: counts.executing })}</span>
          )}
          <span className="text-emerald-400">{t("autopilot.counter.done", { n: counts.executed })}</span>
          <span className="text-muted-foreground">{t("autopilot.counter.skip", { n: counts.skipped })}</span>
        </div>

        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <Sparkles
                  className={`w-3.5 h-3.5 ${
                    demoMode ? "text-primary" : "text-muted-foreground"
                  }`}
                />
                <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                  {t("autopilot.demoMode")}
                </span>
                <Switch
                  checked={demoMode}
                  onCheckedChange={onToggleDemoMode}
                  aria-label={t("autopilot.demoMode")}
                />
              </label>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              {t("autopilot.demoTooltip")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </header>
  );
}
