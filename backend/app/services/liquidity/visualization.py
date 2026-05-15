"""Visualization helpers for the liquidity management system.

Each plot helper takes the same kinds of inputs the rest of the pipeline
produces — `daily_balances`, `ForecastResult`, `BacktestReport`,
`AccountConfig` — so a user can slice and recompose without
restructuring data. All helpers return a matplotlib `Figure` so the
caller decides whether to display, save, or embed in a notebook.

Design notes
------------
* No global state. Each call builds its own Figure; the caller is
  responsible for `plt.close()` after saving.
* Money axes are formatted with k/M/B suffixes — raw exponents are
  illegible in a treasury context where every number has 6+ digits.
* History tails default to ~90 days. The full 540-day history is too
  dense for a single panel; the interesting structure (recent flows,
  pending settlements, near-term forecast) lives in the tail.
"""

from __future__ import annotations

from typing import Optional

import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import pandas as pd

from .backtester import BacktestReport
from .config import AccountConfig
from .forecaster import ForecastResult


# --------------------------------------------------------------------- helpers
def _money_formatter(currency: str = "") -> mticker.Formatter:
    """k/M/B money formatter so axis ticks stay legible."""

    suffix = f" {currency}" if currency else ""

    def fmt(x, _pos):
        ax = abs(x)
        if ax >= 1e9:
            return f"{x/1e9:.1f}B{suffix}"
        if ax >= 1e6:
            return f"{x/1e6:.1f}M{suffix}"
        if ax >= 1e3:
            return f"{x/1e3:.0f}K{suffix}"
        return f"{x:.0f}{suffix}"

    return mticker.FuncFormatter(fmt)


# --------------------------------------------------------------------- plots
def plot_account_overview(
    daily_balances: pd.DataFrame,
    forecast: ForecastResult,
    account_config: AccountConfig,
    history_tail_days: int = 90,
) -> plt.Figure:
    """Three-panel overview for one account.

    Panel 1: ledger balance history + forecast band + thresholds.
    Panel 2: daily net flow history + forecast band.
    Panel 3: in-transit by payment rail (stacked area).

    The thresholds are drawn on panel 1 so the gap between the P05 line
    and `min_balance` is immediately visible — that gap *is* the
    liquidity headroom the system is trying to manage.
    """

    acct = daily_balances[daily_balances["account_id"] == account_config.account_id]
    acct = acct.sort_values("date").reset_index(drop=True)
    tail = acct.tail(history_tail_days)
    fc = forecast.forecast

    fig, axes = plt.subplots(3, 1, figsize=(12, 10))
    fig.suptitle(
        f"{account_config.account_id} ({account_config.currency})",
        fontsize=14, fontweight="bold",
    )

    money_fmt = _money_formatter(account_config.currency)

    # --- Panel 1: balance + forecast band ---------------------------------
    ax = axes[0]
    ax.plot(tail["date"], tail["ledger_balance"], color="C0", lw=1.5,
            label="ledger (history)")
    ax.plot(fc["date"], fc["predicted_ledger_balance_p50"], color="C1", lw=2,
            label="P50 forecast")
    ax.fill_between(
        fc["date"],
        fc["predicted_ledger_balance_p05"],
        fc["predicted_ledger_balance_p95"],
        color="C1", alpha=0.2, label="P05-P95 band",
    )
    ax.axhline(account_config.min_balance, color="red", ls="--", lw=1,
               label="min_balance")
    ax.axhline(account_config.min_balance + account_config.alert_buffer,
               color="orange", ls=":", lw=1, label="alert buffer")
    ax.set_title("Ledger balance")
    ax.set_ylabel(account_config.currency)
    ax.yaxis.set_major_formatter(money_fmt)
    ax.legend(loc="upper left", fontsize=8)
    ax.grid(alpha=0.3)

    # --- Panel 2: net flow + forecast band --------------------------------
    ax = axes[1]
    ax.plot(tail["date"], tail["net_flow_settled"], color="C0", lw=1,
            label="net flow (history)")
    ax.plot(fc["date"], fc["predicted_net_flow_p50"], color="C1", lw=2,
            marker="o", label="P50 forecast")
    ax.fill_between(
        fc["date"],
        fc["predicted_net_flow_p05"],
        fc["predicted_net_flow_p95"],
        color="C1", alpha=0.2, label="P05-P95 band",
    )
    ax.axhline(0, color="black", lw=0.5, alpha=0.5)
    ax.set_title("Daily net flow (settled)")
    ax.set_ylabel(account_config.currency)
    ax.yaxis.set_major_formatter(money_fmt)
    ax.legend(loc="upper left", fontsize=8)
    ax.grid(alpha=0.3)

    # --- Panel 3: in-transit by rail --------------------------------------
    ax = axes[2]
    rail_cols = [
        c for c in acct.columns
        if c.startswith("in_transit_") and c != "in_transit"
    ]
    if rail_cols:
        labels = [c.replace("in_transit_", "") for c in rail_cols]
        ax.stackplot(
            tail["date"],
            *[tail[c].fillna(0).values for c in rail_cols],
            labels=labels,
            alpha=0.7,
        )
    ax.axhline(0, color="black", lw=0.5)
    ax.set_title("In-transit funds by payment rail")
    ax.set_ylabel(account_config.currency)
    ax.yaxis.set_major_formatter(money_fmt)
    ax.legend(loc="upper left", fontsize=8, ncol=2)
    ax.grid(alpha=0.3)

    fig.tight_layout()
    return fig


