# Contagion Phase 5 — backend (graph + cascade simulator)

**Repo:** https://github.com/moukpu/LiquidPilot
**Base branch:** `main` (HEAD = `059f0da` — Time Machine round 4 (0008) merged. Если уехало — `git fetch && git rebase origin/main`.)
**Target PR title:** `feat(contagion): bilateral exposure graph + cascade simulator (Phase 5 backend)`

Phase 5 («Bank Epidemiologist») сейчас — 13-строчная фронт-заглушка и 9-строчный backend-stub, оба возвращают пустоту. Это самая большая дыра по проекту, дедлайн 20 мая (≈86 ч).

**Этот промпт — только бэкенд.** Фронт (`/contagion` страница с d3-force графом, форма «упавший банк», ползунок интенсивности шока, side-panel списка пострадавших) — приходит отдельным промптом 0010 **после** того как этот зашипится. Не пробуй сделать оба — сломаешь и оба.

Сценарий, который должен заработать после этого PR:
```bash
curl -X POST https://liquidpilot.up.railway.app/contagion/simulate \
  -H 'Content-Type: application/json' \
  -d '{"shocked_account_id":"USD-Correspondent","intensity":0.8,"horizon_days":7}'
```
Возвращает JSON со списком хопов каскада, для каждого пострадавшего — exposure_usd, breach или нет, и через сколько хопов от шокированного.

---

## Архитектурное решение, которое уже принято за тебя

**Транзакции у Азима в `state.transactions` не содержат counterparty полей** (схема: `account_id, currency, booking_date, value_date, amount, direction, payment_type, clearing_delay_days, clearing_delayed, signed_amount` — это монолог одного счёта, не диалог). Реконструировать настоящий exposure-граф из tx-ленты невозможно.

**Решение:** добавляем статическую фикстуру bilateral exposures в `data/fixtures/contagion_exposures.json`. Это руками-проставленные пары «кто-кому-должен» с реалистичными суммами в USD. На демо это нормально — у нас mid-sized fintech с 9 nostro-счетами, у такого банка bilateral exposures меняются медленно и могут быть в YAML/JSON.

NO Azim engine retraining. NO touching `data_generator.py`. NO synthesizing edges from transactions.

---

## Файлы

| # | File | Action |
|---|------|--------|
| 1 | `data/fixtures/contagion_exposures.json` | CREATE |
| 2 | `backend/app/services/liquidity/contagion.py` | CREATE (новый модуль, **не Азимовский**) |
| 3 | `backend/app/api/routes/contagion.py` | REPLACE 9-line stub |
| 4 | `backend/tests/test_contagion.py` | CREATE |

NetworkX 3.4 уже в `backend/pyproject.toml`. Импортируй как `import networkx as nx`.

---

## Out of scope (НЕ ТРОГАЙ)

- `backend/app/services/liquidity/data_generator.py` — Азимовский, read-only.
- `backend/app/services/liquidity/forecaster.py`, `feature_engineering.py`, `risk_manager.py`, `backtester.py` — read-only.
- `backend/app/services/liquidity/stress.py` — Time Machine engine, не наша территория в этом PR.
- `backend/app/services/engine_state.py` — не меняй, кроме того что прочитать `state.daily_balances` и `state.transactions` для текущих балансов.
- Frontend — нулевые правки. `/contagion` страница остаётся заглушкой до 0010.
- `backend/app/main.py` — роут уже подключён (`app.include_router(contagion.router, prefix="/contagion", tags=["contagion"])`). Не дёргай.
- Никаких новых либ. `networkx` и `pandas` уже есть.

---

## Шаг 1 — fixture `data/fixtures/contagion_exposures.json`

Структура — массив объектов. **Все суммы — в USD** (numeraire), независимо от валюты счёта. Эта стандартизация делает каскад однородным.

Поля:
- `from` — кто кому должен (источник exposure). При шоке `from` падает → `to` теряет деньги, которые рассчитывал получить.
- `to` — получатель платежей. При шоке `to` он не получит → его балансу больно.
- `exposure_usd` — bilateral exposure в USD на текущий момент. Магнитуда — то, сколько `to` теряет если `from` полностью рухнет.
- `kind` — один из: `intra-group` (внутри банковской группы, наибольшая концентрация), `correspondent` (классический nostro-vostro), `market` (рыночный counterparty через клиринг).
- `description` — короткая human-readable строка для тултипа.

