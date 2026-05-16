"""Aggregated insights for the /radar dashboard.

This endpoint returns two derived metrics that don't fit cleanly onto the
existing accounts/transactions/recommendations endpoints:

* **Frozen liquidity** — capital sitting above each account's required
  safety buffer (max of the operational floor and the worst-case 7-day
  P05 forecast). It quantifies how much cash could be deployed overnight
  without risking a breach.
* **Rail reliability** — proportion of recently-booked payments per rail
  that cleared within their nominal SLA. Surfaces which rails to trust
  when a breach is imminent.

Both numbers are recomputed on every request because they're cheap and
the underlying state can shift as new transactions arrive in the warm-up
loop.
"""

from __future__ import annotations

from typing import Dict, List

import pandas as pd
from fastapi import APIRouter, HTTPException

from app.services.engine_state import state
from app.services.liquidity.config import (
    EXPECTED_DELAY_RANGES,
    FX_RATES_TO_USD,
    PaymentType,
    default_system_config,
)

router = APIRouter()


@router.get("/insights")
def insights():
    """Return frozen-capital and rail-reliability stats for /radar."""

    if not state.ready:
        raise HTTPException(503, "Engine warming up")

    cfg = default_system_config()
    balances = state.daily_balances.sort_values("date").groupby("account_id").tail(1)
    bal_map = {row.account_id: row for row in balances.itertuples()}

    # ---- Frozen liquidity per account ------------------------------------
    # safety_buffer = max(operational floor, worst-case forecast P05)
    # frozen        = max(0, current_ledger - safety_buffer)
    frozen_per_account: Dict[str, float] = {}
    total_balance_usd = 0.0
    frozen_total_usd = 0.0

    for acc in cfg.accounts:
        current = float(bal_map[acc.account_id].ledger_balance)
        fc = state.forecasts.get(acc.account_id)
        if fc is not None and "predicted_ledger_balance_p05" in fc.forecast.columns:
            forecast_min_p05 = float(fc.forecast["predicted_ledger_balance_p05"].min())
        else:
            # No forecast yet — fall back to the floor alone.
            forecast_min_p05 = float(acc.min_balance)

        safety_buffer = max(float(acc.min_balance), forecast_min_p05)
        frozen = max(0.0, current - safety_buffer)
        frozen_per_account[acc.account_id] = frozen

        fx = FX_RATES_TO_USD.get(acc.currency, 1.0)
        total_balance_usd += current * fx
        frozen_total_usd += frozen * fx

    # ---- Rail reliability over the last 90 booked days -------------------
    tx: pd.DataFrame = state.transactions
    cutoff = tx["booking_date"].max() - pd.Timedelta(days=90)
    recent = tx[tx["booking_date"] >= cutoff]

    # Defensive: support stale cache that pre-dates the clearing_delayed column.
    if "clearing_delayed" not in recent.columns:
        recent = recent.assign(clearing_delayed=False)

    rail_reliability: Dict[str, dict] = {}
    for rail in PaymentType:
        sub = recent[recent["payment_type"] == rail.value]
        total = int(len(sub))
        delayed = int(sub["clearing_delayed"].sum()) if total else 0
        reliability = (1.0 - delayed / total) * 100.0 if total else 100.0
        rail_reliability[rail.value] = {
            "reliability": reliability,
            "total": total,
            "delayed": delayed,
            "expected_delay_range": EXPECTED_DELAY_RANGES.get(rail.value, ""),
        }

    return {
        "frozen_capital_per_account": frozen_per_account,
        "frozen_capital_total_usd": frozen_total_usd,
        "total_balance_usd": total_balance_usd,
        "rail_reliability": rail_reliability,
    }


__all__: List[str] = ["router"]
