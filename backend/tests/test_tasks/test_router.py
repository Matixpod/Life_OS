"""Router-level tests — HTTP status mapping + KRONOS background-task wiring."""

from __future__ import annotations

from datetime import date
from typing import Any

import pytest
from fastapi.testclient import TestClient

import main
from agents.kronos import context_builder
from core.supabase_client import get_supabase

from .conftest import FakeSupabase


@pytest.fixture
def client(fake_supabase: FakeSupabase, monkeypatch: pytest.MonkeyPatch):
    """TestClient with the Supabase dependency overridden + a recording stub
    for the KRONOS BackgroundTask. The stub captures every call so the
    integration test can assert that completion DID enqueue a refresh.
    """
    main.app.dependency_overrides[get_supabase] = lambda: fake_supabase

    calls: list[Any] = []

    def _record(*args: Any, **kw: Any) -> None:
        calls.append({"args": args, "kw": kw})

    # Patch the symbol at the import site (routers.tasks pulled it in directly).
    monkeypatch.setattr("routers.tasks.refresh_streaks", _record)

    with TestClient(main.app) as c:
        c.kronos_calls = calls  # type: ignore[attr-defined]
        try:
            yield c
        finally:
            main.app.dependency_overrides.clear()


def _create(client: TestClient, **overrides: Any) -> dict[str, Any]:
    payload = {
        "title": "x",
        "category": "vitality",
        "priority": "medium",
        "scheduled_date": date.today().isoformat(),
        **overrides,
    }
    res = client.post("/api/v1/tasks", json=payload)
    assert res.status_code == 201, res.text
    return res.json()


# ─── test_complete_already_done → 409 ───────────────────────────────────────


def test_complete_already_done(client: TestClient):
    task = _create(client)
    first = client.post(f"/api/v1/tasks/{task['id']}/complete")
    assert first.status_code == 200

    again = client.post(f"/api/v1/tasks/{task['id']}/complete")
    assert again.status_code == 409
    assert "already" in again.json()["detail"].lower()


# ─── test_complete_skipped → 422 ────────────────────────────────────────────


def test_complete_skipped(client: TestClient):
    task = _create(client)
    skip = client.post(f"/api/v1/tasks/{task['id']}/skip")
    assert skip.status_code == 200

    res = client.post(f"/api/v1/tasks/{task['id']}/complete")
    assert res.status_code == 422
    assert "skip" in res.json()["detail"].lower()


# ─── test_kronos_streak_updates_after_completion ────────────────────────────


def test_kronos_streak_updates_after_completion(
    client: TestClient,
    fake_supabase: FakeSupabase,
    monkeypatch: pytest.MonkeyPatch,
):
    """End-to-end: completing a task must enqueue refresh_streaks AND, when
    that BackgroundTask runs against the same fake DB, it must upsert into
    `kronos_streaks` with the matching category."""
    # Force the background-task helper to use the same FakeSupabase instance
    # the request handler is using (the real impl creates a fresh client to
    # avoid HTTP/2 race issues — irrelevant in a fake).
    monkeypatch.setattr(
        "agents.kronos.context_builder.get_fresh_supabase",
        lambda: fake_supabase,
    )

    # Drop the routers.tasks stub so the real refresh_streaks runs through.
    monkeypatch.setattr("routers.tasks.refresh_streaks", context_builder.refresh_streaks)

    task = _create(client, category="vitality")
    res = client.post(f"/api/v1/tasks/{task['id']}/complete")
    assert res.status_code == 200

    # TestClient flushes BackgroundTasks before returning the response.
    cached = fake_supabase.tables.get("kronos_streaks", [])
    vit = [r for r in cached if r["category"] == "vitality"]
    assert len(vit) == 1, f"expected one vitality cache row, got {cached}"
    assert vit[0]["current_streak"] == 1
    assert vit[0]["last_active_date"] == date.today().isoformat()


# ─── test_complete_unknown → 404 ────────────────────────────────────────────


def test_complete_unknown_returns_404(client: TestClient):
    res = client.post("/api/v1/tasks/00000000-0000-0000-0000-000000000099/complete")
    assert res.status_code == 404


# ─── test_delete_returns_204 + soft semantics ──────────────────────────────


def test_delete_is_soft(client: TestClient, fake_supabase: FakeSupabase):
    task = _create(client)
    res = client.delete(f"/api/v1/tasks/{task['id']}")
    assert res.status_code == 204

    rows = fake_supabase.tables["daily_tasks"]
    assert len(rows) == 1
    assert rows[0]["status"] == "skipped"
