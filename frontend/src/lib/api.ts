import type { Account, Recommendations, Transaction } from "@/types/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export function getAccounts(signal?: AbortSignal) {
  return apiGet<Account[]>("/accounts/", signal);
}

export function getInFlightTransactions(signal?: AbortSignal) {
  return apiGet<Transaction[]>("/transactions/in-flight", signal);
}

export function getRecommendations(signal?: AbortSignal) {
  return apiGet<Recommendations>("/recommendations/", signal);
}
