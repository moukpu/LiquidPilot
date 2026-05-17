from fastapi.testclient import TestClient
from app.main import app


def test_health_before_warmup_or_after():
    with TestClient(app) as client:
        resp = client.get("/health")
        assert resp.status_code == 200
        assert "engine_ready" in resp.json()


def test_accounts_after_warmup():
    with TestClient(app) as client:
        resp = client.get("/accounts/")
        assert resp.status_code in (200, 503)
        if resp.status_code == 200:
            data = resp.json()
            # Fleet expanded over time (v3=3, v4=8, v5=9). Lock the
            # current fleet so a regression in default_system_config
            # surfaces here without re-pinning the count on every add.
            assert len(data) == 9
            assert {a["account_id"] for a in data} == {
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
