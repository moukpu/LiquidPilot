"""Global engine state and warm-up.

On FastAPI startup we run Azim's pipeline once:
  1. Generate synthetic dataset (3 accounts x 540 days x ~23k transactions).
  2. Train per-account quantile XGBoost models (P05/P50/P95).
  3. Cache the dataset (parquet) and models (pickle) under `data/cache/`.
  4. Pre-compute the 7-day forecast so the first API call is instant.

Subsequent restarts skip steps 1-3 if the cache files are present.
"""

from __future__ import annotations

import logging
import pickle
import traceback
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional

import pandas as pd

from app.services.liquidity import (
    LiquidityForecaster,
    MockDataGenerator,
    RiskManager,
)
from app.services.liquidity.config import default_system_config

logger = logging.getLogger(__name__)

CACHE_DIR = Path("data/cache")
# Bumped to v2 when the `clearing_delayed` column was added to transactions
# so a stale cache from before the schema change is bypassed and regenerated.
TX_CACHE = CACHE_DIR / "transactions_v2.parquet"
BAL_CACHE = CACHE_DIR / "daily_balances_v2.parquet"
MODELS_CACHE = CACHE_DIR / "forecaster_v2.pkl"
FORECAST_CACHE = CACHE_DIR / "forecast_v2.pkl"


@dataclass
class EngineState:
    ready: bool = False
    warmed_at: Optional[datetime] = None
    transactions: Optional[pd.DataFrame] = None
    daily_balances: Optional[pd.DataFrame] = None
    forecaster: Optional[LiquidityForecaster] = None
    forecasts: Dict = field(default_factory=dict)
    error: Optional[str] = None


state = EngineState()


def warm_up(force_retrain: bool = False) -> None:
    """Run or reuse the Azim engine. Idempotent."""

    logger.info("warm_up() called — starting...")
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    config = default_system_config()

    try:
        if (
            not force_retrain
            and TX_CACHE.exists()
            and BAL_CACHE.exists()
            and MODELS_CACHE.exists()
            and FORECAST_CACHE.exists()
        ):
            logger.info("Loading liquidity engine from cache...")
            state.transactions = pd.read_parquet(TX_CACHE)
            state.daily_balances = pd.read_parquet(BAL_CACHE)
            with MODELS_CACHE.open("rb") as f:
                state.forecaster = pickle.load(f)
            with FORECAST_CACHE.open("rb") as f:
                state.forecasts = pickle.load(f)
        else:
            logger.info("Cold start: generating data and training models (~75s)...")
            gen = MockDataGenerator(config)
            ds = gen.generate()
            state.transactions = ds.transactions
            state.daily_balances = ds.daily_balances

            state.forecaster = LiquidityForecaster(config)
            state.forecaster.fit(ds.daily_balances, validation_days=30)
            state.forecasts = state.forecaster.forecast(ds.daily_balances)

            state.transactions.to_parquet(TX_CACHE)
            state.daily_balances.to_parquet(BAL_CACHE)
            with MODELS_CACHE.open("wb") as f:
                pickle.dump(state.forecaster, f)
            with FORECAST_CACHE.open("wb") as f:
                pickle.dump(state.forecasts, f)

        state.ready = True
        state.warmed_at = datetime.utcnow()
        logger.info(
            "warm_up() complete — accounts=%d, transactions=%d, forecasts=%d",
            len(state.daily_balances.account_id.unique()) if state.daily_balances is not None else 0,
            len(state.transactions) if state.transactions is not None else 0,
            len(state.forecasts),
        )
    except Exception as exc:
        logger.error("Engine warm-up FAILED: %s\n%s", exc, traceback.format_exc())
        state.error = str(exc)
        state.ready = False


def get_risk_manager() -> RiskManager:
    return RiskManager(default_system_config())
