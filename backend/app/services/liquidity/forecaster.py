"""Cash-flow forecasting with quantile bands.

Design choices
--------------
* **One model per account, per quantile.** Liquidity profiles differ
  wildly across currencies/rails, and we want per-tail estimates so the
  risk module can alert on the *pessimistic* trajectory (P05), not the
  central one. We train three quantile heads: P05 (worst-case), P50
  (median), P95 (best-case). 3 quantiles × N accounts is a small number
  of models; sequential fitting is fine.

* **XGBoost quantile loss.** Cash-flow features are tabular with strong
  non-linear interactions. Gradient-boosted trees handle that without
  any feature crossing and are robust to outliers — important because
  real flows have a heavy tail. Quantile loss
  (`objective="reg:quantileerror"`) is the principled way to estimate
  the tails.

* **Recursive multi-step forecasting on the P50 path.** We roll forward
  the median's predictions into the lag features. The P05 and P95
  predictions at each step are conditional on that same trajectory —
  i.e. "given the median path, what's the worst-case daily flow?"
  This is a standard simplification; the alternative (joint quantile
  Monte Carlo) is overkill for a 7-day horizon.

* **Forecast target = net_flow_settled.** That's the number that drives
  the *settled* ledger balance, which is what actually constrains
  outgoing payments. Predicting booking-balance flow is interesting but
  not what causes a cash gap.

* **Cumulative P05 caveat.** Summing per-day P05 flows produces a
  pessimistic-on-every-day cumulative line. That is more conservative
  than a calibrated joint P05 of cumulative flow — which is fine for
  risk alerts (better to over-warn) but should not be interpreted as a
  literal 5% quantile of the 7-day balance distribution. Documented
  here because it will inevitably come up in a treasury review.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import pandas as pd

try:
    from xgboost import XGBRegressor
    _HAS_XGB = True
except ImportError:  # pragma: no cover
    _HAS_XGB = False
    from sklearn.ensemble import GradientBoostingRegressor

from sklearn.metrics import mean_absolute_error

from .config import SystemConfig, default_system_config
from .feature_engineering import FeatureEngineer


# Columns that are NOT model features. Anything else in the feature
# DataFrame is treated as numeric input. Centralizing this list avoids
# silent leakage of e.g. `target` or `account_id` into the model.
_NON_FEATURE_COLUMNS = {
    "date",
    "account_id",
    "currency",
    "target",
    # Raw daily quantities are leaky if used at the prediction date
    # itself — only their lagged versions are safe.
    "net_flow_settled",
    "net_flow_booked",
    "ledger_balance",
    "booking_balance",
    "in_transit",
}


# Quantiles used everywhere. P50 is the central estimate (used for
# point-forecast metrics and as the trajectory for recursive lags).
# P05 / P95 form a 90% interval that the risk module can react to.
DEFAULT_QUANTILES: Tuple[float, ...] = (0.05, 0.50, 0.95)


def _q_suffix(q: float) -> str:
    """`0.05 -> "p05"`. Zero-padded so columns sort sensibly."""

    return f"p{int(round(q * 100)):02d}"


@dataclass
class ForecastResult:
    """Per-account forecast output.

    Attributes:
        account_id: Account this forecast belongs to.
        forecast: DataFrame with columns:
            `date`,
            `predicted_net_flow_p05/p50/p95`,
            `predicted_ledger_balance_p05/p50/p95`,
            and `predicted_net_flow`/`predicted_ledger_balance` aliases
            for P50 (kept for backward compatibility with callers that
            don't care about uncertainty).
        feature_importance: Sorted (feature, importance) pairs from the
            P50 booster. Useful for monitoring drift.
    """

    account_id: str
    forecast: pd.DataFrame
    feature_importance: List[tuple] = field(default_factory=list)


class LiquidityForecaster:
    """Trains per-account quantile models and produces a forward forecast."""

    def __init__(
        self,
        config: Optional[SystemConfig] = None,
        feature_engineer: Optional[FeatureEngineer] = None,
        horizon: Optional[int] = None,
        quantiles: Optional[Tuple[float, ...]] = None,
    ) -> None:
        self.config = config or default_system_config()
        self.feature_engineer = feature_engineer or FeatureEngineer(self.config)
        self.horizon = horizon or self.config.forecast_horizon
        self.quantiles: Tuple[float, ...] = tuple(quantiles or DEFAULT_QUANTILES)
        if 0.5 not in self.quantiles:
            # The P50 model is special-cased as the "central" trajectory
            # for recursive forecasting and as the backward-compat alias.
            raise ValueError("`quantiles` must include 0.5 (median).")

        # account_id -> quantile -> fitted model
        self.models: Dict[str, Dict[float, object]] = {}
        self.feature_cols: Dict[str, List[str]] = {}

    # ------------------------------------------------------------------
    # Training
    # ------------------------------------------------------------------
    def fit(
        self,
        daily_balances: pd.DataFrame,
        validation_days: int = 30,
    ) -> Dict[str, float]:
        """Fit quantile models per account; return P50 hold-out MAE.

        `validation_days` are held out from the tail of each series for a
        time-aware hold-out evaluation. We deliberately do NOT shuffle —
        random splits leak future information into the training set and
        produce wildly optimistic metrics for time series.

        Set `validation_days=0` to train on the entire history (used by
        the backtester, which manages its own splits).
        """

        features = self.feature_engineer.build_features(daily_balances)
        backtest_scores: Dict[str, float] = {}

        for account_id, group in features.groupby("account_id"):
            group = group.sort_values("date").reset_index(drop=True)

            feature_cols = [
                c for c in group.columns if c not in _NON_FEATURE_COLUMNS
            ]
            self.feature_cols[account_id] = feature_cols

            if validation_days > 0 and len(group) > validation_days:
                split_idx = len(group) - validation_days
                train = group.iloc[:split_idx]
                valid = group.iloc[split_idx:]
            else:
                train = group
                valid = group.iloc[0:0]  # empty

            X_train, y_train = train[feature_cols], train["target"]

            self.models[account_id] = {}
            for q in self.quantiles:
                model = self._make_model(q)
                model.fit(X_train, y_train)
                self.models[account_id][q] = model

            # Report MAE on the P50 head — that's the metric a treasury
            # team will care about ("how far off is the typical forecast?").
            if len(valid) > 0:
                preds = self.models[account_id][0.5].predict(valid[feature_cols])
                backtest_scores[account_id] = float(
                    mean_absolute_error(valid["target"], preds)
                )
            else:
                backtest_scores[account_id] = float("nan")

        return backtest_scores

    def _make_model(self, quantile: float):
        """Construct a quantile regressor for one quantile head.

        Hyperparameters are deliberately conservative: shallow trees
        (max_depth=5), modest learning rate, L2 regularization. With a
        few hundred daily rows per account the defaults would overfit.
        """

        if _HAS_XGB:
            return XGBRegressor(
                objective="reg:quantileerror",
                quantile_alpha=quantile,
                n_estimators=400,
                max_depth=5,
                learning_rate=0.05,
                subsample=0.9,
                colsample_bytree=0.9,
                reg_lambda=1.0,
                random_state=self.config.random_seed,
                tree_method="hist",
                n_jobs=-1,
            )
        # Fallback for environments without xgboost. Slower and slightly
        # less accurate but keeps the system runnable.
        return GradientBoostingRegressor(
            loss="quantile",
            alpha=quantile,
            n_estimators=400,
            max_depth=4,
            learning_rate=0.05,
            random_state=self.config.random_seed,
        )

    # ------------------------------------------------------------------
    # Inference
    # ------------------------------------------------------------------
    def forecast(
        self, daily_balances: pd.DataFrame
    ) -> Dict[str, ForecastResult]:
        """Produce a `horizon`-day forecast for every account.

        Strategy: recursive multi-step on the P50 trajectory. For each
        future day we:
          1. Build features from the running history (real + P50 predicted).
          2. Predict all quantile heads for that day.
          3. Append a synthetic row with the *P50* predicted net flow so
             the next iteration's lag features see a consistent path.

        Returns:
            Dict keyed by account_id with ForecastResult per account.
        """

        if not self.models:
            raise RuntimeError("Call fit() before forecast().")

        results: Dict[str, ForecastResult] = {}

        for account_id, group in daily_balances.groupby("account_id"):
            history = group.sort_values("date").reset_index(drop=True).copy()
            models_q = self.models[account_id]
            feature_cols = self.feature_cols[account_id]

            # Per-quantile running balance. P05 sums the pessimistic
            # daily flows; P95 the optimistic ones. See module docstring
            # for the caveat about marginal-vs-joint quantiles.
            running_balances: Dict[float, float] = {
                q: float(history["ledger_balance"].iloc[-1]) for q in self.quantiles
            }
            predictions: List[Dict] = []

            for step in range(1, self.horizon + 1):
                target_date = history["date"].iloc[-1] + pd.Timedelta(days=1)
                row = self.feature_engineer.build_inference_row(
                    history, target_date, account_id
                )
                # Some lag features at the very edge can still be NaN
                # for very short histories. Filling with 0 keeps the
                # direction of the forecast honest.
                X = row[feature_cols].fillna(0.0).values

                preds_by_q: Dict[float, float] = {}
                for q, model in models_q.items():
                    preds_by_q[q] = float(model.predict(X)[0])

                # Enforce monotonicity of quantile predictions. Quantile
                # heads are trained independently so they can cross on
                # rare inputs (P05 > P50). We sort the predictions per
                # step so downstream consumers can rely on the band
                # being well-formed.
                ordered = sorted(self.quantiles)
                sorted_preds = sorted(preds_by_q[q] for q in ordered)
                preds_by_q = {q: v for q, v in zip(ordered, sorted_preds)}

                for q in self.quantiles:
                    running_balances[q] += preds_by_q[q]

                row_dict: Dict = {"date": target_date}
                for q in self.quantiles:
                    s = _q_suffix(q)
                    row_dict[f"predicted_net_flow_{s}"] = preds_by_q[q]
                    row_dict[f"predicted_ledger_balance_{s}"] = running_balances[q]
                # Backward-compat aliases for callers that just want a
                # point forecast (e.g. plotting, simple reporting).
                row_dict["predicted_net_flow"] = preds_by_q[0.5]
                row_dict["predicted_ledger_balance"] = running_balances[0.5]
                predictions.append(row_dict)

                # Roll forward with the P50 flow so lag features stay
                # on the central trajectory.
                p50_flow = preds_by_q[0.5]
                next_row = pd.DataFrame(
                    {
                        "date": [target_date],
                        "account_id": [account_id],
                        "currency": [history["currency"].iloc[-1]],
                        "ledger_balance": [running_balances[0.5]],
                        "booking_balance": [history["booking_balance"].iloc[-1] + p50_flow],
                        "in_transit": [history["in_transit"].iloc[-1]],
                        "net_flow_settled": [p50_flow],
                        "net_flow_booked": [p50_flow],
                    }
                )
                for col in history.columns:
                    if col.startswith("in_transit_") and col not in next_row.columns:
                        next_row[col] = history[col].iloc[-1]
                history = pd.concat([history, next_row], ignore_index=True)

            forecast_df = pd.DataFrame(predictions)
            importances = self._extract_importances(models_q[0.5], feature_cols)
            results[account_id] = ForecastResult(
                account_id=account_id,
                forecast=forecast_df,
                feature_importance=importances,
            )

        return results

    @staticmethod
    def _extract_importances(model, feature_cols: List[str]) -> List[tuple]:
        importances = getattr(model, "feature_importances_", None)
        if importances is None:
            return []
        pairs = list(zip(feature_cols, importances.tolist()))
        pairs.sort(key=lambda kv: kv[1], reverse=True)
        return pairs
