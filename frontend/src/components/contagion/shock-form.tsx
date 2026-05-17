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
    <div className="space-y-5">
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          {t("contagion.shock.account")}
        </label>
        <select
          value={value.shocked_account_id}
          onChange={(e) =>
            onChange({ ...value, shocked_account_id: e.target.value })
          }
          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-slate-400 transition-colors"
        >
          {sorted.map((n) => (
            <option key={n.account_id} value={n.account_id}>
              {displayAccountLabel(n.account_id)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            {t("contagion.shock.intensity")}
          </label>
          <span className="text-[11px] font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
            {Math.round(value.intensity * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={value.intensity}
          onChange={(e) =>
            onChange({ ...value, intensity: Number(e.target.value) })
          }
          className="w-full accent-slate-900"
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            {t("contagion.shock.horizon")}
          </label>
          <span className="text-[11px] font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
            {value.horizon_days}d
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={30}
          value={value.horizon_days}
          onChange={(e) =>
            onChange({ ...value, horizon_days: Number(e.target.value) })
          }
          className="w-full accent-slate-900"
        />
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onRun}
          disabled={loading || value.intensity === 0}
          className="flex-1 bg-slate-900 text-white rounded-lg py-3 text-xs font-bold uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50 disabled:hover:bg-slate-900 transition-colors"
        >
          {loading ? t("contagion.shock.running") : t("contagion.shock.run")}
        </button>
        <button
          type="button"
          onClick={onReset}
          disabled={loading}
          className="px-4 bg-slate-100 text-slate-600 rounded-lg text-lg font-bold uppercase tracking-widest hover:bg-slate-200 disabled:opacity-50 transition-colors"
          title={t("contagion.shock.reset")}
        >
          ↺
        </button>
      </div>
    </div>
  );
}