def plot_backtest_summary(report: BacktestReport) -> plt.Figure:
    """Four-panel backtest scorecard.

    Top-left:  MAE vs naive baseline by horizon (lines per account).
    Top-right: P05-P95 coverage vs the 90% target.
    Bot-left:  Bias by horizon (should hover near zero).
    Bot-right: Alert precision / recall / lead time as a bar chart.
    """

    by_h = report.by_horizon()
    naive = report.naive_baseline_mae()
    merged = by_h.merge(naive, on=["account_id", "horizon"])

    fig, axes = plt.subplots(2, 2, figsize=(14, 10))
    fig.suptitle("Backtest summary", fontsize=14, fontweight="bold")

    # MAE
    ax = axes[0, 0]
    for account_id, grp in merged.groupby("account_id"):
        ax.plot(grp["horizon"], grp["mae"], marker="o",
                label=f"{account_id} (model)")
        ax.plot(grp["horizon"], grp["mae_naive"], marker="s", ls="--",
                alpha=0.5, label=f"{account_id} (naive)")
    ax.set_xlabel("Horizon (days)")
    ax.set_ylabel("Mean abs. error")
    ax.yaxis.set_major_formatter(_money_formatter())
    ax.set_title("Forecast MAE: model vs lag-1 baseline")
    ax.legend(fontsize=7, loc="best")
    ax.grid(alpha=0.3)

    # Coverage
    ax = axes[0, 1]
    for account_id, grp in merged.groupby("account_id"):
        ax.plot(grp["horizon"], grp["coverage"], marker="o", label=account_id)
    ax.axhline(0.9, color="red", ls="--", lw=1, label="target (90%)")
    ax.set_xlabel("Horizon (days)")
    ax.set_ylabel("P05-P95 coverage")
    ax.set_ylim(0, 1)
    ax.set_title("Quantile calibration (lower = bands too narrow)")
    ax.legend(fontsize=8)
    ax.grid(alpha=0.3)

    # Bias
    ax = axes[1, 0]
    for account_id, grp in merged.groupby("account_id"):
        ax.plot(grp["horizon"], grp["bias"], marker="o", label=account_id)
    ax.axhline(0, color="black", lw=0.5)
    ax.set_xlabel("Horizon (days)")
    ax.set_ylabel("Mean(predicted - actual)")
    ax.yaxis.set_major_formatter(_money_formatter())
    ax.set_title("Forecast bias by horizon")
    ax.legend(fontsize=8)
    ax.grid(alpha=0.3)

    # Alert quality
    ax = axes[1, 1]
    q = report.alert_quality()
    metrics = {
        "Precision": q.get("precision", float("nan")) or 0.0,
        "Recall": q.get("recall", float("nan")) or 0.0,
        "Lead time / 7d": (q.get("mean_lead_time_days") or 0.0) / 7,
    }
    colors = ["C0", "C2", "C1"]
    bars = ax.bar(metrics.keys(), metrics.values(), color=colors)
    for bar, value in zip(bars, metrics.values()):
        ax.text(bar.get_x() + bar.get_width() / 2, value + 0.02,
                f"{value:.2f}", ha="center", fontsize=10, fontweight="bold")
    ax.set_ylim(0, 1.15)
    ax.set_title(
        f"Alert quality "
        f"({q['n_alerts']} alerts, {q['n_breaches']} breaches; "
        f"avg lead = {q.get('mean_lead_time_days', float('nan')):.1f} d)"
    )
    ax.grid(alpha=0.3, axis="y")

    fig.tight_layout()
    return fig


