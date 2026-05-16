"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import type { Alert, TransferSuggestion } from "@/types/api";
import { transferKey } from "@/lib/autopilot-synth";
import { useLocale, localeToIntl } from "@/i18n/locale-context";
import type { MessageKey } from "@/i18n/messages/en";
import { translateBackendAlert } from "@/i18n/translate-backend";
import type {
  ActionState,
  ExecutedMeta,
} from "@/hooks/use-autopilot-state";
import ActionCard from "./action-card";
import EmptyState from "./empty-state";

export interface ActionQueueProps {
  transfers: TransferSuggestion[];
  alerts: Alert[];
  actionStates: Record<string, ExecutedMeta>;
  onChange: (key: string, state: ActionState) => void;
  showEmptyState: boolean;
}

function bucketOf(state: ActionState): "active" | "executed" | "skipped" {
  if (state === "executed") return "executed";
  if (state === "skipped") return "skipped";
  return "active";
}

function alertKey(a: Alert): string {
  return `${a.account_id}|${a.breach_date}|${a.severity}`;
}

// Mirror action-card.tsx ALERT_BANNER_CLASS so alerts read the same
// whether they ride alongside a transfer or sit in the info-only stack.
const INFO_BANNER_CLASS: Record<Alert["severity"], string> = {
  CRITICAL: "border-rose-500/50 bg-rose-50 text-rose-700",
  WARNING: "border-amber-500/50 bg-amber-50 text-amber-800",
  INFO: "border-primary/40 bg-primary/5 text-foreground",
};

export default function ActionQueue({
  transfers,
  alerts,
  actionStates,
  onChange,
  showEmptyState,
}: ActionQueueProps) {
  const { t, locale } = useLocale();
  const intl = localeToIntl(locale);
  const [executedOpen, setExecutedOpen] = useState(true);
  const [skippedOpen, setSkippedOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Pair each transfer with its matching alert by destination account.
  // First match wins; alerts without a counterpart land in the info-only
  // section at the bottom of the queue.
  const { alertByAccount, infoOnlyAlerts } = useMemo(() => {
    const byAccount = new Map<string, Alert>();
    for (const a of alerts) {
      if (!byAccount.has(a.account_id)) byAccount.set(a.account_id, a);
    }
    const transferAccounts = new Set(transfers.map((tr) => tr.to_account));
    const infoOnly = alerts.filter(
      (a) => !transferAccounts.has(a.account_id) && !dismissed.has(alertKey(a))
    );
    return { alertByAccount: byAccount, infoOnlyAlerts: infoOnly };
  }, [alerts, transfers, dismissed]);

  const decorated = transfers.map((tr) => {
    const key = transferKey(tr);
    const meta = actionStates[key] ?? { state: "queued" as ActionState };
    return { key, transfer: tr, meta, alert: alertByAccount.get(tr.to_account) ?? null };
  });

  const active = decorated.filter((d) => bucketOf(d.meta.state) === "active");
  const executed = decorated.filter((d) => bucketOf(d.meta.state) === "executed");
  const skipped = decorated.filter((d) => bucketOf(d.meta.state) === "skipped");

  const queueIsEmpty = transfers.length === 0 && infoOnlyAlerts.length === 0;

  const dismissAlert = (a: Alert) =>
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(alertKey(a));
      return next;
    });

  return (
    <section className="flex flex-col h-full rounded-2xl glass-card overflow-hidden">
      <header className="h-14 shrink-0 px-6 flex items-center justify-between border-b border-slate-200/80 bg-white/40">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/80">
          {t("autopilot.queue.section")}
        </span>
        <span className="text-xs font-medium text-slate-500 tabular-nums bg-white/60 px-3 py-1 rounded-full border border-slate-200/60 shadow-sm">
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
                  alert={d.alert}
                  onChange={(s) => onChange(d.key, s)}
                />
              ))}
            </AnimatePresence>

            {active.length === 0 &&
              infoOnlyAlerts.length === 0 &&
              (executed.length > 0 || skipped.length > 0) && (
                <div className="text-xs text-muted-foreground text-center py-4">
                  {t("autopilot.queue.allResolved")}
                </div>
              )}

            {executed.length > 0 && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setExecutedOpen((v) => !v)}
                  className="w-full flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-emerald-700 hover:text-emerald-800 py-1"
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
                          alert={d.alert}
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
                          alert={d.alert}
                          onChange={(s) => onChange(d.key, s)}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            )}

            {infoOnlyAlerts.length > 0 && (
              <div className="pt-2 space-y-2">
                <div className="text-[10px] font-mono uppercase tracking-wider text-amber-800">
                  {t("autopilot.queue.infoSection", {
                    n: infoOnlyAlerts.length,
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground leading-snug">
                  {t("autopilot.queue.infoSectionHint")}
                </p>
                <AnimatePresence mode="popLayout">
                  {infoOnlyAlerts.map((a) => (
                    <motion.div
                      key={alertKey(a)}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 24 }}
                      transition={{ duration: 0.2 }}
                      className={`rounded-md px-3 py-2 border ${INFO_BANNER_CLASS[a.severity]}`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-widest">
                            {t(`severity.${a.severity}` as MessageKey)}
                          </span>
                          <span className="text-[10px] font-mono opacity-70">
                            {a.account_id} ·{" "}
                            {t("autopilot.alerts.inDays", {
                              n: a.days_until_breach,
                            })}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => dismissAlert(a)}
                          aria-label={t("autopilot.alerts.dismiss")}
                          className="opacity-60 hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-xs leading-relaxed">
                        {translateBackendAlert(a, locale)}
                      </p>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
