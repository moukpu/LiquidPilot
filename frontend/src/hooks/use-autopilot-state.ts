"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAccounts } from "@/lib/api";
import { nextSituation, transferKey } from "@/lib/autopilot-synth";
import type {
  Account,
  Alert,
  TransferSuggestion,
} from "@/types/api";

export type ActionState =
  | "queued"
  | "confirming"
  | "executing"
  | "executed"
  | "skipped";

export interface ExecutedMeta {
  state: ActionState;
  executedAt?: string;
}

const ACTIONS_KEY = "autopilot-actions";
const DEMO_KEY = "autopilot-demo-mode";
const AUTO_KEY = "autopilot-auto-mode";

// Cadence at which AI Pilot scans the queue and executes the highest-
// priority pending transfer. 4s feels alive without overwhelming the eye.
const AUTO_TICK_MS = 4000;

// Hard cap on the log so a long demo session doesn't blow sessionStorage.
const LOG_LIMIT = 50;

export interface DecisionLogEntry {
  id: string;
  at: string;
  kind: "executed" | "skipped" | "noAction";
  /** Optional transfer fields for executed/skipped. */
  amount?: number;
  currency?: string;
  from?: string;
  to?: string;
  rail?: string;
  date?: string;
  scannedAccounts?: number;
}

// Initial situations dropped into the queue the moment demo flips on, so
// the user sees a populated queue immediately rather than waiting for the
// first emission tick.
const SEED_COUNT = 3;

// Cadence for new emissions while demo is on. Tight enough to feel like
// a live ops queue, loose enough that the user can act on a card before
// the next one lands.
const EMIT_INTERVAL_MS = 9000;

// Max concurrent unresolved (queued/confirming/executing) situations.
// When the active queue hits this, emissions pause until the user works
// some down. Prevents runaway pileups during long demos.
const ACTIVE_CAP = 6;

// Severity priority used for "upgrade on merge" decisions. A CRITICAL
// landing in a country that already has a WARNING upgrades the merged
// card to CRITICAL; the inverse is a no-op.
const SEV_RANK: Record<Alert["severity"], number> = {
  CRITICAL: 3,
  WARNING: 2,
  INFO: 1,
};

function readActions(): Record<string, ExecutedMeta> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(ACTIONS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, ExecutedMeta>;
  } catch {
    return {};
  }
}