**Содержимое файла:** (это финал, не «пример» — копируй 1-в-1, account_id должны совпадать с `default_system_config()`)

```json
[
  {
    "from": "EUR-Main",
    "to": "EUR-Berlin",
    "exposure_usd": 4500000,
    "kind": "intra-group",
    "description": "Sister account, daily INTERNAL sweeps from EUR-Main to EUR-Berlin operating float"
  },
  {
    "from": "EUR-Berlin",
    "to": "EUR-Main",
    "exposure_usd": 2200000,
    "kind": "intra-group",
    "description": "Reverse INTERNAL sweeps Berlin → Main at month-end"
  },
  {
    "from": "USD-Correspondent",
    "to": "USD-LA",
    "exposure_usd": 6800000,
    "kind": "intra-group",
    "description": "USD-Correspondent funds USD-LA West-Coast operations daily"
  },
  {
    "from": "USD-LA",
    "to": "USD-Correspondent",
    "exposure_usd": 1500000,
    "kind": "intra-group",
    "description": "USD-LA sweeps surplus back to USD-Correspondent overnight"
  },
  {
    "from": "USD-Correspondent",
    "to": "EUR-Main",
    "exposure_usd": 3500000,
    "kind": "correspondent",
    "description": "USD leg of EUR-Main SWIFT settlements clears through USD-Correspondent"
  },
  {
    "from": "USD-Correspondent",
    "to": "GBP-Local",
    "exposure_usd": 2100000,
    "kind": "correspondent",
    "description": "USD/GBP FX leg for GBP-Local card acquiring"
  },
  {
    "from": "USD-Correspondent",
    "to": "CHF-Zurich",
    "exposure_usd": 1800000,
    "kind": "correspondent",
    "description": "USD/CHF FX clearing for CHF-Zurich SWIFT outflows"
  },
  {
    "from": "USD-Correspondent",
    "to": "JPY-Tokyo",
    "exposure_usd": 4200000,
    "kind": "correspondent",
    "description": "USD/JPY major FX leg, JPY-Tokyo's primary correspondent route"
  },
  {
    "from": "USD-Correspondent",
    "to": "SGD-Singapore",
    "exposure_usd": 2600000,
    "kind": "correspondent",
    "description": "USD/SGD FX, SGD-Singapore APAC dollar funding"
  },
  {
    "from": "USD-Correspondent",
    "to": "KZT-Almaty",
    "exposure_usd": 3100000,
    "kind": "correspondent",
    "description": "USD/KZT exotic FX clearing — Almaty's only convertible route"
  },
  {
    "from": "EUR-Main",
    "to": "CHF-Zurich",
    "exposure_usd": 900000,
    "kind": "market",
    "description": "EUR/CHF cross-rate clearing via shared EUR clearing house"
  },
  {
    "from": "EUR-Main",
    "to": "GBP-Local",
    "exposure_usd": 1100000,
    "kind": "market",
    "description": "SEPA/Faster Payments bridge EUR↔GBP via shared clearer"
  },
  {
    "from": "JPY-Tokyo",
    "to": "SGD-Singapore",
    "exposure_usd": 1400000,
    "kind": "market",
    "description": "APAC JPY/SGD cross-clearing"
  },
  {
    "from": "SGD-Singapore",
    "to": "JPY-Tokyo",
    "exposure_usd": 700000,
    "kind": "market",
    "description": "Reverse SGD/JPY exposure"
  },
  {
    "from": "GBP-Local",
    "to": "EUR-Main",
    "exposure_usd": 1300000,
    "kind": "market",
    "description": "GBP/EUR receivable from London-Frankfurt CARD settlements"
  },
  {
    "from": "CHF-Zurich",
    "to": "EUR-Main",
    "exposure_usd": 800000,
    "kind": "market",
    "description": "CHF/EUR cross-rate, end-of-day net long EUR"
  }
]
```

16 направленных рёбер. Все 9 нод хотя бы в одной паре. USD-Correspondent — главный hub (5 исходящих рёбер) — это специально, чтобы шок на нём дал самый зрелищный каскад.

