"""Router-level smoke tests for /api/v1/kronos/dashboard."""

from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

import main
from core.supabase_client import get_supabase
from models.kronos import (
    KronosContext,
    PatternData,
    PvEScore,
    StreakData,
    TaskCategory,
)


@pytest.fixture
def client(monkeypatch):
    main.app.dependency_overrides[get_supabase] = lambda: object()
    monkeypatch.setattr(
        "routers.kronos.kronos_service.latest_analysis_at",
        lambda _sb: None,
    )
    try:
        yield TestClient(main.app)
    finally:
        main.app.dependency_overrides.clear()


def _ctx_with_data() -> KronosContext:
    return KronosContext(
        user_id="00000000-0000-0000-0000-000000000001",
        generated_at=datetime(2026, 4, 29, 8, 0, tzinfo=UTC),
        streaks=[
            StreakData(
                category=TaskCategory.VITALITY,
                current_streak=3,
                longest_streak=5,
                trend="up",
            )
        ],
        patterns=[PatternData(category=TaskCategory.VITALITY, sample_size=10)],
        pve_scores=[PvEScore(category=TaskCategory.VITALITY, overall_ratio=0.6)],
        global_consistency_score=70.0,
        alerts=[],
    )


def _ctx_empty() -> KronosContext:
    return KronosContext(
        user_id="00000000-0000-0000-0000-000000000001",
        generated_at=datetime(2026, 4, 29, 8, 0, tzinfo=UTC),
        streaks=[],
        patterns=[],
        pve_scores=[],
        global_consistency_score=None,
        alerts=[],
    )


def test_dashboard_returns_correct_shape(client, monkeypatch):
    monkeypatch.setattr(
        "routers.kronos.context_builder.build_context",
        lambda _sb: _ctx_with_data(),
    )

    res = client.get("/api/v1/kronos/dashboard")

    assert res.status_code == 200
    body = res.json()
    for key in (
        "global_consistency_score",
        "streaks",
        "patterns",
        "pve_scores",
        "alerts",
        "last_analysis_at",
    ):
        assert key in body
    assert body["global_consistency_score"] == 70.0
    assert len(body["streaks"]) == 1


def test_dashboard_with_empty_state(client, monkeypatch):
    monkeypatch.setattr(
        "routers.kronos.context_builder.build_context",
        lambda _sb: _ctx_empty(),
    )

    res = client.get("/api/v1/kronos/dashboard")

    assert res.status_code == 200
    body = res.json()
    assert body["global_consistency_score"] is None
    assert body["streaks"] == []
    assert body["patterns"] == []
    assert body["pve_scores"] == []
    assert body["alerts"] == []
    assert body["last_analysis_at"] is None
