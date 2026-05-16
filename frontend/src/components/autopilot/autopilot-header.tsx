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
  /** When true, draws a soft pulsing primary-coloured ring around the
   *  Demo Mode switch. Used to nudge the user when the queue is empty
   *  because Demo is off but accounts have loaded. */
  demoHint?: boolean;
}

export default function AutopilotHeader({
  demoMode,
  onToggleDemoMode,
  lastSync,
  error,
  counts,
  demoHint = false,
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
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground tabular-nums">
          {t("autopilot.header.statusLine", {
            pending: counts.queued + counts.confirming + counts.executing,
            resolved: counts.executed + counts.skipped,
          })}
        </span>

        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <label
                className={`flex items-center gap-2 cursor-pointer select-none rounded-full px-2 py-1 transition-shadow ${
                  demoHint
                    ? "ring-2 ring-primary/40 animate-pulse"
                    : ""
                }`}
              >
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
