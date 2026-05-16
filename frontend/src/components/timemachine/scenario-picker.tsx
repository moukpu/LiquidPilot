"use client";

import { useLocale } from "@/i18n/locale-context";
import type { StressRequest, StressScenario } from "@/types/api";

interface Props {
  value: StressRequest;
  onChange: (v: StressRequest) => void;
  onRun: () => void;
  loading: boolean;
}

const RAILS = ["INTERNAL", "SEPA", "ACH", "CARD", "SWIFT"] as const;
const COUNTRIES = ["DE", "US", "GB", "CH", "JP", "SG", "KZ"] as const;

export default function ScenarioPicker({
  value,
  onChange,
  onRun,
  loading,
}: Props) {
  const { t } = useLocale();

  const setScenario = (s: StressScenario) => {
    if (s === "rail_delay") {
      onChange({ scenario: s, rail: "SWIFT", extra_days: 3 });
    } else if (s === "volume_spike") {
      onChange({ scenario: s, multiplier: 1.3, affected_rail: undefined });
    } else {
      onChange({ scenario: s, country: "DE", holiday_days: 2 });
    }
  };

  return (
    <div className="glass-card rounded-2xl p-4 space-y-3">
      <div>
        <label className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
          {t("timemachine.scenario")}
        </label>
        <select
          value={value.scenario}
          onChange={(e) => setScenario(e.target.value as StressScenario)}
          className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 font-mono text-xs"
        >
          <option value="rail_delay">{t("timemachine.scenarios.railDelay")}</option>
          <option value="volume_spike">{t("timemachine.scenarios.volumeSpike")}</option>
          <option value="bank_holiday">{t("timemachine.scenarios.bankHoliday")}</option>
        </select>
      </div>

      {value.scenario === "rail_delay" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
              {t("timemachine.rail")}
            </label>
            <select
              value={value.rail ?? "SWIFT"}
              onChange={(e) => onChange({ ...value, rail: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 font-mono text-xs"
            >
              {RAILS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
              {t("timemachine.extraDays")}:{" "}
              <span className="text-foreground font-bold">{value.extra_days}</span>
            </label>
            <input
              type="range"
              min={1}
              max={7}
              value={value.extra_days ?? 1}
              onChange={(e) =>
                onChange({ ...value, extra_days: Number(e.target.value) })
              }
              className="w-full"
            />
          </div>
        </div>
      )}

      {value.scenario === "volume_spike" && (
        <div>
          <label className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
            {t("timemachine.multiplier")}:{" "}
            <span className="text-foreground font-bold">
              +{Math.round(((value.multiplier ?? 1.3) - 1) * 100)}%
            </span>
          </label>
          <input
            type="range"
            min={1.1}
            max={2.0}
            step={0.05}
            value={value.multiplier ?? 1.3}
            onChange={(e) =>
              onChange({ ...value, multiplier: Number(e.target.value) })
            }
            className="w-full"
          />
        </div>
      )}

      {value.scenario === "bank_holiday" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
              {t("timemachine.country")}
            </label>
            <select
              value={value.country ?? "DE"}
              onChange={(e) => onChange({ ...value, country: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 font-mono text-xs"
            >
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
              {t("timemachine.holidayDays")}:{" "}
              <span className="text-foreground font-bold">{value.holiday_days}</span>
            </label>
            <input
              type="range"
              min={1}
              max={5}
              value={value.holiday_days ?? 2}
              onChange={(e) =>
                onChange({ ...value, holiday_days: Number(e.target.value) })
              }
              className="w-full"
            />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onRun}
        disabled={loading}
        className="w-full bg-primary text-primary-foreground rounded-md px-3 py-2 font-mono text-xs font-semibold uppercase tracking-widest hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {loading ? t("timemachine.running") : t("timemachine.runButton")}
      </button>
    </div>
  );
}
