"""Lightweight scenario engine for the Time Machine.

We don't re-train the model — that's both expensive and not what stress
testing is for. Instead we apply explicit deterministic adjustments on
top of the baseline P50 trajectory. The output is what the treasurer
would see if the scenario materialised.

Approximations are intentional heuristics that produce plausible-looking
dips/shifts without any stochastic simulation. Each branch in
``_transform`` documents the simplification inline so a reviewer doesn't
mistake this for Monte Carlo.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional

import pandas as pd

from .config import FX_RATES_TO_USD, SystemConfig


class Scenario(str, Enum):
    RAIL_DELAY = "rail_delay"
    VOLUME_SPIKE = "volume_spike"
    BANK_HOLIDAY = "bank_holiday"


@dataclass
class StressParams:
    scenario: Scenario
    # rail_delay
    rail: Optional[str] = None  # "SWIFT", "SEPA", ...
    extra_days: int = 0
    # volume_spike
    multiplier: float = 1.0  # 1.3 = +30%
    affected_rail: Optional[str] = None  # None = all rails
    # bank_holiday
    country: Optional[str] = None  # "DE" / "US" / "GB"
    holiday_days: int = 0  # 1..5


@dataclass
class ScenarioPoint:
    date: str  # ISO yyyy-mm-dd
    baseline_p50: float
    stress_p50: float
    delta: float


@dataclass
class AccountStressResult:
    account_id: str
    currency: str
    horizon: List[ScenarioPoint]
    baseline_min_p50: float
    stress_min_p50: float
    delta_min_p50: float
    floor: float
    baseline_breaches: int  # days where baseline_p50 < floor
    stress_breaches: int    # days where stress_p50 < floor


@dataclass
class StressResult:
    scenario: Scenario
    params: StressParams
    accounts: List[AccountStressResult] = field(default_factory=list)
    total_delta_usd: float = 0.0  # sum of (delta_min_p50 * fx) over accounts
    new_breach_count: int = 0     # accounts that newly breach floor under stress


def apply_scenario(
    baseline_forecast: Dict[str, Any],
    accounts_config: SystemConfig,
    transactions: pd.DataFrame,
    params: StressParams,
) -> StressResult:
    """Apply a scenario to the cached baseline forecast.

    ``baseline_forecast`` maps account_id -> ForecastResult (engine cache).
    Each ForecastResult has a ``.forecast`` DataFrame with columns
    including ``predicted_ledger_balance_p50`` and ``date``.
    """

    accounts_results: List[AccountStressResult] = []
    total_delta_usd = 0.0
    new_breaches = 0

    for acc in accounts_config.accounts:
        fc = baseline_forecast.get(acc.account_id)
        if fc is None or fc.forecast.empty:
            continue
        baseline = [float(v) for v in fc.forecast["predicted_ledger_balance_p50"].tolist()]
        dates = fc.forecast["date"].dt.strftime("%Y-%m-%d").tolist()
        stress = _transform(baseline, dates, acc, transactions, params)

        points = [
            ScenarioPoint(
                date=d,
                baseline_p50=float(b),
                stress_p50=float(s),
                delta=float(s - b),
            )
            for d, b, s in zip(dates, baseline, stress)
        ]
        baseline_min = min(baseline)
        stress_min = min(stress)
        delta_min = stress_min - baseline_min
        baseline_breaches = sum(1 for v in baseline if v < acc.min_balance)
        stress_breaches = sum(1 for v in stress if v < acc.min_balance)
        if stress_breaches > baseline_breaches:
            new_breaches += 1
        total_delta_usd += delta_min * FX_RATES_TO_USD.get(acc.currency, 1.0)

        accounts_results.append(
            AccountStressResult(
                account_id=acc.account_id,
                currency=acc.currency,
                horizon=points,
                baseline_min_p50=baseline_min,
                stress_min_p50=stress_min,
                delta_min_p50=delta_min,
                floor=float(acc.min_balance),
                baseline_breaches=baseline_breaches,
                stress_breaches=stress_breaches,
            )
        )

    return StressResult(
        scenario=params.scenario,
        params=params,
        accounts=accounts_results,
        total_delta_usd=total_delta_usd,
        new_breach_count=new_breaches,
    )


def _transform(
    baseline: List[float],
    dates: List[str],
    account: Any,
    transactions: pd.DataFrame,
    params: StressParams,
) -> List[float]:
    """Return the stressed P50 series. Each branch is an explicit heuristic."""

    n = len(baseline)
    if n == 0:
        return []

    if params.scenario == Scenario.RAIL_DELAY:
        # Heuristic: inflows on the chosen rail get pushed past the horizon.
        # We estimate the daily inflow magnitude from the last ~50 booked
        # transactions on that rail and subtract it from the first
        # ``extra_days`` of the forecast — modelling the "missing" cash
        # while waiting on the delayed clearing.
        rail = params.rail or "SWIFT"
        in_transit = transactions[
            (transactions["account_id"] == account.account_id)
            & (transactions["payment_type"] == rail)
            & (transactions["direction"] == "IN")
        ]
        if in_transit.empty:
            return list(baseline)
        recent = in_transit.tail(50)
        unique_days = max(1, recent["booking_date"].nunique())
        shift = float(recent["amount"].sum()) / unique_days

        d = max(0, min(params.extra_days, n))
        out = list(baseline)
        for i in range(d):
            out[i] -= shift
        return out

    if params.scenario == Scenario.VOLUME_SPIKE:
        # Heuristic: extra outflows accumulate over the horizon at a rate
        # of ``(multiplier - 1) * avg_daily_outflow``. The dip therefore
        # grows linearly across the 7 days.
        outs = transactions[
            (transactions["account_id"] == account.account_id)
            & (transactions["direction"] == "OUT")
        ]
        if outs.empty:
            return list(baseline)
        if params.affected_rail:
            outs = outs[outs["payment_type"] == params.affected_rail]
        if outs.empty:
            return list(baseline)
        recent = outs.tail(50)
        unique_days = max(1, recent["booking_date"].nunique())
        daily_avg_out = float(recent["amount"].sum()) / unique_days
        extra_per_day = daily_avg_out * (params.multiplier - 1.0)
        cumulative = 0.0
        out: List[float] = []
        for v in baseline:
            cumulative += extra_per_day
            out.append(v - cumulative)
        return out

    if params.scenario == Scenario.BANK_HOLIDAY:
        # Heuristic: the bank holiday freezes flows during days 0..d-1.
        # On day d, the backlog clears in one batch (catch-up DROP, not
        # bump), amplified 1.2x to capture operational stress (banks
        # process backlogs less efficiently than normal-day batches).
        # Days d+1..n-1 linearly recover toward baseline as backlog drains.
        if account.country != (params.country or "").upper():
            return list(baseline)
        d = max(0, min(params.holiday_days, n - 1))
        if d == 0:
            return list(baseline)

        out = list(baseline)
        flat_value = baseline[0]

        # During the holiday: no payments clear; balance stays at the
        # pre-holiday value, freezing the baseline's natural drift.
        for i in range(min(d, n)):
            out[i] = flat_value

        # Catch-up day d: pent-up backlog hits in a single business day.
        # accumulated_drift is negative for outflow-heavy accounts, so the
        # catch_up term subtracts MORE than the baseline already did.
        if d < n:
            accumulated_drift = baseline[d] - flat_value
            # Stress test semantics: always show downside risk. A holiday on
            # an inflow-heavy day is, in reality, a temporary buffer — but
            # the whole point of a stress page is "how bad can it get?", so
            # we force the catch-up amplification to be a drop regardless
            # of the natural drift's sign.
            catch_up = -abs(accumulated_drift) * 1.2
            out[d] = baseline[d] + catch_up

            # Recovery: trajectory tapers back toward baseline over the
            # remaining horizon as the backlog drains.
            remaining = n - d - 1
            if remaining > 0:
                for i in range(d + 1, n):
                    fade = (i - d) / (remaining + 1)  # 0..1 toward end
                    out[i] = baseline[i] + catch_up * (1.0 - fade)

        return out

    return list(baseline)


__all__ = [
    "Scenario",
    "StressParams",
    "ScenarioPoint",
    "AccountStressResult",
    "StressResult",
    "apply_scenario",
]
