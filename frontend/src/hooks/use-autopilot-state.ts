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

export interface AutopilotState {
  accounts: Account[];
  alerts: Alert[];
  transfers: TransferSuggestion[];
  actionStates: Record<string, ExecutedMeta>;
  setActionState: (key: string, state: ActionState) => void;
  demoMode: boolean;
  toggleDemoMode: (on: boolean) => void;
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
      setAlerts((prev) => [...prev, s.alert]);
      if (s.transfer) {
        setTransfers((prev) => [...prev, s.transfer!]);
      }
    }, EMIT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [demoMode, activeRecipients]);

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

  return {
    accounts,
    alerts,
    transfers,
    actionStates,
    setActionState,
    demoMode,
    toggleDemoMode,
    lastSync,
    error,
    loading,
  };
}
