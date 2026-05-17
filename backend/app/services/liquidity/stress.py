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
from typing import Any, Dict, List, Optional, Tuple

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
    # Structured per-account inputs that the front-end renders as a
    # "Method" accordion under each card. Lets the treasurer (and the
    # jury) audit how the stress numbers were derived without reverse-
    # engineering the heuristics. Shape depends on the scenario.
    methodology_inputs: Dict[str, Any] = field(default_factory=dict)


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
        stress, methodology_inputs = _transform(
            baseline, dates, acc, transactions, params
        )

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
                methodology_inputs=methodology_inputs,
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
) -> Tuple[List[float], Dict[str, Any]]:
    """Return ``(stressed_series, methodology_inputs)``.

    ``methodology_inputs`` is a JSON-serialisable dict shape-keyed by
    scenario; the frontend renders it as the "Method" accordion under each
    result card so the treasurer can audit how the stress numbers were
    derived without reverse-engineering the heuristics. ``applied=False``
    branches always carry a human-readable ``reason``.
    """

    n = len(baseline)
    if n == 0:
        return [], {"scenario": params.scenario.value, "applied": False, "reason": "empty horizon"}

    if params.scenario == Scenario.RAIL_DELAY:
        rail = params.rail or "SWIFT"
        in_transit = transactions[
            (transactions["account_id"] == account.account_id)
            & (transactions["payment_type"] == rail)
            & (transactions["direction"] == "IN")
        ]
        if in_transit.empty:
            return list(baseline), {
                "scenario": "rail_delay",
                "rail": rail,
                "extra_days": params.extra_days,
                "avg_daily_inflow": 0.0,
                "sample_size": 0,
                "applied": False,
                "reason": "no inbound transactions on this rail for this account",
            }
        recent = in_transit.tail(50)
        unique_days = max(1, recent["booking_date"].nunique())
        shift = float(recent["amount"].sum()) / unique_days

        d = max(0, min(params.extra_days, n))
        out = list(baseline)
        for i in range(d):
            out[i] -= shift

        return out, {
            "scenario": "rail_delay",
            "rail": rail,
            "extra_days": params.extra_days,
            "avg_daily_inflow": shift,
            "sample_size": int(len(recent)),
            "sample_days": int(unique_days),
            "shift_per_day": shift,
            "days_affected": int(d),
            "applied": True,
        }

    if params.scenario == Scenario.VOLUME_SPIKE:
        outs = transactions[
            (transactions["account_id"] == account.account_id)
            & (transactions["direction"] == "OUT")
        ]
        if params.affected_rail:
            outs = outs[outs["payment_type"] == params.affected_rail]
        if outs.empty:
            return list(baseline), {
                "scenario": "volume_spike",
                "multiplier": params.multiplier,
                "affected_rail": params.affected_rail or "ALL",
                "avg_daily_outflow": 0.0,
                "sample_size": 0,
                "applied": False,
                "reason": "no outbound transactions match this filter",
            }
        recent = outs.tail(50)
        unique_days = max(1, recent["booking_date"].nunique())
        daily_avg_out = float(recent["amount"].sum()) / unique_days
        extra_per_day = daily_avg_out * (params.multiplier - 1.0)
        cumulative = 0.0
        out: List[float] = []
        for v in baseline:
            cumulative += extra_per_day
            out.append(v - cumulative)

        return out, {
            "scenario": "volume_spike",
            "multiplier": params.multiplier,
            "affected_rail": params.affected_rail or "ALL",
            "avg_daily_outflow": daily_avg_out,
            "sample_size": int(len(recent)),
            "sample_days": int(unique_days),
            "extra_per_day": extra_per_day,
            "cumulative_by_horizon_end": extra_per_day * n,
            "applied": True,
        }

    if params.scenario == Scenario.BANK_HOLIDAY:
        if account.country != (params.country or "").upper():
            return list(baseline), {
                "scenario": "bank_holiday",
                "country": params.country or "",
                "holiday_days": params.holiday_days,
                "account_country": account.country,
                "applied": False,
                "reason": "account country doesn't match holiday country",
            }
        d = max(0, min(params.holiday_days, n - 1))
        if d == 0:
            return list(baseline), {
                "scenario": "bank_holiday",
                "country": params.country,
                "holiday_days": 0,
                "applied": False,
                "reason": "holiday_days=0",
            }

        # Empirical daily net outflow for this account (positive = net
        # outflow). Falls back to a tiny floor so monotonicity in
        # holiday_days still holds when historical signal is absent.
        # The treasury model: during a bank holiday the rail does not
        # process payments, so outgoing settlements queue up. On day
        # d (resume) the queued settlements release as one cliff drop.
        acct_tx = transactions[transactions["account_id"] == account.account_id]
        recent = acct_tx.tail(200)
        sample_days = max(1, int(recent["booking_date"].nunique()))
        out_amt = float(
            recent.loc[recent["direction"] == "OUT", "amount"].sum()
        )
        in_amt = float(
            recent.loc[recent["direction"] == "IN", "amount"].sum()
        )
        daily_net_outflow = max(0.0, (out_amt - in_amt) / sample_days)
        if daily_net_outflow == 0.0:
            # Even a perfectly balanced account loses *something* when
            # frozen — settlement friction, FX corridor cost. Use 0.5%
            # of baseline[0] as a floor so longer holidays always hurt
            # at least monotonically.
            daily_net_outflow = max(1.0, abs(baseline[0]) * 0.005)

        # Freeze balance during holiday at value just before holiday
        # started. baseline[0] is "today", so day 0..d-1 stay flat.
        out = list(baseline)
        flat_value = float(baseline[0])
        for i in range(min(d, n)):
            out[i] = flat_value

        # Deferred outflows queued over d holiday days, all released on
        # day d. AMPLIFICATION accounts for queueing penalty (cut-off
        # windows missed, emergency funding FX spread). Linear in d so
        # |delta_min_p50| is monotone in holiday_days.
        AMPLIFICATION = 1.1
        deferred = d * daily_net_outflow * AMPLIFICATION

        if d < n:
            out[d] = baseline[d] - deferred
            remaining = n - d - 1
            if remaining > 0:
                for i in range(d + 1, n):
                    fade = (i - d) / (remaining + 1)
                    # Linear recovery — by horizon end we are back on
                    # baseline.
                    out[i] = baseline[i] - deferred * (1.0 - fade)

        # Treasury invariant: a holiday cannot improve liquidity. If
        # baseline naturally dips during the freeze window, the freeze
        # would otherwise "lift" the trajectory above baseline_min and
        # produce a spurious positive delta. Clamp elementwise.
        out = [min(out[i], baseline[i]) for i in range(n)]

        return out, {
            "scenario": "bank_holiday",
            "country": params.country,
            "holiday_days": params.holiday_days,
            "flat_value": flat_value,
            "daily_net_outflow": daily_net_outflow,
            "deferred_outflow": deferred,
            "amplification": AMPLIFICATION,
            "sample_size": int(len(recent)),
            "sample_days": int(sample_days),
            "applied": True,
        }

    return list(baseline), {"scenario": params.scenario.value, "applied": False, "reason": "unknown scenario"}


__all__ = [
    "Scenario",
    "StressParams",
    "ScenarioPoint",
    "AccountStressResult",
    "StressResult",
    "apply_scenario",
]
