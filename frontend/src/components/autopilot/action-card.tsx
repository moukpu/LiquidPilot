"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  ArrowRightLeft,
  Check,
  Clock,
  Loader2,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import type { Alert, TransferSuggestion } from "@/types/api";
import type { ActionState, ExecutedMeta } from "@/hooks/use-autopilot-state";
import { useLocale, localeToIntl } from "@/i18n/locale-context";
import type { MessageKey } from "@/i18n/messages/en";
import {
  translateBackendAlert,
  translateBackendNote,
  translateBackendTransfer,
} from "@/i18n/translate-backend";

const EXECUTING_DURATION_MS = 1600;
const CONFIRM_TIMEOUT_MS = 5000;

export interface ActionCardProps {
  transfer: TransferSuggestion;
  meta: ExecutedMeta;
  onChange: (state: ActionState) => void;
  /** Optional alert paired to this transfer (rendered as a banner above the
   *  transfer rows). When null the card shows just the proposed action. */
  alert?: Alert | null;
}

const ALERT_BANNER_CLASS: Record<Alert["severity"], string> = {
  CRITICAL: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  WARNING: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  INFO: "border-primary/30 bg-primary/5 text-primary",
};

function stateClasses(state: ActionState) {
  switch (state) {
    case "confirming":
      return "border-amber-500/50 bg-amber-500/5";
    case "executing":
      return "border-primary/60 bg-primary/5";
    case "executed":
      return "border-emerald-500/40 bg-emerald-500/5 opacity-80";
    case "skipped":
      return "border-border bg-muted/30 opacity-50";
    default:
      return "border-border bg-card";
  }
}

export default function ActionCard({
  transfer,
  meta,
  onChange,
  alert = null,
}: ActionCardProps) {
  const { t, locale } = useLocale();
  const intl = localeToIntl(locale);
  const state = meta.state;
  const amountStr = formatMoney(transfer.amount, transfer.currency_from, { fractionDigits: 0 }, intl);
  const initiateByStr = transfer.initiate_by
    ? t("action.initiateBy", { date: transfer.initiate_by })
    : "";
  const note = translateBackendNote(transfer, locale);

  // Auto-revert from confirming → queued after timeout
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (state === "confirming") {
      timeoutRef.current = setTimeout(() => {
        onChange("queued");
      }, CONFIRM_TIMEOUT_MS);
    }
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [state, onChange]);

  // Auto-advance executing → executed after progress fill
  useEffect(() => {
    if (state === "executing") {
      const t = setTimeout(() => {
        onChange("executed");
      }, EXECUTING_DURATION_MS);
      return () => clearTimeout(t);
    }
  }, [state, onChange]);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.25 }}
      className={`rounded-lg border p-4 space-y-3 ${stateClasses(state)}`}
    >
      {alert && (
        <div
          className={`rounded-md px-3 py-2 border ${ALERT_BANNER_CLASS[alert.severity]}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest">
              {t(`severity.${alert.severity}` as MessageKey)}
            </span>
            <span className="text-[10px] font-mono opacity-70">
              {t("autopilot.alerts.inDays", { n: alert.days_until_breach })}
            </span>
          </div>
          <p className="text-xs leading-relaxed">
            {translateBackendAlert(alert, locale)}
          </p>
          <div className="text-[10px] font-mono mt-1.5 opacity-80">
            {t("autopilot.alerts.shortfall")}:{" "}
            {formatMoney(
              alert.shortfall,
              alert.currency,
              { fractionDigits: 0 },
              intl
            )}
          </div>
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <ArrowRightLeft className="w-4 h-4 text-primary shrink-0" />
          <div className="font-mono text-sm font-semibold truncate">
            <span>{transfer.from_account}</span>
            <span className="text-muted-foreground mx-1.5">→</span>
            <span>{transfer.to_account}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono font-bold tabular-nums text-base leading-tight">
            {amountStr}
          </div>
          <div className="text-[10px] font-mono text-muted-foreground">
            {transfer.currency_from}
            {transfer.requires_fx && (
              <span className="text-amber-400">
                {" "}
                → {transfer.currency_to}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-wider">
        <span className="text-primary">{transfer.rail}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground inline-flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {transfer.initiate_by
            ? t("action.initiatePrefix", { date: transfer.initiate_by })
            : t("action.initiateAsap")}
        </span>
        {transfer.requires_fx && (
          <>
            <span className="text-muted-foreground">·</span>
            <span className="text-amber-400">{t("action.fxBadge")}</span>
          </>
        )}
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        {translateBackendTransfer(transfer, locale)}
      </p>

      {note && (
        <div className="text-[10px] font-mono text-amber-400/80 leading-snug border-l-2 border-amber-500/40 pl-2">
          {note}
        </div>
      )}

      {state === "queued" && (
        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            onClick={() => onChange("confirming")}
            className="gap-1.5"
          >
            <Zap className="w-3.5 h-3.5" />
            {t("action.execute")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onChange("skipped")}
            className="gap-1.5 text-muted-foreground"
          >
            <X className="w-3.5 h-3.5" />
            {t("action.skip")}
          </Button>
        </div>
      )}

      {state === "confirming" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 space-y-2"
        >
          <div className="text-xs font-medium text-amber-300">
            {t("action.confirmPrompt")}
          </div>
          <div className="text-[11px] font-mono text-foreground/80 leading-relaxed">
            {t("action.move", {
              amount: amountStr,
              from: transfer.from_account,
              to: transfer.to_account,
              rail: transfer.rail,
              initiateBy: initiateByStr,
            })}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              onClick={() => onChange("executing")}
              className="gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              {t("action.confirmExecution")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onChange("queued")}
              className="text-muted-foreground"
            >
              {t("action.cancel")}
            </Button>
            <span className="ml-auto text-[10px] font-mono text-muted-foreground">
              {t("action.autoRevert", { n: Math.round(CONFIRM_TIMEOUT_MS / 1000) })}
            </span>
          </div>
        </motion.div>
      )}

      {state === "executing" && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-2 text-xs text-primary">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span className="font-mono uppercase tracking-wider">
              {t("action.executingOn", { rail: transfer.rail })}
            </span>
          </div>
          <div className="h-1 w-full rounded-full bg-primary/10 overflow-hidden">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{
                duration: EXECUTING_DURATION_MS / 1000,
                ease: "linear",
              }}
            />
          </div>
        </div>
      )}

      {state === "executed" && (
        <div className="flex items-center justify-between gap-2 pt-1 text-xs">
          <div className="flex items-center gap-2 text-emerald-400">
            <Check className="w-4 h-4" />
            <span className="font-mono uppercase tracking-wider">
              {t("action.settledOn", { rail: transfer.rail })}
            </span>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground">
            {meta.executedAt
              ? new Date(meta.executedAt).toLocaleTimeString(intl, {
                  hour12: false,
                })
              : ""}
          </span>
        </div>
      )}

      {state === "skipped" && (
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <X className="w-3.5 h-3.5" />
            <span className="font-mono uppercase tracking-wider">{t("action.skipped")}</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onChange("queued")}
            className="text-[10px] h-6 px-2 text-muted-foreground"
          >
            {t("action.restore")}
          </Button>
        </div>
      )}
    </motion.article>
  );
}
