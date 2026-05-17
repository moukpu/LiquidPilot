"""Shared pytest fixtures.

`engine_ready` runs the (cached) warm-up once per test session so
stress / forecast tests can read `state.forecasts` and `state.transactions`
without paying training cost on every test.
"""

from __future__ import annotations

import pytest

from app.services.engine_state import state, warm_up


@pytest.fixture(scope="session")
def engine_ready():
    if not state.ready:
        warm_up()
    assert state.ready, f"engine warm-up failed: {state.error}"
    return state