def plot_alert_timeline(
    report: BacktestReport,
    daily_balances: pd.DataFrame,
    account_config: AccountConfig,
) -> plt.Figure:
    """Full balance history with alerts and breaches overlaid.

    This is the picture that answers the credibility question: "did the
    alerts come in time?" The orange tick is when an alert fired; the
    red X is when an actual breach occurred. The horizontal distance
    between a tick and the next X is the lead time.
    """

    acct = daily_balances[daily_balances["account_id"] == account_config.account_id]
    acct = acct.sort_values("date")
    alerts = report.alerts[report.alerts["account_id"] == account_config.account_id]
    breaches = report.actual_breaches[
        report.actual_breaches["account_id"] == account_config.account_id
    ]

    fig, ax = plt.subplots(1, 1, figsize=(14, 6))
    ax.plot(acct["date"], acct["ledger_balance"], color="C0", lw=1,
            label="ledger balance")
    ax.axhline(account_config.min_balance, color="red", ls="--", lw=1,
               label="min_balance")
    ax.axhline(account_config.min_balance + account_config.alert_buffer,
               color="orange", ls=":", lw=1, label="alert buffer")

    # Place alert ticks just above the min_balance line so they're
    # readable regardless of where the actual balance line is.
    y_ticks = account_config.min_balance + account_config.alert_buffer * 0.5
    if not alerts.empty:
        ax.scatter(alerts["as_of"], [y_ticks] * len(alerts),
                   marker="v", color="orange", alpha=0.6, s=40,
                   label=f"alerts ({len(alerts)})", zorder=4)
    if not breaches.empty:
        ax.scatter(breaches["breach_date"], breaches["ledger_balance"],
                   marker="x", color="red", s=80,
                   label=f"breaches ({len(breaches)})", zorder=5)

    ax.set_title(
        f"{account_config.account_id}: balance with alerts and breaches"
    )
    ax.set_ylabel(account_config.currency)
    ax.yaxis.set_major_formatter(_money_formatter(account_config.currency))
    ax.legend(loc="best", fontsize=8)
    ax.grid(alpha=0.3)

    fig.tight_layout()
    return fig


def plot_feature_importance(
    forecast: ForecastResult,
    top_n: int = 15,
) -> plt.Figure:
    """Horizontal bar chart of the top-N features for the P50 model."""

    pairs = forecast.feature_importance[:top_n][::-1]   # reverse for h-bar
    names = [n for n, _ in pairs]
    values = [v for _, v in pairs]

    fig, ax = plt.subplots(1, 1, figsize=(10, max(4, 0.35 * len(pairs))))
    ax.barh(names, values, color="C0")
    ax.set_title(f"{forecast.account_id}: top {len(pairs)} P50 features")
    ax.set_xlabel("Importance (gain)")
    ax.grid(alpha=0.3, axis="x")
    fig.tight_layout()
    return fig
