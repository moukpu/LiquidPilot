"use client";

import { ShieldCheck } from "lucide-react";

export default function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-8 py-12">
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-full bg-emerald-500/10 blur-2xl" />
        <ShieldCheck className="relative w-12 h-12 text-emerald-400" />
      </div>
      <div className="text-base font-semibold">Autopilot standing by</div>
      <div className="text-xs text-muted-foreground mt-2 max-w-md leading-relaxed">
        No actions required. All accounts are above their floors and no breach is
        forecast within the planning horizon. Toggle{" "}
        <span className="font-mono text-primary">Demo Mode</span> in the header
        to walk through a fabricated scenario.
      </div>
    </div>
  );
}
