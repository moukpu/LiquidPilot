"""Contagion endpoints — graph snapshot + cascade simulator.

``GET /contagion/network`` returns the bilateral exposure graph (nodes +
edges) for the frontend visualisation. ``POST /contagion/simulate`` runs
a single shock scenario through the network and returns the cascade.
"""

from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.engine_state import state
from app.services.liquidity.contagion import (
    network_snapshot,
    simulate_cascade,
)

router = APIRouter()


class CascadeRequest(BaseModel):
    shocked_account_id: str
    intensity: float = Field(default=1.0, ge=0.0, le=1.0)
    horizon_days: int = Field(default=7, ge=1, le=30)


@router.get("/network")
def get_network():
    """Return the bilateral exposure graph for the frontend.

    Safe to call before warm-up (returns opening balances as the
    ``current_balance_usd`` proxy).
    """

    daily = state.daily_balances if state.ready else None
    return network_snapshot(daily_balances=daily)


@router.post("/simulate")
def simulate(req: CascadeRequest):
    if not state.ready:
        raise HTTPException(503, "Engine warming up")
    try:
        result = simulate_cascade(
            shocked_account_id=req.shocked_account_id,
            intensity=req.intensity,
            horizon_days=req.horizon_days,
            daily_balances=state.daily_balances,
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    return {
        "shocked_account_id": result.shocked_account_id,
        "intensity": result.intensity,
        "horizon_days": result.horizon_days,
        "affected": [asdict(h) for h in result.affected],
        "breached_count": result.breached_count,
        "total_loss_usd": result.total_loss_usd,
    }