---

## Шаг 2 — `backend/app/services/liquidity/contagion.py`

**Это новый файл, не существующая Азимовская территория.** Хоть он и в `liquidity/`, концептуально это уровень `stress.py` (Time Machine) — наш код.

```python
"""Contagion network and cascade simulator.

Liquidity contagion is the propagation of a funding shock through the
bilateral exposure network of nostro/operational accounts. When one
account fails to fund its outgoing obligations, every counterparty that
expected an inbound payment from it loses cash they had earmarked.

This module:
  * Loads the hand-curated bilateral exposure fixture (see
    ``data/fixtures/contagion_exposures.json``). The fixture is the
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
# 3-hop chain still produces visible (≥ ~30%) damage but tail hops
# don't dominate the picture.
HOP_DECAY: float = 0.6

# Cap on how many hops the BFS expands. With 9 nodes and 16 edges the
# diameter is ≤ 3; cap at 4 to be defensive against future fixture
# growth and to keep ``simulate`` O(n_edges) bounded.
MAX_HOPS: int = 4

# Fixture path is resolved relative to the repo root so tests and the
# running server both find it.
_FIXTURE_PATH = Path("data/fixtures/contagion_exposures.json")


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
    raw = json.loads(fixture_path.read_text())
    cfg = default_system_config()
    known = {a.account_id for a in cfg.accounts}
    exposures: List[Exposure] = []
    for entry in raw:
        if entry["from"] not in known:
            raise ValueError(f"contagion fixture: unknown 'from' account {entry['from']}")
        if entry["to"] not in known:
            raise ValueError(f"contagion fixture: unknown 'to' account {entry['to']}")
        if entry["from"] == entry["to"]:
            raise ValueError(f"contagion fixture: self-loop on {entry['from']}")
        if entry["exposure_usd"] <= 0:
            raise ValueError(
                f"contagion fixture: non-positive exposure {entry['from']}→{entry['to']}"
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
                if neighbour not in hops_from_shock or hops_from_shock[neighbour] > hop + 1:
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
```

**Замечания:**
- BFS, не DFS. Каждый узел получает loss от всех путей, но в результате видим только **кратчайший** hop-distance (для UI). Это сознательное упрощение — у тебя 9 нод, цикл `EUR-Main ↔ EUR-Berlin` не должен раздувать накопление.
- `visited_edges` ключ включает `hop` — это позволяет ребру отработать с разной атеннуацией с разных уровней BFS, но не зациклиться вечно (т.к. `MAX_HOPS=4` обрубает).
- `FX_RATES_TO_USD` (см. `config.py:45`) — статический snapshot, не live. Это сознательно — все остальные модули его используют, контейджн не должен расходиться.
- `daily_balances` — опциональный. Если None, fallback на `opening_balance` × FX. Это позволяет писать тесты без warm-up, **но** prod-роут передаёт `state.daily_balances`.

---

## Шаг 3 — `backend/app/api/routes/contagion.py` (REPLACE стаб)

```python
"""Contagion endpoints — graph snapshot + cascade simulator.

``GET /contagion/network`` returns the bilateral exposure graph (nodes +
edges) for the frontend visualisation. ``POST /contagion/simulate`` runs
a single shock scenario through the network and returns the cascade.
"""

from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.engine_state import state
from app.services.liquidity.contagion import (
    network_snapshot,
    simulate_cascade,
)

router = APIRouter()


class CascadeRequest(BaseModel):
    shocked_account_id: str
    intensity: float = Field(default=1.0, ge=0.0, le=1.0)
    horizon_days: int = Field(default=7, ge=1, le=30)


@router.get("/network")
def get_network():
    """Return the bilateral exposure graph for the frontend.

    Safe to call before warm-up (returns opening balances as the
    ``current_balance_usd`` proxy).
    """

    daily = state.daily_balances if state.ready else None
    return network_snapshot(daily_balances=daily)


@router.post("/simulate")
def simulate(req: CascadeRequest):
    if not state.ready:
        raise HTTPException(503, "Engine warming up")
    try:
        result = simulate_cascade(
            shocked_account_id=req.shocked_account_id,
            intensity=req.intensity,
            horizon_days=req.horizon_days,
            daily_balances=state.daily_balances,
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    return {
        "shocked_account_id": result.shocked_account_id,
        "intensity": result.intensity,
        "horizon_days": result.horizon_days,
        "affected": [asdict(h) for h in result.affected],
        "breached_count": result.breached_count,
        "total_loss_usd": result.total_loss_usd,
    }
```

