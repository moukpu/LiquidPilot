"""Walk-forward backtesting harness.

This module is the credibility layer of the system. Forecasting and
alerting are easy to demo; what's hard is showing that the model would
have *actually* caught real liquidity events with usable lead time and
without crying wolf. A walk-forward backtest answers that.

Methodology
-----------
Walk-forward with periodic retraining:

  1. Start at `train_min_days` into the history. We need enough rows
     for the model to be meaningful before we start scoring it.
  2. At each `as_of` date, train on `[start, as_of]` (strictly past) and
     forecast `[as_of+1, as_of+horizon]`.
  3. Compare each forecast to the realized values: per-horizon MAE/RMSE
     for the P50 head, plus P05–P95 *coverage* (fraction of actuals that
     fell inside the band — should be ≈ 90% if quantiles are calibrated).
  4. Retrain every `retrain_every` days. Daily retraining is more honest
     but expensive, and most production systems retrain weekly or monthly.
  5. If a `RiskManager` is supplied, also evaluate alert quality:
     compare projected breaches (per-as_of alerts) against *actual*
     breaches (days where realized ledger_balance < min_balance), and
     score lead time, precision, and recall.

The point is not to grade the model on aesthetics — it's to produce a
single page of numbers a treasury team can reason about.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional

import numpy as np
import pandas as pd

from .config import SystemConfig, default_system_config
from .forecaster import LiquidityForecaster
from .risk_manager import AlertSeverity, RiskManager


@dataclass
class BacktestReport:
    """Container for backtest output and downstream analytics."""

    # One row per (as_of, account_id, horizon). Holds forecast + actual.
    records: pd.DataFrame
    # One row per alert fired during the backtest (if a RiskManager was
    # supplied). Empty DataFrame otherwise.
    alerts: pd.DataFrame
    # One row per actual breach day in the held-out window.
    actual_breaches: pd.DataFrame

    # ---------------------------------------------------------------- summaries
    def by_horizon(self) -> pd.DataFrame:
        """MAE / RMSE / bias / coverage by (account, horizon).

        Bias is mean(predicted - actual). A persistent non-zero bias
        means the model is systematically over- or under-predicting,
        which is a different problem from variance — worth surfacing
        separately because the fix is different (often a feature gap
        rather than a model-capacity issue).
        """

        if self.records.empty:
            return pd.DataFrame()

        df = self.records.copy()
        df["abs_err"] = (df["pred_p50"] - df["actual"]).abs()
        df["sq_err"] = (df["pred_p50"] - df["actual"]) ** 2
        df["bias"] = df["pred_p50"] - df["actual"]
        df["in_band"] = (df["actual"] >= df["pred_p05"]) & (
            df["actual"] <= df["pred_p95"]
        )

        agg = (
            df.groupby(["account_id", "horizon"])
            .agg(
                n=("abs_err", "size"),
                mae=("abs_err", "mean"),
                rmse=("sq_err", lambda s: float(np.sqrt(s.mean()))),
                bias=("bias", "mean"),
                coverage=("in_band", "mean"),
            )
            .reset_index()
        )
        return agg

    def overall_coverage(self) -> float:
        """Fraction of actuals inside the P05-P95 band (target ≈ 0.90)."""

        if self.records.empty:
            return float("nan")
        in_band = (self.records["actual"] >= self.records["pred_p05"]) & (
            self.records["actual"] <= self.records["pred_p95"]
        )
        return float(in_band.mean())

    def naive_baseline_mae(self) -> pd.DataFrame:
        """MAE of a lag-1 baseline: predict today's flow as yesterday's.

        Anchors model performance. If the model is no better than this
        baseline, the engineering complexity isn't earning its keep.
        """

        if self.records.empty:
            return pd.DataFrame()
        df = self.records.copy()
        df["abs_err_naive"] = (df["naive_pred"] - df["actual"]).abs()
        return (
            df.groupby(["account_id", "horizon"])["abs_err_naive"]
            .mean()
            .reset_index(name="mae_naive")
        )

    def alert_quality(self, horizon: Optional[int] = None) -> Dict:
        """Score alerts against actual breaches.

        Two views are reported because they answer different questions:

          * **Alert precision** = (alerts that matched some breach) /
            (total alerts). Answers "when the system alerts, how often
            is it right?" — i.e. how noisy is the alert stream.

          * **Breach recall** = (breaches anticipated by some alert) /
            (total breaches). Answers "of the breaches that actually
            happened, how many were caught beforehand?" — i.e. how safe
            is the system.

        These are NOT linked by `TP + FN = n_breaches` because each
        breach can be anticipated by multiple alerts (one per as_of
        date in the prior horizon window) — so the two sides are
        scored independently. The detailed counts let a reader see
        whether noise (precision) or coverage (recall) is the problem.
        """

        h = horizon if horizon is not None else 7
        alerts = self.alerts.copy()
        breaches = self.actual_breaches.copy()

        if alerts.empty and breaches.empty:
            return {
                "n_alerts": 0,
                "n_breaches": 0,
                "alerts_matched": 0,
                "alerts_unmatched": 0,
                "breaches_caught": 0,
                "breaches_missed": 0,
                "precision": float("nan"),
                "recall": float("nan"),
                "mean_lead_time_days": float("nan"),
            }

        # ---- alert precision side -----------------------------------
        alerts_matched = 0
        alerts_unmatched = 0
        lead_times: List[int] = []
        for _, alert in alerts.iterrows():
            window_end = alert["as_of"] + pd.Timedelta(days=h)
            candidates = breaches[
                (breaches["account_id"] == alert["account_id"])
                & (breaches["breach_date"] > alert["as_of"])
                & (breaches["breach_date"] <= window_end)
            ]
            if not candidates.empty:
                first = candidates.sort_values("breach_date").iloc[0]
                lead_times.append((first["breach_date"] - alert["as_of"]).days)
                alerts_matched += 1
            else:
                alerts_unmatched += 1

        # ---- breach recall side -------------------------------------
        breaches_caught = 0
        breaches_missed = 0
        for _, breach in breaches.iterrows():
            window_start = breach["breach_date"] - pd.Timedelta(days=h)
            anticipated = alerts[
                (alerts["account_id"] == breach["account_id"])
                & (alerts["as_of"] >= window_start)
                & (alerts["as_of"] < breach["breach_date"])
            ]
            if anticipated.empty:
                breaches_missed += 1
            else:
                breaches_caught += 1

        precision = (
            alerts_matched / (alerts_matched + alerts_unmatched)
            if (alerts_matched + alerts_unmatched) else float("nan")
        )
        recall = (
            breaches_caught / (breaches_caught + breaches_missed)
            if (breaches_caught + breaches_missed) else float("nan")
        )
        return {
            "n_alerts": int(len(alerts)),
            "n_breaches": int(len(breaches)),
            "alerts_matched": alerts_matched,
            "alerts_unmatched": alerts_unmatched,
            "breaches_caught": breaches_caught,
            "breaches_missed": breaches_missed,
            "precision": float(precision),
            "recall": float(recall),
            "mean_lead_time_days": (
                float(np.mean(lead_times)) if lead_times else float("nan")
            ),
        }


class Backtester:
    """Walk-forward backtest over a daily-balance history."""

    def __init__(
        self,
        config: Optional[SystemConfig] = None,
        retrain_every: int = 60,
        train_min_days: int = 240,
        horizon: Optional[int] = None,
        risk_manager: Optional[RiskManager] = None,
    ) -> None:
        self.config = config or default_system_config()
        self.retrain_every = retrain_every
        self.train_min_days = train_min_days
        self.horizon = horizon or self.config.forecast_horizon
        self.risk_manager = risk_manager

    # ------------------------------------------------------------------
    # Main entry point
    # ------------------------------------------------------------------
    def run(self, daily_balances: pd.DataFrame) -> BacktestReport:
        """Execute the walk-forward backtest.

        Args:
            daily_balances: Output of MockDataGenerator. Must cover at
                least `train_min_days + horizon` calendar days.
        """

        daily_balances = daily_balances.sort_values(["account_id", "date"]).reset_index(
            drop=True
        )
        all_dates = sorted(pd.to_datetime(daily_balances["date"].unique()))
        if len(all_dates) < self.train_min_days + self.horizon + 1:
            raise ValueError(
                "Not enough history for backtest: need at least "
                f"{self.train_min_days + self.horizon + 1} days, got {len(all_dates)}."
            )

        # We retrain at `retrain_every` intervals and reuse the frozen
        # model for the days in between. as_of_indices is the set of
        # *forecast origin* days we'll iterate over.
        last_origin = len(all_dates) - self.horizon - 1
        as_of_indices = list(range(self.train_min_days, last_origin + 1))

        forecaster: Optional[LiquidityForecaster] = None
        steps_since_retrain = self.retrain_every  # force initial fit

        records: List[Dict] = []
        alert_log: List[Dict] = []

        for as_of_idx in as_of_indices:
            as_of = all_dates[as_of_idx]
            history = daily_balances[daily_balances["date"] <= as_of]

            if steps_since_retrain >= self.retrain_every:
                forecaster = LiquidityForecaster(
                    self.config, horizon=self.horizon
                )
                # validation_days=0 — we manage our own walk-forward
                # split here. The forecaster shouldn't carve another.
                forecaster.fit(history, validation_days=0)
                steps_since_retrain = 0
            steps_since_retrain += 1

            assert forecaster is not None
            forecasts = forecaster.forecast(history)

            # ------ record forecast vs actual --------------------------
            for account_id, result in forecasts.items():
                fc = result.forecast.reset_index(drop=True)
                # Naive baseline: predict next-day flow as today's flow.
                last_flow = float(
                    history[history["account_id"] == account_id][
                        "net_flow_settled"
                    ].iloc[-1]
                )
                for h_idx, row in fc.iterrows():
                    forecast_date = pd.Timestamp(row["date"])
                    actual_row = daily_balances[
                        (daily_balances["account_id"] == account_id)
                        & (daily_balances["date"] == forecast_date)
                    ]
                    if actual_row.empty:
                        continue
                    records.append(
                        {
                            "as_of": as_of,
                            "forecast_date": forecast_date,
                            "horizon": h_idx + 1,
                            "account_id": account_id,
                            "pred_p05": float(row["predicted_net_flow_p05"]),
                            "pred_p50": float(row["predicted_net_flow_p50"]),
                            "pred_p95": float(row["predicted_net_flow_p95"]),
                            "actual": float(actual_row["net_flow_settled"].iloc[0]),
                            "pred_balance_p05": float(
                                row["predicted_ledger_balance_p05"]
                            ),
                            "pred_balance_p50": float(
                                row["predicted_ledger_balance_p50"]
                            ),
                            "pred_balance_p95": float(
                                row["predicted_ledger_balance_p95"]
                            ),
                            "actual_balance": float(actual_row["ledger_balance"].iloc[0]),
                            "naive_pred": last_flow,
                        }
                    )

            # ------ alert quality (optional) ---------------------------
            if self.risk_manager is not None:
                alerts = self.risk_manager.evaluate(forecasts, as_of=as_of)
                for a in alerts:
                    if a.severity in (AlertSeverity.CRITICAL, AlertSeverity.WARNING):
                        alert_log.append(
                            {
                                "as_of": as_of,
                                "account_id": a.account_id,
                                "severity": a.severity.value,
                                "breach_date": a.breach_date,
                                "projected_balance": a.projected_balance,
                                "shortfall": a.shortfall,
                            }
                        )

        records_df = pd.DataFrame(records)
        # Initialize with explicit columns so downstream column access
        # works even when no alerts fired during the run.
        alerts_df = pd.DataFrame(
            alert_log,
            columns=[
                "as_of",
                "account_id",
                "severity",
                "breach_date",
                "projected_balance",
                "shortfall",
            ],
        )

        # ------ actual breaches in the held-out window ----------------
        # Score breaches against the *risk manager's* policy so the
        # numbers used for alerts and breaches are consistent. Falls
        # back to the backtester's config when no risk manager was
        # supplied (forecast-only mode).
        breach_config = self.risk_manager.config if self.risk_manager else self.config
        floors = {a.account_id: a.min_balance for a in breach_config.accounts}

        eval_window_start = all_dates[self.train_min_days] + pd.Timedelta(days=1)
        breach_rows: List[Dict] = []
        for account_id, floor in floors.items():
            acct = daily_balances[
                (daily_balances["account_id"] == account_id)
                & (daily_balances["date"] >= eval_window_start)
            ]
            below = acct[acct["ledger_balance"] < floor]
            for _, r in below.iterrows():
                breach_rows.append(
                    {
                        "account_id": account_id,
                        "breach_date": pd.Timestamp(r["date"]),
                        "ledger_balance": float(r["ledger_balance"]),
                        "floor": float(floor),
                    }
                )
        breaches_df = pd.DataFrame(breach_rows)

        return BacktestReport(
            records=records_df,
            alerts=alerts_df,
            actual_breaches=breaches_df,
        )
