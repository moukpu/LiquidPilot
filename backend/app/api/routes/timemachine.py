"""Stress-test endpoint for the Time Machine page.

POST /timemachine/simulate accepts a scenario + parameters and returns a
``StressResult`` (see ``app.services.liquidity.stress``). The stress
engine is a deterministic transform over the cached baseline P50 — no
re-training, no Monte Carlo.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.engine_state import state
from app.services.liquidity.config import default_system_config
from app.services.liquidity.stress import (
    Scenario,
    StressParams,
    apply_scenario,
)

router = APIRouter()


class StressRequest(BaseModel):
    scenario: Scenario
    rail: Optional[str] = None
    extra_days: int = 0
    multiplier: float = 1.0
    affected_rail: Optional[str] = None
    country: Optional[str] = None
    holiday_days: int = 0
    fx_currency: Optional[str] = None
    fx_shock_pct: float = 0.0
    counterparty_account: Optional[str] = None
    frozen_account: Optional[str] = None
    freeze_days: int = 0


@router.post("/simulate")
def simulate(req: StressRequest):
    if not state.ready:
        raise HTTPException(503, "Engine warming up")

    params = StressParams(
        scenario=req.scenario,
        rail=req.rail,
        extra_days=req.extra_days,
        multiplier=req.multiplier,
        affected_rail=req.affected_rail,
        country=req.country,
        holiday_days=req.holiday_days,
        fx_currency=req.fx_currency,
        fx_shock_pct=req.fx_shock_pct,
        counterparty_account=req.counterparty_account,
        frozen_account=req.frozen_account,
        freeze_days=req.freeze_days,
    )
    result = apply_scenario(
        baseline_forecast=state.forecasts,
        accounts_config=default_system_config(),
        transactions=state.transactions,
        params=params,
    )
    return result
