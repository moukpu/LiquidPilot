const STORAGE_KEY = "liquidpilot_execute_events";

export interface ExecuteEvent {
  from_account: string;
  to_account: string;
  amount: number;
  currency: string;
  timestamp: number;
}

function readStore(): ExecuteEvent[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ExecuteEvent[];
  } catch {
    return [];
  }
}

function writeStore(events: ExecuteEvent[]): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch {}
}

export function pushExecuteEvent(
  ev: Omit<ExecuteEvent, "timestamp">
): void {
  const existing = readStore();
  const now = Date.now();
  // Dedupe: same route + amount + currency within last 5s
  const dup = existing.find(
    (e) =>
      e.from_account === ev.from_account &&
      e.to_account === ev.to_account &&
      e.amount === ev.amount &&
      e.currency === ev.currency &&
      now - e.timestamp < 5000
  );
  if (dup) return;
  existing.push({ ...ev, timestamp: now });
  const cutoff = now - 60_000;
  writeStore(existing.filter((e) => e.timestamp > cutoff).slice(-50));
}

export function getExecuteEvents(): ExecuteEvent[] {
  const events = readStore();
  const cutoff = Date.now() - 60_000;
  const fresh = events.filter((e) => e.timestamp > cutoff);
  if (fresh.length !== events.length) writeStore(fresh);
  return fresh;
}

import { useEffect, useState } from "react";

export function useExecuteEvents(): ExecuteEvent[] {
  const [events, setEvents] = useState<ExecuteEvent[]>([]);
  useEffect(() => {
    setEvents(getExecuteEvents());
    const id = setInterval(() => setEvents(getExecuteEvents()), 1000);
    return () => clearInterval(id);
  }, []);
  return events;
}
