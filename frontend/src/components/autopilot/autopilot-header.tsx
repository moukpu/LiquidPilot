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
  return (
    <header className="h-14 shrink-0 border-b border-border bg-card/40 backdrop-blur-sm flex items-center px-6 gap-6">
      <div className="flex flex-col leading-tight">
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary">
          Autopilot · Command Center
        </span>
        <span className="text-sm font-semibold">Action queue & risk telemetry</span>
      </div>

      <div className="flex-1 flex items-center justify-center gap-4 text-[11px] font-mono">
        <span className="text-muted-foreground">
          Last sync <span className="text-foreground">{formatTime(lastSync)}</span>
        </span>
        {error ? (
          <span className="text-rose-400">offline · {error}</span>
        ) : (
          <span className="text-emerald-400">online</span>
        )}
      </div>

      <div className="flex items-center gap-5">
        <div className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-wider">
          <span className="text-muted-foreground">
            <span className="text-foreground tabular-nums">{counts.queued}</span> queued
          </span>
          {counts.confirming > 0 && (
            <span className="text-amber-400">
              <span className="tabular-nums">{counts.confirming}</span> confirm
            </span>
          )}
          {counts.executing > 0 && (
            <span className="text-primary">
              <span className="tabular-nums">{counts.executing}</span> exec
            </span>
          )}
          <span className="text-emerald-400">
            <span className="tabular-nums">{counts.executed}</span> done
          </span>
          <span className="text-muted-foreground">
            <span className="tabular-nums">{counts.skipped}</span> skip
          </span>
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
                  Demo Mode
                </span>
                <Switch
                  checked={demoMode}
                  onCheckedChange={onToggleDemoMode}
                  aria-label="Toggle demo mode"
                />
              </label>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              Synthesizes alerts and transfers from current account data for
              presentation purposes — no real backend trigger.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </header>
  );
}
