"use client";

import { useLocale } from "@/i18n/locale-context";
import type { CascadeRequest, ContagionNode } from "@/types/api";
import { displayAccountLabel } from "@/lib/format";

interface Props {
  nodes: ContagionNode[];
  value: CascadeRequest;
  onChange: (v: CascadeRequest) => void;
  onRun: () => void;
  loading: boolean;
}

export default function ShockForm({
  nodes,
  value,
  onChange,
  onRun,
  loading,
}: Props) {
  const { t } = useLocale();

  // Alphabetical for deterministic UI. The default is set in the page,
  // not here, so this list is purely presentation.
  const sorted = [...nodes].sort((a, b) =>
    a.account_id.localeCompare(b.account_id)
  );

  return (
    <div className="glass-card rounded-2xl p-4 space-y-3">
      <h2 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        {t("contagion.shock.title")}
      </h2>

      <div>
        <label className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
          {t("contagion.shock.account")}
        </label>
        <select
          value={value.shocked_account_id}
          onChange={(e) =>
            onChange({ ...value, shocked_account_id: e.target.value })
          }
          className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 font-mono text-xs"
        >
          {sorted.map((n) => (
            <option key={n.account_id} value={n.account_id}>
              {displayAccountLabel(n.account_id)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
          {t("contagion.shock.intensity")}:{" "}
          <span className="text-foreground font-bold">
            {Math.round(value.intensity * 100)}%
          </span>
        </label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={value.intensity}
          onChange={(e) =>
            onChange({ ...value, intensity: Number(e.target.value) })
          }
          className="w-full"
        />
      </div>

      <div>
        <label className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
          {t("contagion.shock.horizon")}:{" "}
          <span className="text-foreground font-bold">{value.horizon_days}</span>
        </label>
        <input
          type="range"
          min={1}
          max={30}
          value={value.horizon_days}
          onChange={(e) =>
            onChange({ ...value, horizon_days: Number(e.target.value) })
          }
          className="w-full"
        />
      </div>

      <button
        type="button"
        onClick={onRun}
        disabled={loading || value.intensity === 0}
        className="w-full bg-primary text-primary-foreground rounded-md px-3 py-2 font-mono text-xs font-semibold uppercase tracking-widest hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {loading ? t("contagion.shock.running") : t("contagion.shock.run")}
      </button>
    </div>
  );
}
