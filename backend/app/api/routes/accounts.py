from fastapi import APIRouter, HTTPException
from app.services.engine_state import state
from app.services.liquidity.config import default_system_config

router = APIRouter()


@router.get("/")
def list_accounts():
    if not state.ready:
        raise HTTPException(503, "Engine warming up")
    cfg = default_system_config()
    balances = state.daily_balances.sort_values("date").groupby("account_id").tail(1)
    bal_map = {row.account_id: row for row in balances.itertuples()}
    return [
        {
            "account_id": acc.account_id,
            "currency": acc.currency,
            "country": acc.country,
            "opening_balance": acc.opening_balance,
            "min_balance": acc.min_balance,
            "alert_buffer": acc.alert_buffer,
            "current_ledger_balance": float(bal_map[acc.account_id].ledger_balance),
            "current_booking_balance": float(bal_map[acc.account_id].booking_balance),
            "in_transit": float(bal_map[acc.account_id].in_transit),
        }
        for acc in cfg.accounts
    ]


@router.get("/{account_id}/balance-history")
def balance_history(account_id: str, days: int = 90):
    if not state.ready:
        raise HTTPException(503, "Engine warming up")
    df = state.daily_balances[state.daily_balances.account_id == account_id].tail(days)
    if df.empty:
        raise HTTPException(404, f"Account {account_id} not found")
    return df.assign(date=df["date"].dt.strftime("%Y-%m-%d")).to_dict(orient="records")


@router.get("/{account_id}/forecast")
def forecast(account_id: str):
    if not state.ready:
        raise HTTPException(503, "Engine warming up")
    if account_id not in state.forecasts:
        raise HTTPException(404, f"No forecast for {account_id}")
    res = state.forecasts[account_id]
    df = res.forecast.copy()
    df["date"] = df["date"].dt.strftime("%Y-%m-%d")
    return {
        "account_id": account_id,
        "forecast": df.to_dict(orient="records"),
        "top_features": res.feature_importance[:10],
    }
