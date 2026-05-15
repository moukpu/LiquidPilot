from dataclasses import asdict
from fastapi import APIRouter, HTTPException
from app.services.engine_state import state, get_risk_manager

router = APIRouter()


@router.get("/")
def recommendations():
    if not state.ready:
        raise HTTPException(503, "Engine warming up")
    rm = get_risk_manager()
    alerts = rm.evaluate(state.forecasts)
    suggestions = rm.suggest_transfers(alerts, state.forecasts)
    return {
        "alerts": [
            {**asdict(a), "breach_date": a.breach_date.strftime("%Y-%m-%d"), "severity": a.severity.value}
            for a in alerts
        ],
        "transfers": [
            {
                **asdict(s),
                "rail": s.rail.value,
                "initiate_by": s.initiate_by.strftime("%Y-%m-%d") if s.initiate_by else None,
            }
            for s in suggestions
        ],
    }
