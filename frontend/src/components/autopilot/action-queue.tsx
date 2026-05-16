"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { TransferSuggestion } from "@/types/api";
import { transferKey } from "@/lib/autopilot-synth";
import { useT } from "@/i18n/locale-context";
import type {
  ActionState,
  ExecutedMeta,
} from "@/hooks/use-autopilot-state";
import ActionCard from "./action-card";
import EmptyState from "./empty-state";

export interface ActionQueueProps {
  transfers: TransferSuggestion[];
  actionStates: Record<string, ExecutedMeta>;
  onChange: (key: string, state: ActionState) => void;
  showEmptyState: boolean;
}

function bucketOf(state: ActionState): "active" | "executed" | "skipped" {
  if (state === "executed") return "executed";
  if (state === "skipped") return "skipped";
  return "active";
}

export default function ActionQueue({
  transfers,
  actionStates,
  onChange,
  showEmptyState,
}: ActionQueueProps) {
  const t = useT();
  const [executedOpen, setExecutedOpen] = useState(true);
  const [skippedOpen, setSkippedOpen] = useState(false);

  const decorated = transfers.map((t) => {
    const key = transferKey(t);
    const meta = actionStates[key] ?? { state: "queued" as ActionState };
    return { key, transfer: t, meta };
  });

  const active = decorated.filter((d) => bucketOf(d.meta.state) === "active");
  const executed = decorated.filter((d) => bucketOf(d.meta.state) === "executed");
  const skipped = decorated.filter((d) => bucketOf(d.meta.state) === "skipped");

  const queueIsEmpty = transfers.length === 0;

  return (
    <section className="flex flex-col min-h-0 rounded-lg border border-border bg-card/30 overflow-hidden">
      <header className="h-10 shrink-0 px-4 flex items-center justify-between border-b border-border">
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary">
          {t("autopilot.queue.section")}
        </span>
        <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
          {t("autopilot.queue.summary", {
            active: active.length,
            done: executed.length,
            skipped: skipped.length,
          })}
        </span>
      </header>

      <div className="flex-1 min-h-0 overflow-auto p-4 space-y-3">
        {queueIsEmpty && showEmptyState ? (
          <EmptyState />
        ) : queueIsEmpty ? (
          <div className="text-xs text-muted-foreground text-center py-8">
            {t("autopilot.queue.empty")}
          </div>
        ) : (
          <>
            <AnimatePresence mode="popLayout">
              {active.map((d) => (
                <ActionCard
                  key={d.key}
                  transfer={d.transfer}
                  meta={d.meta}
                  onChange={(s) => onChange(d.key, s)}
                />
              ))}
            </AnimatePresence>

            {active.length === 0 && (executed.length > 0 || skipped.length > 0) && (
              <div className="text-xs text-muted-foreground text-center py-4">
                {t("autopilot.queue.allResolved")}
              </div>
            )}

            {executed.length > 0 && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setExecutedOpen((v) => !v)}
                  className="w-full flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-emerald-400/80 hover:text-emerald-400 py-1"
                >
                  {executedOpen ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                  {t("autopilot.queue.recentlyExecuted", { n: executed.length })}
                </button>
                {executedOpen && (
                  <div className="space-y-2 mt-2">
                    <AnimatePresence mode="popLayout">
                      {executed.map((d) => (
                        <ActionCard
                          key={d.key}
                          transfer={d.transfer}
                          meta={d.meta}
                          onChange={(s) => onChange(d.key, s)}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            )}

            {skipped.length > 0 && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setSkippedOpen((v) => !v)}
                  className="w-full flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground py-1"
                >
                  {skippedOpen ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                  {t("autopilot.queue.skippedSection", { n: skipped.length })}
                </button>
                {skippedOpen && (
                  <div className="space-y-2 mt-2">
                    <AnimatePresence mode="popLayout">
                      {skipped.map((d) => (
                        <ActionCard
                          key={d.key}
                          transfer={d.transfer}
                          meta={d.meta}
                          onChange={(s) => onChange(d.key, s)}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
