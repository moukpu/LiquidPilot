"use client";

import { useLocale } from "@/i18n/locale-context";
import type { CascadeRequest, ContagionNode } from "@/types/api";
import { displayAccountLabel } from "@/lib/format";

interface Props {
  nodes: ContagionNode[];
  value: CascadeRequest;
  onChange: (v: CascadeRequest) => void;
  onRun: () => void;
  onReset: () => void;
  loading: boolean;
}

export default function ShockForm({
  nodes,
  value,
  onChange,
  onRun,
  onReset,
  loading,
}: Props) {
  const { t } = useLocale();

  const sorted = [...nodes].sort((a, b) =>
    a.account_id.localeCompare(b.account_id)
  );

  return (
    <div className="flex flex-row items-center gap-3">
      <div className="min-w-[14rem]">
        <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
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

      <div className="flex-1">
        <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
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

      <div className="flex-1">
        <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
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

      <div className="flex items-end self-stretch pb-1">
        <button
          type="button"
          onClick={onRun}
          disabled={loading || value.intensity === 0}
          className="bg-primary text-primary-foreground rounded-md px-4 py-1.5 font-mono text-xs font-semibold uppercase tracking-widest hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
        >
          {loading ? t("contagion.shock.running") : t("contagion.shock.run")}
        </button>
      </div>

      <div className="flex items-end self-stretch pb-1">
        <button
          type="button"
          onClick={onReset}
          disabled={loading}
          className="bg-slate-100 text-slate-700 rounded-md px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-widest hover:bg-slate-200 disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          {t("contagion.shock.reset")}
        </button>
      </div>
    </div>
  );
}
