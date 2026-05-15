from fastapi import APIRouter, HTTPException, Query
import pandas as pd
from app.services.engine_state import state

router = APIRouter()


@router.get("/recent")
def recent(days: int = Query(7, ge=1, le=60)):
    if not state.ready:
        raise HTTPException(503, "Engine warming up")
    tx = state.transactions
    cutoff = tx["booking_date"].max() - pd.Timedelta(days=days)
    sliced = tx[tx["booking_date"] >= cutoff].copy()
    sliced["booking_date"] = sliced["booking_date"].dt.strftime("%Y-%m-%d")
    sliced["value_date"] = sliced["value_date"].dt.strftime("%Y-%m-%d")
    return sliced.tail(500).to_dict(orient="records")


@router.get("/in-flight")
def in_flight():
    if not state.ready:
        raise HTTPException(503, "Engine warming up")
    tx = state.transactions
    today = tx["booking_date"].max()
    flying = tx[(tx["booking_date"] <= today) & (tx["value_date"] > today)].copy()
    flying["booking_date"] = flying["booking_date"].dt.strftime("%Y-%m-%d")
    flying["value_date"] = flying["value_date"].dt.strftime("%Y-%m-%d")
    return flying.to_dict(orient="records")
