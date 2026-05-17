"""Stress engine invariants.

We don't unit-test every numerical heuristic — those drift with model
re-training. Instead we lock down properties the treasurer cares about:

* Bank holiday: longer freeze never produces a *less* damaging delta.
  A 5-day SWIFT freeze on KZ must hurt at least as much as a 1-day one.
* No applied stress can produce a positive `delta_min_p50` — that would
  mean the stress *helped* the account, which is nonsense.
"""

from __future__ import annotations

from app.services.liquidity.config import default_system_config
from app.services.liquidity.stress import (
    Scenario,
    StressParams,
    apply_scenario,
)


def test_bank_holiday_monotonic(engine_ready):
    cfg = default_system_config()
    prev = 0.0
    for d in range(1, 6):
        params = StressParams(
            scenario=Scenario.BANK_HOLIDAY,
            country="KZ",
            holiday_days=d,
        )
        res = apply_scenario(
            baseline_forecast=engine_ready.forecasts,
            accounts_config=cfg,
            transactions=engine_ready.transactions,
            params=params,
        )
        affected = [
            a
            for a in res.accounts
            if a.methodology_inputs.get("applied") is True
        ]
        assert affected, f"day {d}: no applied accounts (KZ should match KZT-Almaty)"
        for a in affected:
            assert a.delta_min_p50 <= 0.001, (
                f"day {d} {a.account_id}: positive delta {a.delta_min_p50}"
            )
        worst = sum(a.delta_min_p50 for a in affected)
        assert worst <= prev + 0.001, (
            f"non-monotonic: d={d} worst={worst} vs prev={prev}"
        )
        prev = worst


def test_no_applied_scenario_helps(engine_ready):
    """No applied stress can produce delta_min_p50 > 0. Tests all 3 scenarios."""
    cfg = default_system_config()

    cases = [
        StressParams(scenario=Scenario.RAIL_DELAY, rail="SWIFT", extra_days=3),
        StressParams(
            scenario=Scenario.VOLUME_SPIKE,
            multiplier=1.5,
            affected_rail="SWIFT",
        ),
        StressParams(
            scenario=Scenario.BANK_HOLIDAY, country="DE", holiday_days=3
        ),
    ]
    for params in cases:
        res = apply_scenario(
            baseline_forecast=engine_ready.forecasts,
            accounts_config=cfg,
            transactions=engine_ready.transactions,
            params=params,
        )
        for a in res.accounts:
            if a.methodology_inputs.get("applied") is True:
                assert a.delta_min_p50 <= 0.001, (
                    f"{params.scenario} {a.account_id}: "
                    f"applied stress with positive delta {a.delta_min_p50}"
                )
