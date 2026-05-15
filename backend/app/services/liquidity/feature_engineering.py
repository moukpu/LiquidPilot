"""Feature engineering for cash-flow forecasting.

The forecasting model only sees what we feed it, so this module is where
the bulk of the modeling judgment lives. We construct three families of
features:

  1. **Calendar features** — capture deterministic seasonality.
     Cash flow on a Monday after a long weekend looks very different
     from a regular Wednesday. Day-of-week, month-end proximity and
     holiday flags account for that without the model having to learn
     it from data.

  2. **Lagged & rolling features** — capture autocorrelation.
     Treasury flows are sticky: today's net flow is highly correlated
     with yesterday's. We add lags (1, 2, 3, 7, 14) plus rolling
     mean/std at 7- and 30-day windows. The 7-day window picks up the
     weekly cycle; 30-day stabilizes against single-day noise.

  3. **In-transit features** — capture the "pipeline" of unsettled cash.
     This is the feature that distinguishes a liquidity model from a
     generic time-series regression: large SWIFT outflows booked today
     hit the account in 2–3 days, so the model gets that signal *before*
     it shows up in the ledger.
"""

from __future__ import annotations

from typing import List, Optional, Set

import numpy as np
import pandas as pd

try:
    import holidays as _holidays
except ImportError:  # pragma: no cover
    _holidays = None

from .config import PaymentType, SystemConfig, default_system_config


