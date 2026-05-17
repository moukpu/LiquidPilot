import type {
  Account,
  CascadeRequest,
  CascadeResult,
  ContagionNetwork,
  RadarInsights,
  Recommendations,
  StressRequest,
  StressResult,
  Transaction,
} from "@/types/api";

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

export function getRadarInsights(signal?: AbortSignal) {
  return apiGet<RadarInsights>("/radar/insights", signal);
}

export async function runStressTest(req: StressRequest): Promise<StressResult> {
  const res = await fetch(`${API_BASE}/timemachine/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`stress test failed: ${res.status} ${res.statusText}${detail ? ` — ${detail}` : ""}`);
  }
  return (await res.json()) as StressResult;
}

export function getContagionNetwork(signal?: AbortSignal) {
  return apiGet<ContagionNetwork>("/contagion/network", signal);
}

export async function runCascade(req: CascadeRequest): Promise<CascadeResult> {
  const res = await fetch(`${API_BASE}/contagion/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `cascade simulation failed: ${res.status} ${res.statusText}${detail ? ` — ${detail}` : ""}`
    );
  }
  return (await res.json()) as CascadeResult;
}
