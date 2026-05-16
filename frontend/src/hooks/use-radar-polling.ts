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
      const [acc, tx, rec] = await Promise.all([
        getAccounts(controller.signal),
        getInFlightTransactions(controller.signal),
        getRecommendations(controller.signal),
      ]);
      setAccounts(acc);
      setTransactions(tx);
      setRecommendations(rec);
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

  return {
    data: { accounts, transactions, recommendations },
    lastSync,
    error,
    loading,
  };
}