class FeatureEngineer:
    """Builds a model-ready feature matrix from daily account balances."""

    # Lags chosen to cover same-day-last-week (7) and two-week (14) cycles.
    LAG_DAYS: List[int] = [1, 2, 3, 7, 14]
    ROLLING_WINDOWS: List[int] = [7, 30]

    def __init__(self, config: Optional[SystemConfig] = None) -> None:
        self.config = config or default_system_config()
        self._holiday_sets = self._build_holiday_sets()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def build_features(
        self,
        daily_balances: pd.DataFrame,
        target_col: str = "net_flow_settled",
        dropna: bool = True,
    ) -> pd.DataFrame:
        """Return a feature matrix joined with the forecast target.

        Args:
            daily_balances: Output of MockDataGenerator.daily_balances.
            target_col: Which series to predict. Default 'net_flow_settled'
                because that's the number that drives the settled ledger
                balance — i.e. the constraint that matters for liquidity.
            dropna: Drop rows where lagged features are NaN (start of
                series). Set False when generating features for inference
                on a tail window where you'll forward-fill instead.

        Returns:
            DataFrame indexed by (account_id, date) with engineered
            features and a `target` column.
        """

        frames = []
        for account_id, group in daily_balances.groupby("account_id"):
            country = self._country_for(account_id)
            frames.append(self._build_for_account(group, country, target_col))
        out = pd.concat(frames, ignore_index=True)
        if dropna:
            out = out.dropna().reset_index(drop=True)
        return out

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------
    def _country_for(self, account_id: str) -> str:
        for acc in self.config.accounts:
            if acc.account_id == account_id:
                return acc.country
        return ""

    def _build_holiday_sets(self) -> dict:
        """Cache holiday dates per country for fast vectorized lookup."""

        out: dict = {}
        if _holidays is None:
            return out
        for acc in self.config.accounts:
            if acc.country in out:
                continue
            try:
                # Wide year range so we cover both training and inference horizons.
                years = list(range(2018, pd.Timestamp.today().year + 2))
                cal = _holidays.country_holidays(acc.country, years=years)
                out[acc.country] = {pd.Timestamp(d).normalize() for d in cal.keys()}
            except (KeyError, NotImplementedError):
                out[acc.country] = set()
        return out

    # ---- per-account feature build ---------------------------------------
    def _build_for_account(
        self, df: pd.DataFrame, country: str, target_col: str
    ) -> pd.DataFrame:
        df = df.sort_values("date").reset_index(drop=True).copy()

        # --- Calendar features ----------------------------------------
        # Day-of-week is the single highest-signal feature in most
        # treasury datasets. We keep it numeric (0..6) so tree models
        # can split on weekday vs weekend; xgboost handles ordinality
        # implicitly via splits.
        df["day_of_week"] = df["date"].dt.dayofweek
        df["is_weekend"] = (df["day_of_week"] >= 5).astype(int)
        df["day_of_month"] = df["date"].dt.day
        df["month"] = df["date"].dt.month
        df["quarter"] = df["date"].dt.quarter

        # Days to end of month: explicit feature so the model doesn't
        # have to learn from day_of_month + month-length interactions.
        df["days_to_eom"] = (
            df["date"] + pd.offsets.MonthEnd(0) - df["date"]
        ).dt.days
        df["is_month_end"] = (df["days_to_eom"] <= 2).astype(int)

        # Holiday flags. is_holiday is the key signal (settlement halt);
        # is_pre/post_holiday captures the volume "spillover" — flows
        # that would have happened on the holiday cluster around it.
        holidays_set: Set[pd.Timestamp] = self._holiday_sets.get(country, set())
        dates = df["date"].dt.normalize()
        df["is_holiday"] = dates.isin(holidays_set).astype(int)
        df["is_pre_holiday"] = (dates + pd.Timedelta(days=1)).isin(holidays_set).astype(int)
        df["is_post_holiday"] = (dates - pd.Timedelta(days=1)).isin(holidays_set).astype(int)

        # --- Target ---------------------------------------------------
        df["target"] = df[target_col]

        # --- Lagged target features -----------------------------------
        for lag in self.LAG_DAYS:
            df[f"target_lag_{lag}"] = df["target"].shift(lag)

        # --- Rolling stats --------------------------------------------
        # We shift before rolling so the window only contains *past*
        # information — using today's value would leak the target.
        shifted = df["target"].shift(1)
        for window in self.ROLLING_WINDOWS:
            df[f"target_roll_mean_{window}"] = shifted.rolling(window).mean()
            df[f"target_roll_std_{window}"] = shifted.rolling(window).std()
            df[f"target_roll_min_{window}"] = shifted.rolling(window).min()
            df[f"target_roll_max_{window}"] = shifted.rolling(window).max()

        # --- Balance-level features -----------------------------------
        # Yesterday's closing balance and in-transit are themselves
        # predictive: when in_transit is heavily negative, more
        # outflows are about to settle and net_flow_settled will drop.
        df["ledger_balance_lag_1"] = df["ledger_balance"].shift(1)
        df["in_transit_lag_1"] = df["in_transit"].shift(1)

        # Per-rail in-transit lags — these are the "early warning"
        # features: SWIFT in-flight today predicts settlement movement
        # in 2-3 days. Without these, the model is essentially blind to
        # the rail-specific clearing structure we built into the data.
        for rail in PaymentType:
            col = f"in_transit_{rail.value}"
            if col in df.columns:
                df[f"{col}_lag_1"] = df[col].shift(1)

        return df

    # ------------------------------------------------------------------
    # Inference-side helper
    # ------------------------------------------------------------------
    def build_inference_row(
        self,
        history: pd.DataFrame,
        target_date: pd.Timestamp,
        account_id: str,
    ) -> pd.DataFrame:
        """Build a single feature row for a *future* date.

        Used during recursive multi-step forecasting: we don't have a
        true `target` for `target_date`, but we have all the calendar
        and lag features as long as `history` already contains the
        days up to `target_date - 1` (possibly with predicted targets
        filled in).
        """

        country = self._country_for(account_id)
        # Append a stub row for the target date so calendar features
        # are computed for it; lags pull from the prior history.
        stub = pd.DataFrame(
            {
                "date": [target_date],
                "account_id": [account_id],
                "ledger_balance": [history["ledger_balance"].iloc[-1]],
                "in_transit": [history["in_transit"].iloc[-1]],
                "net_flow_settled": [np.nan],
                "net_flow_booked": [np.nan],
            }
        )
        for rail in PaymentType:
            col = f"in_transit_{rail.value}"
            if col in history.columns:
                stub[col] = history[col].iloc[-1]

        combined = pd.concat([history, stub], ignore_index=True)
        features = self._build_for_account(combined, country, "net_flow_settled")
        return features.iloc[[-1]].copy()
