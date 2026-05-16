"use client";

import { useLocale } from "@/i18n/locale-context";
import type { RailReliability } from "@/types/api";

interface Props {
  rails: Record<string, RailReliability>;
}

const RAIL_ORDER = ["INTERNAL", "SEPA", "ACH", "CARD", "SWIFT"] as const;

function Dots({ score }: { score: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(score / 20)));
  return (
    <span className="font-mono text-xs tracking-tight">
      {"\u25CF".repeat(filled)}
      <span className="text-muted-foreground/40">
        {"\u25CB".repeat(5 - filled)}
      </span>
    </span>
  );
}

function reliabilityColor(score: number): string {
  if (score >= 95) return "text-emerald-500";
  if (score >= 85) return "text-yellow-500";
  return "text-rose-500";
}

export default function RailReliabilityCard({ rails }: Props) {
  const { t } = useLocale();
  const sorted = RAIL_ORDER.filter((r) => rails[r]);

  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">
        {t("radar.reliability.title")}
      </div>
      <div className="space-y-2.5 font-mono text-xs">
        {sorted.map((rail) => {
          const r = rails[rail];
          return (
            <div key={rail} className="flex items-center justify-between gap-2">
              <span className="text-foreground/90 w-20">{rail}</span>
              <span
                className={`font-semibold tabular-nums w-14 ${reliabilityColor(
                  r.reliability
                )}`}
              >
                {r.reliability.toFixed(1)}%
              </span>
              <Dots score={r.reliability} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
