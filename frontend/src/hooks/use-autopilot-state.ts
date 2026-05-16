"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAccounts, getRecommendations } from "@/lib/api";
import {
  synthAlerts,
  synthTransfers,
  transferKey,
} from "@/lib/autopilot-synth";
import type {
  Account,
  Alert,
  Recommendations,
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
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendations>({
    alerts: [],
    transfers: [],
  });
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
      const results = await Promise.allSettled([
        getAccounts(controller.signal),
        getRecommendations(controller.signal),
      ]);

      let anyOk = false;
      let firstError: string | null = null;

      if (results[0].status === "fulfilled") {
        setAccounts(results[0].value);
        anyOk = true;
      } else if (results[0].reason?.name !== "AbortError") {
        firstError = (results[0].reason as Error).message;
      }

      if (results[1].status === "fulfilled") {
        setRecommendations(results[1].value);
        anyOk = true;
      } else if (results[1].reason?.name !== "AbortError") {
        firstError ??= (results[1].reason as Error).message;
      }

      if (anyOk) {
        setLastSync(new Date());
        setError(null);
      } else if (firstError) {
        setError(firstError);
      }
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

  const alerts = useMemo(
    () => (demoMode ? synthAlerts(accounts) : recommendations.alerts),
    [demoMode, accounts, recommendations.alerts]
  );

  const transfers = useMemo(
    () => (demoMode ? synthTransfers(accounts) : recommendations.transfers),
    [demoMode, accounts, recommendations.transfers]
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
