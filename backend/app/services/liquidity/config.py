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
    ACH = "ACH"              # US batch / NACHA, T+1 / T+2


# Clearing delay distribution per rail, expressed in business days.
# Stored as (min_days, max_days). Sampling is uniform within the range.
# These numbers reflect typical correspondent-banking SLAs; tune per institution.
CLEARING_DELAYS: Dict[PaymentType, tuple] = {
    PaymentType.SEPA: (0, 1),
    PaymentType.SWIFT: (2, 3),
    PaymentType.CARD: (1, 5),
    PaymentType.INTERNAL: (0, 0),
    PaymentType.ACH: (1, 2),
}


# Static FX snapshot used to express multi-currency totals in a single
# numeraire (USD) for the radar insight widgets. This is intentionally a
# constant rather than a live feed: the radar values are operational
# guides, not P&L. Update by hand if rates drift materially.
FX_RATES_TO_USD: Dict[str, float] = {
    "EUR": 1.08,
    "USD": 1.00,
    "GBP": 1.27,
    "CHF": 1.10,
    # 1 JPY ≈ $0.0067 (≈ 150 JPY/USD). JPY balances run ~100× larger
    # nominal values; the forecaster scales internally per-account so
    # this doesn't poison feature engineering.
    "JPY": 0.0067,
    "SGD": 0.74,
    # 1 KZT ≈ $0.0022 (≈ 450 KZT/USD). Like JPY, balances run with
    # large nominal values — ~₸2.5B ≈ $5.5M.
    "KZT": 0.0022,
}


# Probability per booked transaction that its clearing slips past the
# nominal rail SLA by an extra 1-2 days. Keyed by rail because real-world
# reliability differs substantially: INTERNAL is a ledger move, SWIFT
# traverses a correspondent chain with FX legs and compliance holds.
# Numbers chosen to match published industry on-time rates within a few
# points — tune per institution if you have your own SLA telemetry.
DELAY_OVERFLOW_PROB: Dict[str, float] = {
    "INTERNAL": 0.005,  # ~99.5% on time — same-system ledger moves
    "SEPA":     0.04,   # ~96% — modern, regulated, well-monitored rail
    "ACH":      0.06,   # ~94% — older US batch system, NSF returns
    "CARD":     0.10,   # ~90% — interchange holds, chargebacks
    "SWIFT":    0.18,   # ~82% — multi-hop correspondent chain, FX, compliance
}


# Human-readable SLA window per rail, surfaced in the Rail Reliability
# widget. Keys are PaymentType values.
EXPECTED_DELAY_RANGES: Dict[str, str] = {
    "INTERNAL": "T+0",
    "SEPA": "T+0..1",
    "ACH": "T+1..2",
    "SWIFT": "T+2..3",
    "CARD": "T+1..5",
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
    """Return a realistic 9-account default for demos and tests.

    Numbers are illustrative but kept on the same order of magnitude as
    a mid-sized fintech to keep alert/routing logic non-trivial. The
    fleet spans EUR/USD/GBP/CHF/JPY/SGD/KZT across DE/US/GB/CH/JP/SG/KZ
    so the radar globe and bank-holiday stress test have geographic +
    currency diversity.
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
            PaymentType.SWIFT: 0.45,
            PaymentType.ACH: 0.25,
            PaymentType.CARD: 0.20,
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

    eur_berlin = AccountConfig(
        account_id="EUR-Berlin",
        currency="EUR",
        opening_balance=8_000_000,
        min_balance=1_500_000,
        alert_buffer=1_000_000,
        country="DE",
        inflow_mean=1_500_000,
        inflow_std=400_000,
        outflow_mean=1_500_000,
        outflow_std=420_000,
        # Heavy INTERNAL share — sister account to EUR-Main, frequent
        # book transfers within the same banking group.
        payment_mix={
            PaymentType.INTERNAL: 0.40,
            PaymentType.SEPA: 0.45,
            PaymentType.SWIFT: 0.10,
            PaymentType.CARD: 0.05,
        },
    )

    usd_la = AccountConfig(
        account_id="USD-LA",
        currency="USD",
        opening_balance=14_000_000,
        min_balance=2_500_000,
        alert_buffer=1_500_000,
        country="US",
        inflow_mean=2_500_000,
        inflow_std=800_000,
        outflow_mean=2_500_000,
        outflow_std=830_000,
        payment_mix={
            PaymentType.SWIFT: 0.25,
            PaymentType.ACH: 0.30,
            PaymentType.CARD: 0.30,
            PaymentType.INTERNAL: 0.15,
        },
    )

    chf_zurich = AccountConfig(
        account_id="CHF-Zurich",
        currency="CHF",
        opening_balance=7_000_000,
        min_balance=1_500_000,
        alert_buffer=1_000_000,
        country="CH",
        inflow_mean=1_200_000,
        inflow_std=350_000,
        outflow_mean=1_200_000,
        outflow_std=360_000,
        payment_mix={
            PaymentType.SWIFT: 0.55,
            PaymentType.SEPA: 0.30,
            PaymentType.INTERNAL: 0.10,
            PaymentType.CARD: 0.05,
        },
    )

    jpy_tokyo = AccountConfig(
        account_id="JPY-Tokyo",
        currency="JPY",
        # JPY balances are typically large nominal values; ¥1.5B ≈ $10M.
        opening_balance=1_500_000_000,
        min_balance=300_000_000,
        alert_buffer=200_000_000,
        country="JP",
        inflow_mean=200_000_000,
        inflow_std=60_000_000,
        outflow_mean=200_000_000,
        outflow_std=62_000_000,
        payment_mix={
            PaymentType.SWIFT: 0.60,
            PaymentType.CARD: 0.30,
            PaymentType.INTERNAL: 0.10,
        },
    )

    sgd_singapore = AccountConfig(
        account_id="SGD-Singapore",
        currency="SGD",
        opening_balance=9_000_000,
        min_balance=1_500_000,
        alert_buffer=1_000_000,
        country="SG",
        inflow_mean=1_300_000,
        inflow_std=400_000,
        outflow_mean=1_300_000,
        outflow_std=420_000,
        payment_mix={
            PaymentType.SWIFT: 0.50,
            PaymentType.CARD: 0.30,
            PaymentType.INTERNAL: 0.20,
        },
    )

    # KZT (Kazakhstan tenge): ≈ 450 KZT/USD, balances run nominally large
    # (₸2.5B ≈ $5.5M). Active Central Asian fintech hub with strong
    # card + SWIFT rails. Tenge is the only Central Asian currency in
    # the demo so KZ stress branches are isolated.
    kzt_almaty = AccountConfig(
        account_id="KZT-Almaty",
        currency="KZT",
        opening_balance=2_500_000_000,
        min_balance=500_000_000,
        alert_buffer=300_000_000,
        country="KZ",
        inflow_mean=350_000_000,
        inflow_std=100_000_000,
        outflow_mean=350_000_000,
        outflow_std=105_000_000,
        payment_mix={
            PaymentType.SWIFT: 0.45,
            PaymentType.CARD: 0.35,
            PaymentType.INTERNAL: 0.20,
        },
    )

    return SystemConfig(accounts=[
        eur_main,
        usd_corr,
        gbp_local,
        eur_berlin,
        usd_la,
        chf_zurich,
        jpy_tokyo,
        sgd_singapore,
        kzt_almaty,
    ])
