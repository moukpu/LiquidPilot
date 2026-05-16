"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAccounts } from "@/lib/api";
import {
  synthAlerts,
  synthTransfers,
  transferKey,
} from "@/lib/autopilot-synth";
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
  // Recommendations from the backend's risk engine are intentionally
  // dropped on the client: the demo brief is that without Demo Mode the
  // queue stays empty (judges see only data they generated themselves).
  // We still poll /accounts/ so the AccountSummaryStrip and the demo
  // status pill stay live.
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionStates, setActionStates] = useState<Record<string, ExecutedMeta>>(
    {}
  );
  const [demoMode, setDemoMode] = useState(false);

  const flyingRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);

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

  // Demo Mode OFF -> empty arrays. The judges asked for a hard rule:
  // 'без него НИЧЕГО, даже истории переводов'. Empty queue triggers
  // the EmptyState component which already nudges the user toward the
  // Demo Mode toggle.
  const alerts = useMemo(
    () => (demoMode ? synthAlerts(accounts) : []),
    [demoMode, accounts]
  );

  const transfers = useMemo(
    () => (demoMode ? synthTransfers(accounts) : []),
    [demoMode, accounts]
  );

  // Discard stale action-state keys for transfers no longer in the queue.
  // (Optional cleanup — keeps sessionStorage from growing unbounded.)
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
