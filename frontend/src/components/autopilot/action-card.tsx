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
import { displayAccountLabel, formatMoney } from "@/lib/format";
import type { Alert, TransferSuggestion } from "@/types/api";
import type { ActionState, ExecutedMeta } from "@/hooks/use-autopilot-state";
import { useLocale, localeToIntl } from "@/i18n/locale-context";
import type { MessageKey } from "@/i18n/messages/en";
import {
  translateBackendAlert,
  translateBackendTransfer,
} from "@/i18n/translate-backend";
import { convertFx, fxRate } from "@/lib/fx";
import { pushExecuteEvent } from "@/lib/execute-events";

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

// Light-theme readable banner colours. The original `text-rose-300`
// was tuned for the dark mock-up and disappeared on the live light
// background. We pin the foreground to a 700/800-step shade so the
// severity label and the alert text stay readable on every locale.
const ALERT_BANNER_CLASS: Record<Alert["severity"], string> = {
  CRITICAL: "border-rose-500/50 bg-rose-50 text-rose-700",
  WARNING: "border-amber-500/50 bg-amber-50 text-amber-800",
  INFO: "border-primary/40 bg-primary/5 text-foreground",
};

// `repeating-linear-gradient` paints faint diagonal hatching so a
// skipped card still reads as 'put aside' even at opacity-70. The
// previous opacity-50 made the text effectively invisible.
const SKIPPED_STRIPE_STYLE: React.CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(135deg, rgba(0,0,0,0.04) 0 6px, transparent 6px 12px)",
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
      return "border-border bg-muted/30 opacity-70";
    default:
      return "border-border bg-card shadow-sm";
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

  // Push execute event to session store so Radar can animate violet planes
  const pushedRef = useRef(false);
  useEffect(() => {
    if (state === "executed" && !pushedRef.current) {
      pushedRef.current = true;
      pushExecuteEvent({
        from_account: transfer.from_account,
        to_account: transfer.to_account,
        amount: transfer.amount,
        currency: transfer.currency_from,
      });
    }
  }, [state, transfer]);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.25 }}
      className={`rounded-lg border px-5 py-4 space-y-3 ${stateClasses(state)}`}
      style={state === "skipped" ? SKIPPED_STRIPE_STYLE : undefined}
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
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <ArrowRightLeft className="w-4 h-4 text-primary shrink-0" />
          <div className="font-mono text-sm font-semibold truncate min-w-0">
            <span>{displayAccountLabel(transfer.from_account)}</span>
            <span className="text-muted-foreground mx-1.5">→</span>
            <span>{displayAccountLabel(transfer.to_account)}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono font-bold tabular-nums text-base leading-tight break-all">
            {amountStr}
          </div>
          <div className="text-[10px] font-mono text-muted-foreground">
            {transfer.currency_from}
            {transfer.requires_fx && (
              <span className="text-amber-500">
                {" "}
                → {transfer.currency_to}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider flex-wrap">
        <span className="px-1.5 py-0.5 rounded bg-card border border-border text-primary">
          {transfer.rail}
        </span>
        <span className="px-1.5 py-0.5 rounded bg-card border border-border text-muted-foreground inline-flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {transfer.initiate_by
            ? t("action.initiatePrefix", { date: transfer.initiate_by })
            : t("action.initiateAsap")}
        </span>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        {translateBackendTransfer(transfer, locale)}
      </p>

      {transfer.requires_fx && (
        <div className="text-[10px] font-mono text-amber-700 leading-snug border-l-2 border-amber-500/50 pl-2">
          ≈{" "}
          {formatMoney(
            convertFx(transfer.amount, transfer.currency_from, transfer.currency_to),
            transfer.currency_to,
            { fractionDigits: 0 },
            intl
          )}{" "}
          (1 {transfer.currency_from} = {fxRate(transfer.currency_from, transfer.currency_to).toFixed(2)}{" "}
          {transfer.currency_to})
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
          className="rounded-md border border-amber-500/50 bg-amber-50 p-3 space-y-2"
        >
          <div className="text-xs font-semibold text-amber-800">
            {t("action.confirmPrompt")}
          </div>
          <div className="text-[11px] font-mono text-foreground/80 leading-relaxed">
            {t("action.move", {
              amount: amountStr,
              from: displayAccountLabel(transfer.from_account),
              to: displayAccountLabel(transfer.to_account),
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
          <div className="flex items-center gap-2 text-emerald-700">
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
