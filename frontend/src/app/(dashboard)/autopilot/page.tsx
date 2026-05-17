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
    <div className="-mx-6 -mt-6 min-h-[calc(100vh-4rem)] flex flex-col relative overflow-hidden bg-slate-50/50">
      {/* Background blobs */}
      <div className="absolute top-0 left-1/4 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[120px] -translate-y-1/2 pointer-events-none animate-blob" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[100px] translate-y-1/3 pointer-events-none animate-blob" style={{ animationDelay: '2s' }} />

      <div className="relative z-10 flex flex-col min-h-0 flex-1">
        <AutopilotHeader
          demoMode={demoMode}
          onToggleDemoMode={toggleDemoMode}
          lastSync={lastSync}
          error={error}
          counts={counts}
          demoHint={showDemoHint}
        />

        <AccountSummaryStrip
          accounts={accounts}
          alerts={alerts}
          transfers={transfers}
          actionStates={actionStates}
        />

        <main className="flex-1 min-h-0 p-6 pb-24 flex justify-center">
          <div className="w-full max-w-5xl h-full flex flex-col min-h-0">
            <ActionQueue
              transfers={transfers}
              alerts={alerts}
              actionStates={actionStates}
              onChange={setActionState}
              showEmptyState={!demoMode}
            />
          </div>
        </main>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-20 flex justify-center pb-6 pointer-events-none">
        <div className="pointer-events-auto">
          <SessionSummary
            transfers={transfers}
            alerts={alerts}
            actionStates={actionStates}
          />
        </div>
      </div>
    </div>
  );
}
