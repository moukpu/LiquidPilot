"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAccounts, getInFlightTransactions, getRecommendations } from "@/lib/api";
import type { Account, Recommendations, Transaction } from "@/types/api";

export interface RadarData {
  accounts: Account[];
  transactions: Transaction[];
  recommendations: Recommendations;
}

export interface RadarState {
  data: RadarData;
  lastSync: Date | null;
  error: string | null;
  loading: boolean;
}

export function useRadarPolling(interval = 2000): RadarState {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendations>({ alerts: [], transfers: [] });
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const flyingRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);

  const poll = useCallback(async () => {
    if (flyingRef.current) return;
    flyingRef.current = true;

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const results = await Promise.allSettled([
        getAccounts(controller.signal),
        getInFlightTransactions(controller.signal),
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
        setTransactions(results[1].value);
        anyOk = true;
      } else if (results[1].reason?.name !== "AbortError") {
        firstError ??= (results[1].reason as Error).message;
      }

      if (results[2].status === "fulfilled") {
        setRecommendations(results[2].value);
        anyOk = true;
      } else if (results[2].reason?.name !== "AbortError") {
        firstError ??= (results[2].reason as Error).message;
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

  return {
    data: { accounts, transactions, recommendations },
    lastSync,
    error,
    loading,
  };
}
