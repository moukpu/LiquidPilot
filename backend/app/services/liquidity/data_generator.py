"""Mock transaction generator for the liquidity system.

This module synthesizes a realistic-looking transaction stream that the
rest of the pipeline can train on. The goal is NOT statistical realism
but to expose the model and risk modules to the kinds of structure that
appear in real treasury data:

  * Weekly seasonality (Mon-Fri volume, weekend lull)
  * End-of-month spikes (payroll / vendor settlement)
  * Bank-holiday gaps (no clearing on official holidays)
  * Payment-rail clearing delays (SEPA T+0/1, SWIFT T+2/3, Card T+1..5)
  * Slow client-behavior drift (outflow trend over time)

Output is two DataFrames:
  * `transactions`: one row per booked transaction with booking + value dates
  * `daily_balances`: one row per (account, date) with ledger + available balance
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

try:
    import holidays as _holidays
except ImportError:  # pragma: no cover - optional dependency at import time
    _holidays = None

from .config import (
    AccountConfig,
    CLEARING_DELAYS,
    DELAY_OVERFLOW_PROB,
    PaymentType,
    SystemConfig,
    default_system_config,
)


@dataclass
class GeneratedDataset:
    """Container returned by MockDataGenerator.

    Splitting transactions and daily balances keeps the API ergonomic:
    feature engineering wants daily aggregates, the risk module wants
    per-transaction in-transit details.
    """

    transactions: pd.DataFrame
    daily_balances: pd.DataFrame


class MockDataGenerator:
    """Generate synthetic but structurally realistic transaction history.

    The generator is deterministic given a seed, which is essential for
    repeatable backtests. All stochastic effects are driven by a single
    `np.random.Generator` so that swapping seeds rotates *everything*
    consistently.
    """

    def __init__(self, config: Optional[SystemConfig] = None) -> None:
        self.config = config or default_system_config()
        self._rng = np.random.default_rng(self.config.random_seed)
        self._holiday_calendars = self._build_holiday_calendars()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def generate(self, end_date: Optional[pd.Timestamp] = None) -> GeneratedDataset:
        """Generate the full dataset.

        Args:
            end_date: Last date in the simulation. Defaults to "today" so
                that downstream forecasts target the immediate future.

        Returns:
            GeneratedDataset with `transactions` and `daily_balances`.
        """

        end_date = pd.Timestamp(end_date or pd.Timestamp.today().normalize())
        start_date = end_date - pd.Timedelta(days=self.config.history_days - 1)
        date_index = pd.date_range(start_date, end_date, freq="D")

        all_tx: List[pd.DataFrame] = []
        all_balances: List[pd.DataFrame] = []

        for account in self.config.accounts:
            tx_df = self._generate_account_transactions(account, date_index)
            balances_df = self._compute_daily_balances(account, tx_df, date_index)
            all_tx.append(tx_df)
            all_balances.append(balances_df)

        transactions = pd.concat(all_tx, ignore_index=True).sort_values(
            ["booking_date", "account_id"]
        )
        daily_balances = pd.concat(all_balances, ignore_index=True).sort_values(
            ["account_id", "date"]
        )
        return GeneratedDataset(
            transactions=transactions.reset_index(drop=True),
            daily_balances=daily_balances.reset_index(drop=True),
        )

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------
    def _build_holiday_calendars(self) -> Dict[str, set]:
        """Pre-compute holiday sets per country.

        Done once up front because `python-holidays` lookups are cheap
        once instantiated but expensive to build inside hot loops.
        """

        calendars: Dict[str, set] = {}
        if _holidays is None:
            return calendars

        # Cover the maximum span we might generate: history + horizon + buffer.
        years = range(
            (pd.Timestamp.today() - pd.Timedelta(days=self.config.history_days + 365)).year,
            (pd.Timestamp.today() + pd.Timedelta(days=self.config.forecast_horizon + 30)).year + 1,
        )
        for account in self.config.accounts:
            if account.country not in calendars:
                try:
                    cal = _holidays.country_holidays(account.country, years=list(years))
                    calendars[account.country] = set(pd.Timestamp(d) for d in cal.keys())
                except (KeyError, NotImplementedError):
                    calendars[account.country] = set()
        return calendars

    def is_holiday(self, date: pd.Timestamp, country: str) -> bool:
        """Public helper so other modules can share the same calendar."""

        return pd.Timestamp(date).normalize() in self._holiday_calendars.get(country, set())

    # ---- volume shaping ---------------------------------------------------
    def _daily_volume_multiplier(
        self, date: pd.Timestamp, country: str
    ) -> float:
        """Multiplier applied to baseline daily volume.

        Captures three calendar effects that dominate real treasury flows:
          * Weekends: ~30% of weekday volume (some card settlements still flow)
          * Holidays: ~10% — only stragglers and pre-booked items clear
          * End-of-month: +60% on the last 3 business days (payroll, vendors)
        """

        if self.is_holiday(date, country):
            return 0.10
        if date.weekday() >= 5:  # 5 = Saturday, 6 = Sunday
            return 0.30

        # End-of-month boost: ramp up over the final 3 days.
        month_end = (date + pd.offsets.MonthEnd(0))
        days_to_eom = (month_end - date).days
        if days_to_eom <= 2:
            return 1.60
        if days_to_eom <= 5:
            return 1.20
        return 1.00

    def _drift_multiplier(self, date: pd.Timestamp, start: pd.Timestamp) -> float:
        """Slow drift to simulate clients changing behavior over time.

        Real client cohorts grow/shrink and change spending patterns. We
        model this as a low-frequency sinusoid plus a small linear trend
        so the model has *something* non-stationary to handle.
        """

        days_in = (date - start).days
        trend = 1.0 + 0.0003 * days_in            # ~+11% / year
        seasonal = 1.0 + 0.05 * np.sin(2 * np.pi * days_in / 180.0)
        return trend * seasonal

    # ---- transaction sampling --------------------------------------------
    def _sample_rail(self, account: AccountConfig) -> PaymentType:
        """Sample a payment rail according to the account's mix."""

        rails = list(account.payment_mix.keys())
        weights = np.array(list(account.payment_mix.values()), dtype=float)
        weights /= weights.sum()
        return rails[self._rng.choice(len(rails), p=weights)]

    def _sample_clearing_delay(
        self, rail: PaymentType, booking_date: pd.Timestamp, country: str
    ) -> int:
        """Sample a clearing delay in *calendar* days, skipping holidays.

        We sample business days from the rail's SLA window, then push the
        value date forward over weekends/holidays. This is what causes
        end-of-week SWIFT initiations to "land" the following Tuesday.
        """

        lo, hi = CLEARING_DELAYS[rail]
        business_days = int(self._rng.integers(lo, hi + 1))

        value_date = booking_date
        added = 0
        while added < business_days:
            value_date += pd.Timedelta(days=1)
            if value_date.weekday() < 5 and not self.is_holiday(value_date, country):
                added += 1
        return (value_date - booking_date).days

    def _generate_account_transactions(
        self, account: AccountConfig, date_index: pd.DatetimeIndex
    ) -> pd.DataFrame:
        """Generate a transaction stream for a single account."""

        records: List[Dict] = []
        start = date_index[0]

        for date in date_index:
            mult = (
                self._daily_volume_multiplier(date, account.country)
                * self._drift_multiplier(date, start)
            )

            # --- Inflows ----------------------------------------------------
            # Number of inflow transactions per day is Poisson around a base
            # rate, scaled by the same calendar multiplier. Amounts are
            # log-normal so we get a realistic long tail (a few large wires
            # dominate, like in real corporate banking).
            n_in = max(1, int(self._rng.poisson(8 * mult)))
            in_amounts = self._rng.lognormal(
                mean=np.log(max(account.inflow_mean * mult / n_in, 1.0)),
                sigma=0.6,
                size=n_in,
            )
            for amt in in_amounts:
                rail = self._sample_rail(account)
                delay = self._sample_clearing_delay(rail, date, account.country)
                # Operational realism: a fraction of payments overshoot their
                # rail's nominal SLA by 1-2 calendar days. Overflow rate is
                # rail-specific so the reliability widget tells a real story
                # (SWIFT slow, INTERNAL near-perfect).
                clearing_delayed = False
                prob = DELAY_OVERFLOW_PROB.get(rail.value, 0.08)
                if self._rng.random() < prob:
                    delay += int(self._rng.choice([1, 2]))
                    clearing_delayed = True
                records.append(
                    {
                        "account_id": account.account_id,
                        "currency": account.currency,
                        "booking_date": date,
                        "value_date": date + pd.Timedelta(days=delay),
                        "amount": float(amt),
                        "direction": "IN",
                        "payment_type": rail.value,
                        "clearing_delay_days": delay,
                        "clearing_delayed": clearing_delayed,
                    }
                )

            # --- Outflows ---------------------------------------------------
            n_out = max(1, int(self._rng.poisson(8 * mult)))
            out_amounts = self._rng.lognormal(
                mean=np.log(max(account.outflow_mean * mult / n_out, 1.0)),
                sigma=0.6,
                size=n_out,
            )
            for amt in out_amounts:
                rail = self._sample_rail(account)
                delay = self._sample_clearing_delay(rail, date, account.country)
                clearing_delayed = False
                prob = DELAY_OVERFLOW_PROB.get(rail.value, 0.08)
                if self._rng.random() < prob:
                    delay += int(self._rng.choice([1, 2]))
                    clearing_delayed = True
                records.append(
                    {
                        "account_id": account.account_id,
                        "currency": account.currency,
                        "booking_date": date,
                        "value_date": date + pd.Timedelta(days=delay),
                        "amount": float(amt),
                        "direction": "OUT",
                        "payment_type": rail.value,
                        "clearing_delay_days": delay,
                        "clearing_delayed": clearing_delayed,
                    }
                )

        df = pd.DataFrame.from_records(records)
        # Signed amount makes downstream aggregation a one-liner.
        df["signed_amount"] = np.where(df["direction"] == "IN", df["amount"], -df["amount"])
        return df

    # ---- balance reconstruction ------------------------------------------
    def _compute_daily_balances(
        self,
        account: AccountConfig,
        tx_df: pd.DataFrame,
        date_index: pd.DatetimeIndex,
    ) -> pd.DataFrame:
        """Roll transactions up into a daily ledger / available balance.

        Two distinct balances are tracked:
          * ledger_balance:    settled funds (value-date based). This is
                               the number that actually constrains payments.
          * booking_balance:   what the books show today (booking-date
                               based). Differs from ledger by in-transit.
          * in_transit:        booked but not yet settled. Critical because
                               a healthy booking balance can hide a near-term
                               settlement gap.
        """

        # Aggregate by value date for settled cash movement.
        settled = (
            tx_df.groupby("value_date")["signed_amount"].sum().reindex(date_index, fill_value=0.0)
        )
        booked = (
            tx_df.groupby("booking_date")["signed_amount"].sum().reindex(date_index, fill_value=0.0)
        )

        ledger_balance = account.opening_balance + settled.cumsum()
        booking_balance = account.opening_balance + booked.cumsum()
        in_transit = booking_balance - ledger_balance

        # Per-rail in-transit decomposition: useful both as a feature
        # and as a diagnostic ("how much SWIFT is in flight?").
        in_transit_by_rail = {}
        for rail in PaymentType:
            mask = tx_df["payment_type"] == rail.value
            booked_rail = (
                tx_df.loc[mask].groupby("booking_date")["signed_amount"]
                .sum().reindex(date_index, fill_value=0.0).cumsum()
            )
            settled_rail = (
                tx_df.loc[mask].groupby("value_date")["signed_amount"]
                .sum().reindex(date_index, fill_value=0.0).cumsum()
            )
            in_transit_by_rail[f"in_transit_{rail.value}"] = booked_rail - settled_rail

        df = pd.DataFrame(
            {
                "date": date_index,
                "account_id": account.account_id,
                "currency": account.currency,
                "ledger_balance": ledger_balance.values,
                "booking_balance": booking_balance.values,
                "in_transit": in_transit.values,
                "net_flow_settled": settled.values,
                "net_flow_booked": booked.values,
            }
        )
        for col, series in in_transit_by_rail.items():
            df[col] = series.values
        return df
