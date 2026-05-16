"use client";

import { useMemo } from "react";
import { useAutopilotState } from "@/hooks/use-autopilot-state";
import { transferKey } from "@/lib/autopilot-synth";
import AutopilotHeader from "@/components/autopilot/autopilot-header";
import AccountSummaryStrip from "@/components/autopilot/account-summary-strip";
import ActionQueue from "@/components/autopilot/action-queue";
import SessionSummary from "@/components/autopilot/session-summary";

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

  // Pulse the demo-mode pill when the page has loaded but the user
  // hasn't flipped Demo on yet — without it the queue is permanently
  // empty and the empty-state copy already prompts toggling Demo Mode.
  const showDemoHint = !demoMode && accounts.length > 0;

  return (
    <div className="-mx-6 -mt-6 h-[calc(100vh-4rem)] flex flex-col bg-background">
      <AutopilotHeader
        demoMode={demoMode}
        onToggleDemoMode={toggleDemoMode}
        lastSync={lastSync}
        error={error}
        counts={counts}
        demoHint={showDemoHint}
      />

      <AccountSummaryStrip accounts={accounts} alerts={alerts} />

      <main className="flex-1 min-h-0 overflow-hidden p-6">
        <ActionQueue
          transfers={transfers}
          alerts={alerts}
          actionStates={actionStates}
          onChange={setActionState}
          showEmptyState={!demoMode}
        />
      </main>

      <SessionSummary
        transfers={transfers}
        alerts={alerts}
        actionStates={actionStates}
      />
    </div>
  );
}
