"""Contagion network + cascade invariants.

We don't pin the exact post-shock balance numbers — they depend on the
synthetic data seed which is allowed to drift. Instead we lock down
properties a treasurer would call regressions:

* The fixture parses and matches the 9-account fleet.
* A full-intensity shock on a hub account always damages the hub's
  direct counterparties.
* Higher shock intensity never produces less total damage than lower
  intensity (monotonicity).
"""

from __future__ import annotations

import pytest

from app.services.liquidity.config import default_system_config
from app.services.liquidity.contagion import (
    load_exposures,
    network_snapshot,
    simulate_cascade,
)


def test_fixture_matches_fleet():
    """Every from/to in the fixture references a known account."""
    expos = load_exposures()
    fleet = {a.account_id for a in default_system_config().accounts}
    referenced = {e.from_account for e in expos} | {e.to_account for e in expos}
    assert referenced.issubset(fleet)
    # The hub (USD-Correspondent) must have multiple outgoing edges —
    # this is what makes the demo visually interesting.
    outgoing = [e for e in expos if e.from_account == "USD-Correspondent"]
    assert len(outgoing) >= 3


def test_hub_shock_hits_direct_neighbours(engine_ready):
    """Full-intensity shock on USD-Correspondent damages every direct neighbour."""
    expos = load_exposures()
    direct = {e.to_account for e in expos if e.from_account == "USD-Correspondent"}
    result = simulate_cascade(
        shocked_account_id="USD-Correspondent",
        intensity=1.0,
        horizon_days=7,
        daily_balances=engine_ready.daily_balances,
    )
    affected_ids = {h.account_id for h in result.affected}
    assert direct.issubset(affected_ids), (
        f"missing direct hops: {direct - affected_ids}"
    )
    # Every direct hop should be exactly one hop away.
    direct_hops = [h for h in result.affected if h.account_id in direct]
    for h in direct_hops:
        assert h.hops_from_shock == 1, (
            f"{h.account_id}: expected hop=1, got hop={h.hops_from_shock}"
        )


def test_intensity_monotonic(engine_ready):
    """Higher intensity → at least as much total loss as lower."""
    prev_loss = -1.0
    for intensity in (0.2, 0.5, 0.8, 1.0):
        res = simulate_cascade(
            shocked_account_id="USD-Correspondent",
            intensity=intensity,
            horizon_days=7,
            daily_balances=engine_ready.daily_balances,
        )
        assert res.total_loss_usd + 1e-6 >= prev_loss, (
            f"non-monotonic: intensity={intensity} loss={res.total_loss_usd} "
            f"vs prev={prev_loss}"
        )
        prev_loss = res.total_loss_usd


def test_network_snapshot_returns_nine_nodes():
    """Snapshot includes all 9 fleet accounts and every fixture edge."""
    snap = network_snapshot()
    assert len(snap["nodes"]) == 9
    assert {n["account_id"] for n in snap["nodes"]} == {
        "EUR-Main",
        "USD-Correspondent",
        "GBP-Local",
        "EUR-Berlin",
        "USD-LA",
        "CHF-Zurich",
        "JPY-Tokyo",
        "SGD-Singapore",
        "KZT-Almaty",
    }
    # Fixture has 16 directed edges.
    assert len(snap["edges"]) == 16


def test_invalid_account_raises():
    """Simulating a typo'd account_id raises a clean ValueError."""
    with pytest.raises(ValueError, match="unknown account"):
        simulate_cascade(
            shocked_account_id="EUR-Atlantis",
            intensity=1.0,
            horizon_days=7,
        )


def test_invalid_intensity_raises():
    with pytest.raises(ValueError, match="intensity must be in"):
        simulate_cascade(
            shocked_account_id="USD-Correspondent",
            intensity=1.5,
            horizon_days=7,
        )


def test_source_not_in_affected(engine_ready):
    """The shocked node never appears in its own affected list.

    Reverse edges in the fixture (e.g. ``EUR-Berlin → EUR-Main``) would
    otherwise leak the source back at hop=1 with contributors made of
    its own neighbours, which is semantically nonsense — the source is
    the cause of the shock, it does not absorb its own loss.
    """
    for shocked in ("EUR-Main", "USD-Correspondent", "JPY-Tokyo"):
        result = simulate_cascade(
            shocked_account_id=shocked,
            intensity=1.0,
            horizon_days=7,
            daily_balances=engine_ready.daily_balances,
        )
        affected_ids = {h.account_id for h in result.affected}
        assert shocked not in affected_ids, (
            f"shocked {shocked} leaked into affected via reverse edges"
        )


def test_zero_intensity_produces_no_loss(engine_ready):
    """intensity=0 → zero total loss → zero shock-induced breaches.

    Accounts already below their floor before the shock are NOT counted
    as breached by the cascade — that's a pre-existing condition, not
    contagion. ``breached_count`` must therefore be zero when the shock
    contributes zero loss.
    """
    result = simulate_cascade(
        shocked_account_id="USD-Correspondent",
        intensity=0.0,
        horizon_days=7,
        daily_balances=engine_ready.daily_balances,
    )
    assert result.total_loss_usd == 0.0
    assert result.breached_count == 0
    for hop in result.affected:
        assert hop.incoming_loss_usd == 0.0
        assert hop.breached is False


def test_breach_requires_healthy_baseline(engine_ready):
    """A node already underwater pre-shock is NOT 'breached by contagion'.

    For every node flagged ``breached=True`` in any non-trivial shock,
    the pre-shock balance (= ``post_shock_balance_usd +
    incoming_loss_usd``) must be at or above ``min_balance_usd``.
    Otherwise the breach is a pre-existing condition surfaced by
    accident. The check is vacuously true when no node is breached
    (e.g. when the warmed-up fleet has already drifted below floor and
    every candidate fails the baseline test) — that's correct
    behaviour, not a regression.
    """
    for shocked in ("USD-Correspondent", "EUR-Main", "JPY-Tokyo"):
        result = simulate_cascade(
            shocked_account_id=shocked,
            intensity=1.0,
            horizon_days=7,
            daily_balances=engine_ready.daily_balances,
        )
        for hop in result.affected:
            if not hop.breached:
                continue
            pre_shock_balance = hop.post_shock_balance_usd + hop.incoming_loss_usd
            assert pre_shock_balance >= hop.min_balance_usd, (
                f"{hop.account_id} marked breached under {shocked} shock but "
                f"pre-shock balance {pre_shock_balance:.2f} was already below "
                f"floor {hop.min_balance_usd:.2f}"
            )
