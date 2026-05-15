"""Predictive alerting and intra-group transfer routing.

This module turns numerical forecasts into actionable treasury signals:

  * A **RiskAlert** is fired when a projected balance breaches
    `min_balance` (HARD) or enters the `alert_buffer` zone above it
    (SOFT). The earliest breach date drives the alert severity —
    breaches that are 1-2 days out are urgent because they may be too
    late for slow rails like SWIFT.

  * A **TransferSuggestion** is a greedy heuristic that picks the
    cheapest viable surplus account to plug the gap. "Cheapest" here is
    a function of:
        - currency match (no FX = preferred)
        - rail speed vs alert horizon (SWIFT useless if breach is tomorrow)
        - donor account's own forecast (don't drain a surplus that's
          itself about to dip below its buffer)

This is intentionally a heuristic, not an optimizer. A real treasury
system would phrase this as an LP/MILP: minimize cost subject to
balance >= min for every account every day. The heuristic produces
the same kinds of decisions for the common case and is far easier to
explain to a treasury team — which matters for adoption.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional

import pandas as pd

from .config import (
    AccountConfig,
    PaymentType,
    SystemConfig,
    default_system_config,
)
from .forecaster import ForecastResult


class AlertSeverity(str, Enum):
    """Alert severities, ordered by escalating treasury impact."""

    INFO = "INFO"            # within buffer but trending down
    WARNING = "WARNING"      # buffer breach projected
    CRITICAL = "CRITICAL"    # min_balance breach projected
    BREACH = "BREACH"        # below min_balance today (real, not projected)


@dataclass
class RiskAlert:
    """A projected liquidity-risk event for a single account."""

    account_id: str
    currency: str
    severity: AlertSeverity
    breach_date: pd.Timestamp
    projected_balance: float
    min_balance: float
    shortfall: float                # how much we'd be short on breach_date
    days_until_breach: int
    message: str


@dataclass
class TransferSuggestion:
    """A proposed intra-group funding transfer."""

    from_account: str
    to_account: str
    amount: float
    currency_from: str
    currency_to: str
    rail: PaymentType
    initiate_by: pd.Timestamp        # latest booking date to settle in time
    rationale: str
    requires_fx: bool = False
    notes: List[str] = field(default_factory=list)


# Rail speed in business days. Mirrors config.CLEARING_DELAYS but exposes
# the *worst-case* delay, because routing must guarantee settlement by
# the breach date, not just hope for the fast end of the SLA.
_RAIL_WORST_CASE: Dict[PaymentType, int] = {
    PaymentType.INTERNAL: 0,
    PaymentType.SEPA: 1,
    PaymentType.SWIFT: 3,
    PaymentType.CARD: 5,
}


class RiskManager:
    """Evaluates forecasts and suggests corrective transfers."""

    def __init__(self, config: Optional[SystemConfig] = None) -> None:
        self.config = config or default_system_config()
        self._account_by_id: Dict[str, AccountConfig] = {
            a.account_id: a for a in self.config.accounts
        }

    # ------------------------------------------------------------------
    # Alert generation
    # ------------------------------------------------------------------
    def evaluate(
        self,
        forecasts: Dict[str, ForecastResult],
        as_of: Optional[pd.Timestamp] = None,
    ) -> List[RiskAlert]:
        """Scan every forecast for breach risk.

        Returns one alert per account per breach event. If both the
        soft and hard threshold are crossed, we emit the more severe
        one (CRITICAL > WARNING) — alert spam is worse than missing
        the soft warning.
        """

        as_of = as_of or pd.Timestamp.today().normalize()
        alerts: List[RiskAlert] = []

        for account_id, result in forecasts.items():
            account = self._account_by_id.get(account_id)
            if account is None:
                continue

            fc = result.forecast.sort_values("date").reset_index(drop=True)
            alert = self._first_breach(account, fc, as_of)
            if alert is not None:
                alerts.append(alert)

        # Sort by urgency: severity first, then proximity. Lets the
        # downstream caller `alerts[0]` and get the most pressing item.
        severity_order = {
            AlertSeverity.BREACH: 0,
            AlertSeverity.CRITICAL: 1,
            AlertSeverity.WARNING: 2,
            AlertSeverity.INFO: 3,
        }
        alerts.sort(key=lambda a: (severity_order[a.severity], a.days_until_breach))
        return alerts

    def _first_breach(
        self,
        account: AccountConfig,
        forecast: pd.DataFrame,
        as_of: pd.Timestamp,
    ) -> Optional[RiskAlert]:
        """Find the first day a threshold is crossed, if any.

        We use the pessimistic band (P05) for the HARD floor check and
        the central estimate (P50) for the SOFT buffer check:

          * CRITICAL when P05 < min_balance — i.e. there's a meaningful
            tail-risk of breaching even with the model's worst-case view.
          * WARNING  when P50 < min_balance + alert_buffer — i.e. the
            *typical* outcome eats into the buffer.

        The first violation along the forecast horizon wins; CRITICAL
        beats WARNING when both fire on the same iteration.
        """

        hard_floor = account.min_balance
        soft_floor = account.min_balance + account.alert_buffer

        # Tolerate older callers / fallback paths where only a point
        # forecast column exists.
        p05_col = (
            "predicted_ledger_balance_p05"
            if "predicted_ledger_balance_p05" in forecast.columns
            else "predicted_ledger_balance"
        )
        p50_col = (
            "predicted_ledger_balance_p50"
            if "predicted_ledger_balance_p50" in forecast.columns
            else "predicted_ledger_balance"
        )

        for _, row in forecast.iterrows():
            bal_p05 = float(row[p05_col])
            bal_p50 = float(row[p50_col])
            date = pd.Timestamp(row["date"])
            days_out = max(0, (date - as_of).days)

            if bal_p05 < hard_floor:
                shortfall = hard_floor - bal_p05
                return RiskAlert(
                    account_id=account.account_id,
                    currency=account.currency,
                    severity=AlertSeverity.CRITICAL,
                    breach_date=date,
                    projected_balance=bal_p05,
                    min_balance=hard_floor,
                    shortfall=shortfall,
                    days_until_breach=days_out,
                    message=(
                        f"{account.account_id}: P05 ledger balance "
                        f"{bal_p05:,.0f} {account.currency} on {date.date()} "
                        f"(P50: {bal_p50:,.0f}) below minimum {hard_floor:,.0f} "
                        f"(shortfall {shortfall:,.0f})."
                    ),
                )

            if bal_p50 < soft_floor:
                shortfall = soft_floor - bal_p50
                return RiskAlert(
                    account_id=account.account_id,
                    currency=account.currency,
                    severity=AlertSeverity.WARNING,
                    breach_date=date,
                    projected_balance=bal_p50,
                    min_balance=hard_floor,
                    shortfall=shortfall,
                    days_until_breach=days_out,
                    message=(
                        f"{account.account_id}: P50 balance "
                        f"{bal_p50:,.0f} {account.currency} on {date.date()} "
                        f"enters alert buffer (soft floor {soft_floor:,.0f}; "
                        f"P05: {bal_p05:,.0f})."
                    ),
                )
        return None

    # ------------------------------------------------------------------
    # Transfer routing
    # ------------------------------------------------------------------
    def suggest_transfers(
        self,
        alerts: List[RiskAlert],
        forecasts: Dict[str, ForecastResult],
        as_of: Optional[pd.Timestamp] = None,
    ) -> List[TransferSuggestion]:
        """For each alert, propose a transfer to close the gap.

        Heuristic ranking of donor accounts:
          1. Same currency (avoids FX cost / settlement risk).
          2. Donor's own forecast remains above its alert buffer after
             the proposed transfer.
          3. Pick a rail that can settle by the breach date.

        We size the transfer to bring the deficit account back to
        `min_balance + alert_buffer` — leaving the soft buffer intact
        rather than just barely clearing the hard floor. That avoids
        chained alerts the very next day.
        """

        as_of = as_of or pd.Timestamp.today().normalize()
        suggestions: List[TransferSuggestion] = []

        for alert in alerts:
            if alert.severity == AlertSeverity.INFO:
                continue

            recipient = self._account_by_id[alert.account_id]
            target_balance = recipient.min_balance + recipient.alert_buffer
            funding_need = max(0.0, target_balance - alert.projected_balance)
            if funding_need <= 0:
                continue

            donor = self._choose_donor(alert, recipient, funding_need, forecasts)
            if donor is None:
                suggestions.append(
                    TransferSuggestion(
                        from_account="(none)",
                        to_account=recipient.account_id,
                        amount=funding_need,
                        currency_from="",
                        currency_to=recipient.currency,
                        rail=PaymentType.INTERNAL,
                        initiate_by=as_of,
                        rationale=(
                            "No surplus account can fund this gap without "
                            "itself breaching its alert buffer. Escalate to "
                            "external funding (credit line / repo / FX swap)."
                        ),
                    )
                )
                continue

            rail = self._pick_rail(donor, recipient, alert, as_of)
            initiate_by = self._latest_initiation_date(alert.breach_date, rail)

            requires_fx = donor.currency != recipient.currency
            notes: List[str] = []
            if requires_fx:
                notes.append(
                    f"Requires FX conversion {donor.currency}->{recipient.currency}; "
                    "size in donor currency before quoting the spot deal."
                )
            if rail == PaymentType.SWIFT:
                notes.append(
                    "SWIFT chosen due to currency/route constraints; "
                    "confirm cut-off times with correspondent."
                )

            suggestions.append(
                TransferSuggestion(
                    from_account=donor.account_id,
                    to_account=recipient.account_id,
                    amount=funding_need,
                    currency_from=donor.currency,
                    currency_to=recipient.currency,
                    rail=rail,
                    initiate_by=initiate_by,
                    rationale=(
                        f"Fund {alert.severity.value} on {recipient.account_id} "
                        f"({alert.breach_date.date()}, shortfall "
                        f"{alert.shortfall:,.0f} {recipient.currency}) from "
                        f"{donor.account_id}: top up to soft floor "
                        f"{target_balance:,.0f} {recipient.currency} via {rail.value}."
                    ),
                    requires_fx=requires_fx,
                    notes=notes,
                )
            )

        return suggestions

    # ------------------------------------------------------------------
    # Donor / rail selection
    # ------------------------------------------------------------------
    def _choose_donor(
        self,
        alert: RiskAlert,
        recipient: AccountConfig,
        amount: float,
        forecasts: Dict[str, ForecastResult],
    ) -> Optional[AccountConfig]:
        """Pick the best donor account.

        We look at the projected balance on the *breach date* for each
        candidate donor — not today's balance — because the donor's own
        outflows may have depleted it by then. This is the whole point
        of having a forecast: route based on the future, not the past.
        """

        candidates: List[tuple] = []  # (score, AccountConfig)

        for cand in self.config.accounts:
            if cand.account_id == recipient.account_id:
                continue

            donor_fc = forecasts.get(cand.account_id)
            if donor_fc is None:
                continue

            # Projected balance on (or just before) the breach date.
            # Use the P05 view: we should not commit funds based on a
            # donor's optimistic outcome that might not materialize.
            mask = donor_fc.forecast["date"] <= alert.breach_date
            if not mask.any():
                continue
            donor_col = (
                "predicted_ledger_balance_p05"
                if "predicted_ledger_balance_p05" in donor_fc.forecast.columns
                else "predicted_ledger_balance"
            )
            donor_balance = float(donor_fc.forecast.loc[mask, donor_col].iloc[-1])

            # Donor needs enough headroom to give `amount` without itself
            # entering its alert buffer.
            donor_floor = cand.min_balance + cand.alert_buffer
            available = donor_balance - donor_floor
            if available < amount:
                continue

            # Lower score = better donor.
            # Prefer same currency (no FX) and higher absolute headroom.
            fx_penalty = 0 if cand.currency == recipient.currency else 1_000_000
            score = fx_penalty - available
            candidates.append((score, cand))

        if not candidates:
            return None
        candidates.sort(key=lambda kv: kv[0])
        return candidates[0][1]

    def _pick_rail(
        self,
        donor: AccountConfig,
        recipient: AccountConfig,
        alert: RiskAlert,
        as_of: pd.Timestamp,
    ) -> PaymentType:
        """Pick a payment rail that settles before the breach date.

        Preference order:
          INTERNAL (same bank) > SEPA (same currency, EU) > SWIFT > CARD.
        We never use CARD for funding transfers — it's an inbound rail
        in our model.
        """

        days_available = max(0, (alert.breach_date - as_of).days)

        # Internal book transfer if both accounts are configured for it.
        if PaymentType.INTERNAL in donor.payment_mix and PaymentType.INTERNAL in recipient.payment_mix:
            return PaymentType.INTERNAL

        # SEPA is only valid for EUR-denominated transfers.
        if (
            donor.currency == "EUR"
            and recipient.currency == "EUR"
            and PaymentType.SEPA in donor.payment_mix
            and days_available >= _RAIL_WORST_CASE[PaymentType.SEPA]
        ):
            return PaymentType.SEPA

        # SWIFT is the universal fallback for cross-currency / cross-region.
        if days_available >= _RAIL_WORST_CASE[PaymentType.SWIFT]:
            return PaymentType.SWIFT

        # Last resort: still emit SWIFT but the suggestion's `initiate_by`
        # date will already be in the past, signaling the caller to
        # escalate (e.g. intraday credit line).
        return PaymentType.SWIFT

    @staticmethod
    def _latest_initiation_date(
        breach_date: pd.Timestamp, rail: PaymentType
    ) -> pd.Timestamp:
        """Latest business day we can initiate to still settle in time."""

        return breach_date - pd.Timedelta(days=_RAIL_WORST_CASE[rail])