function writeActions(map: Record<string, ExecutedMeta>) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(ACTIONS_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

function readDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(DEMO_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDemoMode(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(DEMO_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function readAutoMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(AUTO_KEY) === "1";
  } catch {
    return false;
  }
}

function writeAutoMode(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(AUTO_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export interface AutopilotState {
  accounts: Account[];
  alerts: Alert[];
  transfers: TransferSuggestion[];
  actionStates: Record<string, ExecutedMeta>;
  setActionState: (key: string, state: ActionState) => void;
  demoMode: boolean;
  toggleDemoMode: (on: boolean) => void;
  autoMode: boolean;
  toggleAutoMode: (on: boolean) => void;
  decisionLog: DecisionLogEntry[];
  clearLog: () => void;
  lastSync: Date | null;
  error: string | null;
  loading: boolean;
}

export function useAutopilotState(interval = 2000): AutopilotState {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionStates, setActionStates] = useState<Record<string, ExecutedMeta>>(
    {}
  );
  const [demoMode, setDemoMode] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const [decisionLog, setDecisionLog] = useState<DecisionLogEntry[]>([]);

  // Demo situations live in component state (not derived) so newly emitted
  // ones stick around until the user resolves them, and successive emissions
  // accumulate instead of overwriting the previous batch.
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [transfers, setTransfers] = useState<TransferSuggestion[]>([]);

  const flyingRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);
  // Latest values mirrored into refs so the emission interval can read them
  // without re-creating itself on every state change.
  const accountsRef = useRef<Account[]>([]);
  const actionStatesRef = useRef<Record<string, ExecutedMeta>>({});
  const transfersRef = useRef<TransferSuggestion[]>([]);
  const alertsRef = useRef<Alert[]>([]);
  // Guard so we seed exactly once per demo-on session — survives React
  // StrictMode's double-invoke of effects in dev and any hydration path
  // that sets demoMode without going through toggleDemoMode.
  const hasSeededRef = useRef(false);

  useEffect(() => {
    accountsRef.current = accounts;
  }, [accounts]);
  useEffect(() => {
    actionStatesRef.current = actionStates;
  }, [actionStates]);
  useEffect(() => {
    transfersRef.current = transfers;
  }, [transfers]);
  useEffect(() => {
    alertsRef.current = alerts;
  }, [alerts]);

  // Hydrate from sessionStorage on mount
  useEffect(() => {
    setActionStates(readActions());
    setDemoMode(readDemoMode());
    setAutoMode(readAutoMode());
  }, []);

  const setActionState = useCallback((key: string, state: ActionState) => {
    setActionStates((prev) => {
      const next = { ...prev };
      if (state === "executed") {
        next[key] = { state, executedAt: new Date().toISOString() };
      } else {
        next[key] = { state };
      }
      writeActions(next);
      return next;
    });
  }, []);

  const toggleDemoMode = useCallback((on: boolean) => {
    setDemoMode(on);
    writeDemoMode(on);
    if (!on) {
      // Wipe the queue immediately so the UI snaps back to the empty
      // state instead of holding stale demo cards.
      setAlerts([]);
      setTransfers([]);
      hasSeededRef.current = false;
    }
  }, []);

  const toggleAutoMode = useCallback((on: boolean) => {
    setAutoMode(on);
    writeAutoMode(on);
  }, []);

  const clearLog = useCallback(() => {
    setDecisionLog([]);
  }, []);

  const appendLog = useCallback((entry: DecisionLogEntry) => {
    setDecisionLog((prev) => {
      const next = [entry, ...prev];
      if (next.length > LOG_LIMIT) next.length = LOG_LIMIT;
      return next;
    });
  }, []);

  const poll = useCallback(async () => {
    if (flyingRef.current) return;
    flyingRef.current = true;

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const accountsResult = await getAccounts(controller.signal);
      setAccounts(accountsResult);
      setLastSync(new Date());
      setError(null);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message);
      }
    } finally {
      flyingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, interval);
    return () => {
      clearInterval(id);
      controllerRef.current?.abort();
    };
  }, [poll, interval]);

  // Compute which recipients currently have an *active* (not executed,
  // not skipped) situation. We exclude these when emitting new ones so
  // the queue doesn't stack three CRITICALs on the same account.
  const activeRecipients = useCallback((): Set<string> => {
    const states = actionStatesRef.current;
    const trs = transfersRef.current;
    const active = new Set<string>();
    for (const a of alertsRef.current) {
      const tr = trs.find((t) => t.to_account === a.account_id);
      if (!tr) {
        // INFO-only alert with no paired transfer — treat as active until
        // dismissed in the action-queue UI. The component owns dismiss
        // state, so from the hook's view it's always live.
        active.add(a.account_id);
        continue;
      }
      const meta = states[transferKey(tr)];
      const state = meta?.state ?? "queued";
      if (state !== "executed" && state !== "skipped") {
        active.add(a.account_id);
      }
    }
    return active;
  }, []);

  // Seed the queue on demo enable. Runs the first time demo is on with
  // enough accounts to synth — hasSeededRef makes it idempotent across
  // StrictMode double-invokes and across the accounts-poll re-runs.
  useEffect(() => {
    if (!demoMode) {
      hasSeededRef.current = false;
      return;
    }
    if (hasSeededRef.current) return;
    if (accounts.length < 2) return;

    const seededAlerts: Alert[] = [];
    const seededTransfers: TransferSuggestion[] = [];
    const used = new Set<string>();
    for (let i = 0; i < SEED_COUNT; i++) {
      const s = nextSituation(accounts, used);
      if (!s) break;
      used.add(s.alert.account_id);
      seededAlerts.push(s.alert);
      if (s.transfer) seededTransfers.push(s.transfer);
    }
    if (seededAlerts.length > 0) {
      hasSeededRef.current = true;
      setAlerts(seededAlerts);
      setTransfers(seededTransfers);
    }
  }, [demoMode, accounts]);

  // Find the recipient account's country, or null if not in the fleet.
  const countryOf = useCallback((accountId: string): string | null => {
    const acc = accountsRef.current.find((a) => a.account_id === accountId);
    return acc?.country ?? null;
  }, []);

  // Locate an existing ACTIVE alert in the same country, so we can merge
  // a duplicate emission into it instead of stacking a second card.
  const findActiveInCountry = useCallback(
    (country: string, alerts: Alert[]): number => {
      const trs = transfersRef.current;
      const states = actionStatesRef.current;
      return alerts.findIndex((a) => {
        if (countryOf(a.account_id) !== country) return false;
        const tr = trs.find((t) => t.to_account === a.account_id);
        if (!tr) return true; // info-only counts as active
        const meta = states[transferKey(tr)];
        const state = meta?.state ?? "queued";
        return state !== "executed" && state !== "skipped";
      });
    },
    [countryOf]
  );

  // Periodic emission. One new situation every EMIT_INTERVAL_MS while
  // demo is on, capped at ACTIVE_CAP unresolved entries. Reads latest
  // state via refs so the interval doesn't churn on every keystroke /
  // every action-state update.
  useEffect(() => {
    if (!demoMode) return;
    const id = setInterval(() => {
      if (accountsRef.current.length < 2) return;
      const active = activeRecipients();
      if (active.size >= ACTIVE_CAP) return;
      const s = nextSituation(accountsRef.current, active);
      if (!s) return;

      const country = countryOf(s.alert.account_id);
      const existingIdx =
        country !== null
          ? findActiveInCountry(country, alertsRef.current)
          : -1;

      if (existingIdx < 0) {
        // Fresh country — append the new situation as its own card.
        setAlerts((prev) => [...prev, s.alert]);
        if (s.transfer) {
          setTransfers((prev) => [...prev, s.transfer!]);
        }
        return;
      }

      // Same-country duplicate — merge into the existing active card so
      // the user sees the existing situation grow rather than a second
      // near-identical row. Bump shortfall + (if applicable) transfer
      // amount; upgrade severity if the new emission is worse; pull the
      // breach date earlier if it lands sooner.
      const ex = alertsRef.current[existingIdx];
      const mergedSeverity =
        SEV_RANK[s.alert.severity] > SEV_RANK[ex.severity]
          ? s.alert.severity
          : ex.severity;
      const earlierDays = Math.min(ex.days_until_breach, s.alert.days_until_breach);
      const mergedAlert: Alert = {
        ...ex,
        severity: mergedSeverity,
        shortfall: ex.shortfall + s.alert.shortfall,
        days_until_breach: earlierDays,
        breach_date:
          ex.days_until_breach <= s.alert.days_until_breach
            ? ex.breach_date
            : s.alert.breach_date,
        projected_balance: ex.projected_balance - s.alert.shortfall,
      };
      setAlerts((prev) => {
        const next = [...prev];
        next[existingIdx] = mergedAlert;
        return next;
      });

      // If the existing situation has a paired transfer, bump its amount.
      // Migrate the actionStates key in the same batch because
      // transferKey embeds amount — without migration the user's prior
      // "queued"/"confirming" state would orphan and the card would
      // reset to queued.
      if (s.transfer) {
        const existingTr = transfersRef.current.find(
          (t) => t.to_account === ex.account_id
        );
        if (existingTr) {
          const oldKey = transferKey(existingTr);
          const bumped: TransferSuggestion = {
            ...existingTr,
            amount: existingTr.amount + s.transfer.amount,
          };
          const newKey = transferKey(bumped);
          setTransfers((prev) => {
            const next = [...prev];
            const idx = next.findIndex(
              (t) => transferKey(t) === oldKey
            );
            if (idx < 0) return next;
            next[idx] = bumped;
            return next;
          });
          if (oldKey !== newKey) {
            setActionStates((prev) => {
              const meta = prev[oldKey];
              if (!meta) return prev;
              const next = { ...prev };
              delete next[oldKey];
              next[newKey] = meta;
              writeActions(next);
              return next;
            });
          }
        } else {
          // Existing situation was alert-only (INFO upgraded to
          // CRITICAL/WARNING by this merge). Add the new transfer.
          setTransfers((prev) => [...prev, s.transfer!]);
        }
      }
    }, EMIT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [demoMode, activeRecipients, countryOf, findActiveInCountry]);

  // Discard stale action-state keys for transfers no longer in the queue.
  // Keeps sessionStorage from growing unbounded as demo emissions churn.
  useEffect(() => {
    const validKeys = new Set(transfers.map(transferKey));
    setActionStates((prev) => {
      let dirty = false;
      const next: Record<string, ExecutedMeta> = {};
      for (const k of Object.keys(prev)) {
        if (validKeys.has(k)) {
          next[k] = prev[k];
        } else {
          dirty = true;
        }
      }
      if (dirty) {
        writeActions(next);
        return next;
      }
      return prev;
    });
  }, [transfers]);

  // Mirror autoMode + log triggers into refs so the AI loop reads
  // current values without re-creating its interval every render.
  const autoModeRef = useRef(false);
  const decisionLogRef = useRef<DecisionLogEntry[]>([]);
  useEffect(() => {
    autoModeRef.current = autoMode;
  }, [autoMode]);
  useEffect(() => {
    decisionLogRef.current = decisionLog;
  }, [decisionLog]);

  // AI Pilot loop: every AUTO_TICK_MS, pick the highest-severity active
  // transfer in the queue and push it to "executing". The action card's
  // own effect will then auto-advance it to "executed" after its
  // animation finishes. We log the decision so the operator can audit
  // what the AI did.
  useEffect(() => {
    if (!autoMode) return;
    const id = setInterval(() => {
      const states = actionStatesRef.current;
      const trs = transfersRef.current;
      const als = alertsRef.current;

      // Find highest-severity queued transfer.
      const candidates = trs
        .map((tr) => {
          const meta = states[transferKey(tr)];
          const state = meta?.state ?? "queued";
          if (state !== "queued" && state !== "confirming") return null;
          const alert = als.find((a) => a.account_id === tr.to_account);
          const sev = alert ? SEV_RANK[alert.severity] : 0;
          return { tr, sev, alert };
        })
        .filter((x): x is { tr: TransferSuggestion; sev: number; alert: Alert | undefined } => x !== null)
        .sort((a, b) => b.sev - a.sev);

      if (candidates.length === 0) {
        // Only log idle ticks occasionally so the log doesn't fill with
        // "noAction" entries during a long quiet stretch.
        const last = decisionLogRef.current[0];
        if (!last || last.kind !== "noAction") {
          appendLog({
            id: `noaction-${Date.now()}`,
            at: new Date().toISOString(),
            kind: "noAction",
            scannedAccounts: accountsRef.current.length,
          });
        }
        return;
      }

      const winner = candidates[0];
      const key = transferKey(winner.tr);
      setActionStates((prev) => {
        const next = { ...prev, [key]: { state: "executing" as ActionState } };
        writeActions(next);
        return next;
      });
      appendLog({
        id: `${key}-${Date.now()}`,
        at: new Date().toISOString(),
        kind: "executed",
        amount: winner.tr.amount,
        currency: winner.tr.currency_from,
        from: winner.tr.from_account,
        to: winner.tr.to_account,
        rail: winner.tr.rail,
        date: winner.alert?.breach_date,
      });
    }, AUTO_TICK_MS);
    return () => clearInterval(id);
  }, [autoMode, appendLog]);

  return {
    accounts,
    alerts,
    transfers,
    actionStates,
    setActionState,
    demoMode,
    toggleDemoMode,
    autoMode,
    toggleAutoMode,
    decisionLog,
    clearLog,
    lastSync,
    error,
    loading,
  };
}
