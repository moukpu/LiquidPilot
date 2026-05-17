"""Contagion network and cascade simulator.

Liquidity contagion is the propagation of a funding shock through the
bilateral exposure network of nostro/operational accounts. When one
account fails to fund its outgoing obligations, every counterparty that
expected an inbound payment from it loses cash they had earmarked.

This module:
  * Loads the hand-curated bilateral exposure fixture (see
    ``backend/app/fixtures/contagion_exposures.json``). The fixture is the
    *static* part of the model — it changes when the business adds a
    new counterparty, not on every tick.
  * Builds a ``networkx.DiGraph`` keyed by account_id, with edge weight
    ``exposure_usd``.
  * Runs a BFS-style cascade: at each hop the shock attenuates by a
    geometric factor; an account "breaches" if its current USD-converted
    balance minus accumulated incoming-exposure loss falls below the
    USD-converted ``min_balance``.

The simulator is deterministic and side-effect-free. It does NOT modify
``engine_state`` or trigger any retraining.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional

import networkx as nx
import pandas as pd

from app.services.liquidity.config import (
    FX_RATES_TO_USD,
    SystemConfig,
    default_system_config,
)

# Geometric attenuation per hop. A direct counterparty of the shocked
# account sees the full ``exposure_usd * intensity``; one hop further
# the propagated shock is multiplied by this factor. Calibrated so a
# 3-hop chain still produces visible (>= ~30%) damage but tail hops
# don't dominate the picture.
HOP_DECAY: float = 0.6

# Cap on how many hops the BFS expands. With 9 nodes and 16 edges the
# diameter is <= 3; cap at 4 to be defensive against future fixture
# growth and to keep ``simulate`` O(n_edges) bounded.
MAX_HOPS: int = 4

# Fixture path is anchored on ``__file__`` so it resolves correctly
# both in the local dev tree and inside the Railway Docker image
# (build context is ``backend/``, so ``data/`` outside backend is not
# in the image). ``__file__`` is
# ``<root>/backend/app/services/liquidity/contagion.py`` locally and
# ``/app/app/services/liquidity/contagion.py`` in the container — in
# both cases ``parents[2]`` is ``backend/app/`` (or ``/app/app/``).
_FIXTURE_PATH = (
    Path(__file__).resolve().parents[2]
    / "fixtures"
    / "contagion_exposures.json"
)


@dataclass(frozen=True)
class Exposure:
    """One directed bilateral exposure edge."""

    from_account: str
    to_account: str
    exposure_usd: float
    kind: str
    description: str


@dataclass(frozen=True)
class NodeView:
    """Snapshot of a single account for network display."""

    account_id: str
    currency: str
    country: str
    min_balance_usd: float
    current_balance_usd: float


@dataclass(frozen=True)
class EdgeView:
    """Snapshot of a single exposure edge for network display."""

    from_account: str
    to_account: str
    exposure_usd: float
    kind: str
    description: str


@dataclass
class CascadeHop:
    """One account hit by the cascade, with its post-shock state."""

    account_id: str
    hops_from_shock: int
    incoming_loss_usd: float
    post_shock_balance_usd: float
    min_balance_usd: float
    breached: bool
    contributors: List[str] = field(default_factory=list)


@dataclass
class CascadeResult:
    """End-to-end simulation result."""

    shocked_account_id: str
    intensity: float
    horizon_days: int
    affected: List[CascadeHop]
    breached_count: int
    total_loss_usd: float


def load_exposures(path: Optional[Path] = None) -> List[Exposure]:
    """Load the bilateral exposure fixture.

    Validates every ``from``/``to`` against the live system config so a
    typo in the JSON surfaces immediately rather than as a silent
    missing edge at runtime.
    """

    fixture_path = path or _FIXTURE_PATH
    raw = json.loads(fixture_path.read_text(encoding="utf-8"))
    cfg = default_system_config()
    known = {a.account_id for a in cfg.accounts}
    exposures: List[Exposure] = []
    for entry in raw:
        if entry["from"] not in known:
            raise ValueError(
                f"contagion fixture: unknown 'from' account {entry['from']}"
            )
        if entry["to"] not in known:
            raise ValueError(
                f"contagion fixture: unknown 'to' account {entry['to']}"
            )
        if entry["from"] == entry["to"]:
            raise ValueError(f"contagion fixture: self-loop on {entry['from']}")
        if entry["exposure_usd"] <= 0:
            raise ValueError(
                f"contagion fixture: non-positive exposure "
                f"{entry['from']}→{entry['to']}"
            )
        exposures.append(
            Exposure(
                from_account=entry["from"],
                to_account=entry["to"],
                exposure_usd=float(entry["exposure_usd"]),
                kind=entry["kind"],
                description=entry["description"],
            )
        )
    return exposures


def build_graph(exposures: List[Exposure]) -> nx.DiGraph:
    """Build a directed graph from the exposure list."""

    g = nx.DiGraph()
    for e in exposures:
        g.add_edge(
            e.from_account,
            e.to_account,
            exposure_usd=e.exposure_usd,
            kind=e.kind,
            description=e.description,
        )
    return g


def _account_balances_usd(
    config: SystemConfig,
    daily_balances: Optional[pd.DataFrame],
) -> Dict[str, NodeView]:
    """Compute current per-account balance and min_balance in USD.

    Falls back to ``opening_balance`` when ``daily_balances`` is None —
    keeps the simulator usable in tests that don't run the full warm-up.
    """

    if daily_balances is not None and not daily_balances.empty:
        latest = (
            daily_balances.sort_values("date")
            .groupby("account_id")
            .tail(1)
            .set_index("account_id")
        )
    else:
        latest = None

    nodes: Dict[str, NodeView] = {}
    for acc in config.accounts:
        rate = FX_RATES_TO_USD[acc.currency]
        if latest is not None and acc.account_id in latest.index:
            current_native = float(latest.loc[acc.account_id, "ledger_balance"])
        else:
            current_native = float(acc.opening_balance)
        nodes[acc.account_id] = NodeView(
            account_id=acc.account_id,
            currency=acc.currency,
            country=acc.country,
            min_balance_usd=float(acc.min_balance) * rate,
            current_balance_usd=current_native * rate,
        )
    return nodes


def network_snapshot(
    config: Optional[SystemConfig] = None,
    daily_balances: Optional[pd.DataFrame] = None,
    exposures: Optional[List[Exposure]] = None,
) -> Dict[str, List]:
    """Return nodes + edges for the frontend graph viz.

    Pure read model — call any time after warm_up has materialised
    ``state.daily_balances``. Safe to call without warm-up (uses
    opening balances).
    """

    cfg = config or default_system_config()
    expos = exposures if exposures is not None else load_exposures()
    nodes_map = _account_balances_usd(cfg, daily_balances)
    return {
        "nodes": [
            {
                "account_id": n.account_id,
                "currency": n.currency,
                "country": n.country,
                "min_balance_usd": n.min_balance_usd,
                "current_balance_usd": n.current_balance_usd,
            }
            for n in nodes_map.values()
        ],
        "edges": [
            {
                "from": e.from_account,
                "to": e.to_account,
                "exposure_usd": e.exposure_usd,
                "kind": e.kind,
                "description": e.description,
            }
            for e in expos
        ],
    }


def simulate_cascade(
    shocked_account_id: str,
    intensity: float,
    horizon_days: int,
    config: Optional[SystemConfig] = None,
    daily_balances: Optional[pd.DataFrame] = None,
    exposures: Optional[List[Exposure]] = None,
) -> CascadeResult:
    """Run a BFS cascade from ``shocked_account_id``.

    Args
    ----
    shocked_account_id: which account failed to honour its outbound
        obligations.
    intensity: 0..1, how completely the shock hit. 1.0 = full failure,
        every receivable gone; 0.5 = half delivered.
    horizon_days: cosmetic for now (carried through to result for the
        frontend's "breach by day N" labelling). The numerical core
        does not model time decay yet — keep room for that in 0010+.
    """

    cfg = config or default_system_config()
    if shocked_account_id not in {a.account_id for a in cfg.accounts}:
        raise ValueError(f"unknown account: {shocked_account_id}")
    if not 0.0 <= intensity <= 1.0:
        raise ValueError(f"intensity must be in [0,1], got {intensity}")
    if not 1 <= horizon_days <= 30:
        raise ValueError(f"horizon_days must be in [1,30], got {horizon_days}")

    expos = exposures if exposures is not None else load_exposures()
    g = build_graph(expos)
    nodes_map = _account_balances_usd(cfg, daily_balances)

    # Per-node accumulated incoming loss and contributors list.
    losses: Dict[str, float] = {}
    contributors: Dict[str, List[str]] = {}
    hops_from_shock: Dict[str, int] = {shocked_account_id: 0}

    # BFS. ``frontier`` holds (node, current_hop_distance,
    # cumulative_attenuation). Start: the shocked node has full
    # attenuation 1.0; its direct downstream neighbours absorb
    # ``exposure_usd * intensity``.
    frontier: List[tuple] = [(shocked_account_id, 0, 1.0)]
    visited_edges: set = set()

    while frontier:
        next_frontier: List[tuple] = []
        for node, hop, atten in frontier:
            if hop >= MAX_HOPS:
                continue
            if node not in g:
                continue
            for _, neighbour, data in g.out_edges(node, data=True):
                edge_key = (node, neighbour, hop)
                if edge_key in visited_edges:
                    continue
                visited_edges.add(edge_key)
                edge_loss = data["exposure_usd"] * intensity * atten
                losses[neighbour] = losses.get(neighbour, 0.0) + edge_loss
                contributors.setdefault(neighbour, []).append(node)
                # Only record the *shortest* hop distance for a node.
                if (
                    neighbour not in hops_from_shock
                    or hops_from_shock[neighbour] > hop + 1
                ):
                    hops_from_shock[neighbour] = hop + 1
                next_frontier.append((neighbour, hop + 1, atten * HOP_DECAY))
        frontier = next_frontier

    affected: List[CascadeHop] = []
    for account_id, loss in losses.items():
        node = nodes_map[account_id]
        post = node.current_balance_usd - loss
        affected.append(
            CascadeHop(
                account_id=account_id,
                hops_from_shock=hops_from_shock[account_id],
                incoming_loss_usd=loss,
                post_shock_balance_usd=post,
                min_balance_usd=node.min_balance_usd,
                breached=post < node.min_balance_usd,
                contributors=sorted(set(contributors.get(account_id, []))),
            )
        )

    affected.sort(key=lambda h: (h.hops_from_shock, -h.incoming_loss_usd))

    return CascadeResult(
        shocked_account_id=shocked_account_id,
        intensity=intensity,
        horizon_days=horizon_days,
        affected=affected,
        breached_count=sum(1 for h in affected if h.breached),
        total_loss_usd=sum(h.incoming_loss_usd for h in affected),
    )
