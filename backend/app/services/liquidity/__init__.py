"""Predictive Liquidity Management System.

A modular framework for forecasting cash flows and predicting liquidity
deficits across multiple accounts/currencies. Designed to replace static
"dead reserves" with proactive, model-driven funding decisions.
"""

from .backtester import Backtester, BacktestReport
from .config import AccountConfig, PaymentType, SystemConfig
from .data_generator import MockDataGenerator
from .feature_engineering import FeatureEngineer
from .forecaster import LiquidityForecaster
from .risk_manager import RiskManager, RiskAlert, TransferSuggestion
from .visualization import (
    plot_account_overview,
    plot_alert_timeline,
    plot_backtest_summary,
    plot_feature_importance,
)

__all__ = [
    "AccountConfig",
    "PaymentType",
    "SystemConfig",
    "MockDataGenerator",
    "FeatureEngineer",
    "LiquidityForecaster",
    "RiskManager",
    "RiskAlert",
    "TransferSuggestion",
    "Backtester",
    "BacktestReport",
    "plot_account_overview",
    "plot_alert_timeline",
    "plot_backtest_summary",
    "plot_feature_importance",
]
