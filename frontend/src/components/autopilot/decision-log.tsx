"use client";

import { Bot, Check, MinusCircle, Pause } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocale, localeToIntl } from "@/i18n/locale-context";
import { displayAccountLabel, formatMoney } from "@/lib/format";
import type { DecisionLogEntry } from "@/hooks/use-autopilot-state";

interface Props {
  entries: DecisionLogEntry[];
  autoMode: boolean;
  onClear: () => void;
}

export default function DecisionLog({ entries, autoMode, onClear }: Props) {
  const { t, locale } = useLocale();
  const intl = localeToIntl(locale);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white/70 backdrop-blur-sm shadow-sm flex flex-col overflow-hidden">
      <header className="px-5 py-3 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-primary" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-700">
            {t("autopilot.log.title")}
          </span>
          {autoMode && (
            <span className="ml-2 inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-emerald-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              live
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-muted-foreground">
            {t("autopilot.log.shown", { n: entries.length })}
          </span>
          {entries.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="text-[10px] font-mono uppercase tracking-wider text-slate-400 hover:text-slate-700"
            >
              {t("autopilot.log.clear")}
            </button>
          )}
        </div>
      </header>

      <div className="max-h-64 overflow-auto px-5 py-3 space-y-2">
        {entries.length === 0 ? (
          <p className="text-[11px] text-muted-foreground leading-relaxed py-2">
            {t("autopilot.log.empty")}
          </p>
        ) : (
          <AnimatePresence initial={false}>
            {entries.map((e) => (
              <motion.div
                key={e.id}
                layout
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-start gap-3 text-[11px]"
              >
                <span className="font-mono text-[10px] text-slate-400 shrink-0 mt-0.5">
                  {new Date(e.at).toLocaleTimeString(intl, { hour12: false })}
                </span>
                {e.kind === "executed" && (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <p className="text-slate-700 leading-snug">
                      {t("autopilot.log.executed", {
                        amount:
                          e.amount != null && e.currency
                            ? formatMoney(
                                e.amount,
                                e.currency,
                                { fractionDigits: 0 },
                                intl
                              )
                            : "?",
                        from: displayAccountLabel(e.from ?? ""),
                        to: displayAccountLabel(e.to ?? ""),
                        rail: e.rail ?? "?",
                        date: e.date ?? "—",
                      })}
                    </p>
                  </>
                )}
                {e.kind === "skipped" && (
                  <>
                    <MinusCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-slate-700 leading-snug">
                      {t("autopilot.log.skipped", {
                        amount:
                          e.amount != null && e.currency
                            ? formatMoney(
                                e.amount,
                                e.currency,
                                { fractionDigits: 0 },
                                intl
                              )
                            : "?",
                        from: displayAccountLabel(e.from ?? ""),
                        to: displayAccountLabel(e.to ?? ""),
                        rail: e.rail ?? "?",
                      })}
                    </p>
                  </>
                )}
                {e.kind === "noAction" && (
                  <>
                    <Pause className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <p className="text-slate-500 leading-snug">
                      {t("autopilot.log.noAction", {
                        n: e.scannedAccounts ?? 0,
                      })}
                    </p>
                  </>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </section>
  );
}
