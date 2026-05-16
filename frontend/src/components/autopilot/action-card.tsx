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
import type { TransferSuggestion } from "@/types/api";
import type { ActionState, ExecutedMeta } from "@/hooks/use-autopilot-state";

const EXECUTING_DURATION_MS = 1600;
const CONFIRM_TIMEOUT_MS = 5000;

export interface ActionCardProps {
  transfer: TransferSuggestion;
  meta: ExecutedMeta;
  onChange: (state: ActionState) => void;
}

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

export default function ActionCard({ transfer, meta, onChange }: ActionCardProps) {
  const state = meta.state;

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
            {formatMoney(transfer.amount, transfer.currency_from, {
              fractionDigits: 0,
            })}
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
          {transfer.initiate_by ? `by ${transfer.initiate_by}` : "ASAP"}
        </span>
        {transfer.requires_fx && (
          <>
            <span className="text-muted-foreground">·</span>
            <span className="text-amber-400">FX</span>
          </>
        )}
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        {transfer.rationale}
      </p>

      {transfer.notes.length > 0 && (
        <div className="text-[10px] font-mono text-amber-400/80 leading-snug border-l-2 border-amber-500/40 pl-2">
          {transfer.notes.join(" ")}
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
            Execute
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onChange("skipped")}
            className="gap-1.5 text-muted-foreground"
          >
            <X className="w-3.5 h-3.5" />
            Skip
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
            Confirm transfer?
          </div>
          <div className="text-[11px] font-mono text-foreground/80 leading-relaxed">
            Move{" "}
            <span className="font-semibold">
              {formatMoney(transfer.amount, transfer.currency_from, {
                fractionDigits: 0,
              })}
            </span>{" "}
            from <span className="font-semibold">{transfer.from_account}</span>{" "}
            to <span className="font-semibold">{transfer.to_account}</span> via{" "}
            <span className="text-primary">{transfer.rail}</span>
            {transfer.initiate_by ? `, initiate by ${transfer.initiate_by}` : ""}
            .
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              onClick={() => onChange("executing")}
              className="gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              Confirm execution
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onChange("queued")}
              className="text-muted-foreground"
            >
              Cancel
            </Button>
            <span className="ml-auto text-[10px] font-mono text-muted-foreground">
              auto-revert {Math.round(CONFIRM_TIMEOUT_MS / 1000)}s
            </span>
          </div>
        </motion.div>
      )}

      {state === "executing" && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-2 text-xs text-primary">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span className="font-mono uppercase tracking-wider">
              Executing on {transfer.rail}…
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
              Settled on {transfer.rail}
            </span>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground">
            {meta.executedAt
              ? new Date(meta.executedAt).toLocaleTimeString("en-US", {
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
            <span className="font-mono uppercase tracking-wider">Skipped</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onChange("queued")}
            className="text-[10px] h-6 px-2 text-muted-foreground"
          >
            Restore
          </Button>
        </div>
      )}
    </motion.article>
  );
}
