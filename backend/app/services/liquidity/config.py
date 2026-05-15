"""Central configuration for the liquidity management system.

Keeping constants here makes it trivial to:
  - tune business thresholds (minimum balances, alert sensitivity)
  - add new accounts or payment rails without touching business logic
  - run sensitivity analyses by swapping a single config object
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List


class PaymentType(str, Enum):
    """Supported payment rails.

    Each rail has a different settlement window, which drives the
    "in-transit" feature in feature engineering: money is debited /
    credited from the ledger only after the clearing delay elapses.
    """

    SEPA = "SEPA"            # European, T+0 / T+1
    SWIFT = "SWIFT"          # International wires, T+2 / T+3
    CARD = "CARD"            # Card acquiring settlements, up to T+5
    INTERNAL = "INTERNAL"    # Same-bank book transfer, instant


# Clearing delay distribution per rail, expressed in business days.
# Stored as (min_days, max_days). Sampling is uniform within the range.
# These numbers reflect typical correspondent-banking SLAs; tune per institution.
CLEARING_DELAYS: Dict[PaymentType, tuple] = {
    PaymentType.SEPA: (0, 1),
    PaymentType.SWIFT: (2, 3),
    PaymentType.CARD: (1, 5),
    PaymentType.INTERNAL: (0, 0),
}


@dataclass(frozen=True)
class AccountConfig:
    """Static configuration for a single nostro/operational account."""

    account_id: str
    currency: str
    # Starting ledger balance for the simulation.
    opening_balance: float
    # Operational floor: balance must never drop below this number.
    # Below this we cannot honor outgoing settlement obligations.
    min_balance: float
    # Soft alert threshold: trigger a warning when projected balance
    # is within `alert_buffer` above min_balance. Acts as an early
    # warning so treasury has time to act.
    alert_buffer: float
    # Country code used to determine bank holidays (ISO 3166-1 alpha-2).
    country: str
    # Mean and std of daily inflow/outflow used by the mock generator.
    # In production, these would be inferred from historical data.
    inflow_mean: float
    inflow_std: float
    outflow_mean: float
    outflow_std: float
    # Rails this account uses. Determines which clearing delays apply.
    payment_mix: Dict[PaymentType, float] = field(default_factory=dict)


@dataclass(frozen=True)
class SystemConfig:
    """Top-level configuration for a simulation / training run."""

    accounts: List[AccountConfig]
    # Forecast horizon in days. 7 is a typical treasury planning window.
    forecast_horizon: int = 7
    # Number of historical days to synthesize for training/backtest.
    history_days: int = 540
    # Random seed for reproducibility across all stochastic modules.
    random_seed: int = 42


def default_system_config() -> SystemConfig:
    """Return a realistic 3-account default for demos and tests.

    Numbers are illustrative but kept on the same order of magnitude as
    a mid-sized fintech to keep alert/routing logic non-trivial.
    """

    eur_main = AccountConfig(
        account_id="EUR-Main",
        currency="EUR",
        opening_balance=12_000_000,
        min_balance=2_000_000,
        alert_buffer=1_500_000,
        country="DE",
        # Inflow/outflow means kept equal in expectation so the synthetic
        # history doesn't structurally drift over long horizons. Day-to-day
        # variability still comes from the std and the volume multipliers.
        inflow_mean=2_100_000,
        inflow_std=600_000,
        outflow_mean=2_100_000,
        outflow_std=550_000,
        payment_mix={
            PaymentType.SEPA: 0.70,
            PaymentType.SWIFT: 0.10,
            PaymentType.CARD: 0.15,
            PaymentType.INTERNAL: 0.05,
        },
    )

    usd_corr = AccountConfig(
        account_id="USD-Correspondent",
        currency="USD",
        opening_balance=18_000_000,
        min_balance=3_000_000,
        alert_buffer=2_000_000,
        country="US",
        inflow_mean=3_000_000,
        inflow_std=900_000,
        outflow_mean=3_000_000,
        outflow_std=950_000,
        payment_mix={
            PaymentType.SWIFT: 0.65,
            PaymentType.CARD: 0.25,
            PaymentType.INTERNAL: 0.10,
        },
    )

    gbp_local = AccountConfig(
        account_id="GBP-Local",
        currency="GBP",
        opening_balance=6_000_000,
        min_balance=1_000_000,
        alert_buffer=800_000,
        country="GB",
        inflow_mean=900_000,
        inflow_std=300_000,
        outflow_mean=900_000,
        outflow_std=310_000,
        payment_mix={
            PaymentType.SEPA: 0.20,
            PaymentType.SWIFT: 0.30,
            PaymentType.CARD: 0.40,
            PaymentType.INTERNAL: 0.10,
        },
    )

    return SystemConfig(accounts=[eur_main, usd_corr, gbp_local])
