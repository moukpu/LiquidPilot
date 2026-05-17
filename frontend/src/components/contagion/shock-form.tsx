"use client";

import { useState, useRef, useEffect } from "react";
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

function CustomSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (val: string) => void;
  options: { label: string; value: string }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? value;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 shadow-sm hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all"
      >
        <span>{selectedLabel}</span>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden py-1">
          <div className="max-h-60 overflow-y-auto">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`w-full text-left px-4 py-2.5 text-sm font-semibold transition-colors ${
                  opt.value === value
                    ? "bg-slate-50 text-slate-900"
                    : "text-slate-600 hover:bg-slate-50/50 hover:text-slate-900"
                }`}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
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

  const sortedOptions = [...nodes]
    .sort((a, b) => a.account_id.localeCompare(b.account_id))
    .map((n) => ({ value: n.account_id, label: displayAccountLabel(n.account_id) }));

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          {t("contagion.shock.account")}
        </label>
        <CustomSelect
          value={value.shocked_account_id}
          onChange={(val) => onChange({ ...value, shocked_account_id: val })}
          options={sortedOptions}
        />
      </div>

      <div className="space-y-2">
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

      <div className="space-y-2">
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
          className="flex-1 bg-slate-900 text-white rounded-xl py-3 text-xs font-bold uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50 disabled:hover:bg-slate-900 transition-colors shadow-sm"
        >
          {loading ? t("contagion.shock.running") : t("contagion.shock.run")}
        </button>
        <button
          type="button"
          onClick={onReset}
          disabled={loading}
          className="px-5 bg-slate-100 text-slate-600 rounded-xl text-lg font-bold uppercase tracking-widest hover:bg-slate-200 disabled:opacity-50 transition-colors shadow-sm flex items-center justify-center"
          title={t("contagion.shock.reset")}
        >
          ↺
        </button>
      </div>
    </div>
  );
}