`/network` намеренно не требует warm-up — фронту нужно сразу что-то рисовать на холодной странице, до того как Azim прогреется. `simulate` требует warm-up, потому что без `state.daily_balances` цифры будут ложными.

---

## Шаг 4 — `backend/tests/test_contagion.py`

Три теста. Используй существующий `engine_ready` fixture из `conftest.py`.

```python
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
    simulate_cascade,
    network_snapshot,
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
```

---

## Acceptance criteria

После `git add` + commit, обязательные проверки:

```bash
cd backend
uv run ruff check .                       # 0 errors
uv run pytest tests/ -v                   # все тесты зелёные, включая
                                          # 6 новых в test_contagion.py
uv run uvicorn app.main:app --port 8000 & # boot test
sleep 30                                  # ждём warm_up из кэша
curl -s http://localhost:8000/contagion/network | jq '.nodes | length'
# → 9
curl -s http://localhost:8000/contagion/network | jq '.edges | length'
# → 16
curl -s -X POST http://localhost:8000/contagion/simulate \
  -H 'Content-Type: application/json' \
  -d '{"shocked_account_id":"USD-Correspondent","intensity":1.0,"horizon_days":7}' \
  | jq '.breached_count, .total_loss_usd, (.affected | length)'
# → breached_count >= 1 (зависит от текущих ledger_balance после прогона)
# → total_loss_usd > 20_000_000 (5 прямых рёбер × ~3M каждое)
# → affected length >= 5 (как минимум все прямые соседи hub'а)
```

**Что должно быть видно в PR:**
- 1 новый файл фикстуры, ~110 строк JSON.
- 1 новый файл `contagion.py` сервиса, ~250 строк (с docstring).
- 1 переписанный роут `routes/contagion.py`, ~50 строк.
- 1 новый файл теста, ~110 строк, 6 тестов.
- 0 правок Азимовского кода (`data_generator.py`, `forecaster.py`, etc).
- 0 правок фронта.
- 0 новых зависимостей в `pyproject.toml`.

---

## Anti-patterns (не делай ЭТОГО)

- Не трогай `state.transactions` для построения рёбер — там нет counterparty, ты впустую потеряешь час и сдашь фантомный граф из шума.
- Не добавляй `react-flow`, `d3-force`, `vis-network` или любой граф-фронт. Это **только** бэкенд. Фронт = 0010.
- Не оборачивай `simulate_cascade` в `try/except Exception: pass`. Если упало — должно упасть с понятным сообщением.
- Не вызывай Monte Carlo / случайные сэмплинги. Каскад **детерминирован**. Тесты на это рассчитывают.
- Не используй `getattr(node, "current_balance_usd", 0)` или ленивый доступ — узлы типизированы dataclass'ами, читай атрибуты напрямую.
- Не добавляй `methodology_inputs`-стиль hints в JSON ответе. Method-аккордеон — отдельная фишка Time Machine, в контейджне он не нужен (на 0010 будет один компактный side-panel).
- Не пытайся переименовать существующие endpoint'ы. Маунт остаётся `/contagion`.
- Не бампай `next`, `react`, `react-dom` ни на что. На фронт-стек этот PR вообще не должен влиять.

---

## Что прислать в чат после ship'а

Одной строкой: PR title, merge SHA, краткий status матрицы тестов:

```
shipped 0009 as <SHA>
  pytest: 5 + 6 new = 11 passed
  ruff:   0 issues
  curl /contagion/network: 9 nodes, 16 edges
  curl /contagion/simulate USD-Correspondent intensity=1.0: breached=N, loss_usd=M
```

После твоего рапорта я обновлю `INDEX.md` (0009 → SHIPPED) и `state.md` (Phase 5 backend done, frontend 0010 в очереди).
