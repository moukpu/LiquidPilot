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
const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "JPY", "SGD", "KZT"] as const;
const ACCOUNTS = [
  "EUR-Main",
  "EUR-Berlin",
  "USD-Correspondent",
  "USD-LA",
  "GBP-Local",
  "CHF-Zurich",
  "JPY-Tokyo",
  "SGD-Singapore",
  "KZT-Almaty",
] as const;

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
    } else if (s === "bank_holiday") {
      onChange({ scenario: s, country: "DE", holiday_days: 2 });
    } else if (s === "fx_shock") {
      onChange({ scenario: s, fx_currency: "EUR", fx_shock_pct: 5 });
    } else if (s === "counterparty_default") {
      onChange({ scenario: s, counterparty_account: "USD-Correspondent" });
    } else {
      onChange({ scenario: s, frozen_account: "EUR-Main", freeze_days: 2 });
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
          <option value="fx_shock">{t("timemachine.scenarios.fxShock")}</option>
          <option value="counterparty_default">
            {t("timemachine.scenarios.counterpartyDefault")}
          </option>
          <option value="liquidity_freeze">
            {t("timemachine.scenarios.liquidityFreeze")}
          </option>
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
              ×{(value.multiplier ?? 1.3).toFixed(2)}
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

      {value.scenario === "fx_shock" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
              {t("timemachine.fxCurrency")}
            </label>
            <select
              value={value.fx_currency ?? "EUR"}
              onChange={(e) =>
                onChange({ ...value, fx_currency: e.target.value })
              }
              className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 font-mono text-xs"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
              {t("timemachine.fxShockPct")}:{" "}
              <span className="text-foreground font-bold">
                {(value.fx_shock_pct ?? 0).toFixed(1)}%
              </span>
            </label>
            <input
              type="range"
              min={0}
              max={20}
              step={0.5}
              value={value.fx_shock_pct ?? 0}
              onChange={(e) =>
                onChange({ ...value, fx_shock_pct: Number(e.target.value) })
              }
              className="w-full"
            />
          </div>
        </div>
      )}

      {value.scenario === "counterparty_default" && (
        <div>
          <label className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
            {t("timemachine.counterparty")}
          </label>
          <select
            value={value.counterparty_account ?? "USD-Correspondent"}
            onChange={(e) =>
              onChange({ ...value, counterparty_account: e.target.value })
            }
            className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 font-mono text-xs"
          >
            {ACCOUNTS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      )}

      {value.scenario === "liquidity_freeze" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
              {t("timemachine.frozenAccount")}
            </label>
            <select
              value={value.frozen_account ?? "EUR-Main"}
              onChange={(e) =>
                onChange({ ...value, frozen_account: e.target.value })
              }
              className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 font-mono text-xs"
            >
              {ACCOUNTS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
              {t("timemachine.freezeDays")}:{" "}
              <span className="text-foreground font-bold">{value.freeze_days}</span>
            </label>
            <input
              type="range"
              min={1}
              max={5}
              value={value.freeze_days ?? 2}
              onChange={(e) =>
                onChange({ ...value, freeze_days: Number(e.target.value) })
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
