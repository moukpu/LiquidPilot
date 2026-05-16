"use client";

import { useMemo } from "react";
import { useAutopilotState } from "@/hooks/use-autopilot-state";
import { transferKey } from "@/lib/autopilot-synth";
import AutopilotHeader from "@/components/autopilot/autopilot-header";
import AccountSummaryStrip from "@/components/autopilot/account-summary-strip";
import AlertsDetailPanel from "@/components/autopilot/alerts-detail-panel";
import ActionQueue from "@/components/autopilot/action-queue";

export default function AutopilotPage() {
  const {
    accounts,
    alerts,
    transfers,
    actionStates,
    setActionState,
    demoMode,
    toggleDemoMode,
    lastSync,
    error,
  } = useAutopilotState(2000);

  const counts = useMemo(() => {
    const c = { queued: 0, confirming: 0, executing: 0, executed: 0, skipped: 0 };
    for (const t of transfers) {
      const meta = actionStates[transferKey(t)];
      const state = meta?.state ?? "queued";
      c[state] += 1;
    }
    return c;
  }, [transfers, actionStates]);

  return (
    <div className="-m-6 h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
      <AutopilotHeader
        demoMode={demoMode}
        onToggleDemoMode={toggleDemoMode}
        lastSync={lastSync}
        error={error}
        counts={counts}
      />

      <AccountSummaryStrip accounts={accounts} />

      <main className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-4 p-6 overflow-hidden">
        <AlertsDetailPanel alerts={alerts} />
        <ActionQueue
          transfers={transfers}
          actionStates={actionStates}
          onChange={setActionState}
          showEmptyState={!demoMode}
        />
      </main>
    </div>
  );
}
