"""Service-layer tests for the Daily System.

Covers the assertions called out in
`/docs/agents/daily-system/CHECKLIST.md` Phase 5: stamina pool maths,
upsert semantics, status aggregation, and boost cooldown / max-per-day
guards. All tests use the in-memory `FakeSupabase` from `conftest.py`.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from datetime import date as DateType

import pytest

from models.daily_system_models import BoostType
from services import daily_log_service
from services.daily_log_service import (
    BOOST_CONFIG,
    BoostMaxReached,
    BoostOnCooldown,
    compute_stamina_pool,
)

from .conftest import USER_ID, FakeSupabase

TODAY = DateType.today()


# ─── compute_stamina_pool ────────────────────────────────────────────────────


def test_pool_peak() -> None:
    assert compute_stamina_pool(100, 100) == 600


def test_pool_average() -> None:
    assert compute_stamina_pool(70, 70) == 420


def test_pool_floor() -> None:
    assert compute_stamina_pool(0, 0) == 0


def test_pool_clamps_negative() -> None:
    # Defensive: even though Pydantic blocks negatives, the function
    # itself must never return < 0 or > 600.
    assert compute_stamina_pool(-50, -50) == 0
    assert compute_stamina_pool(200, 200) == 600


def test_pool_example_72_85() -> None:
    # Matches the worked example in PROMPT.md (section "Stamina Pool Calc").
    assert compute_stamina_pool(72, 85) == 471


# ─── create_daily_log ────────────────────────────────────────────────────────


def test_create_daily_log_inserts_row(fake_supabase: FakeSupabase) -> None:
    log = daily_log_service.create_daily_log(fake_supabase, 70, 70, "fine")
    assert log.stamina_pool == 420
    rows = fake_supabase.tables["daily_logs"]
    assert len(rows) == 1
    assert rows[0]["sleep_score"] == 70
    assert rows[0]["energy_score"] == 70
    assert rows[0]["stamina_pool"] == 420
    assert rows[0]["notes"] == "fine"


def test_create_daily_log_upserts_same_day(fake_supabase: FakeSupabase) -> None:
    daily_log_service.create_daily_log(fake_supabase, 60, 60)
    daily_log_service.create_daily_log(fake_supabase, 90, 90)
    rows = fake_supabase.tables["daily_logs"]
    assert len(rows) == 1, "upsert must collapse same-day inserts"
    assert rows[0]["sleep_score"] == 90
    assert rows[0]["stamina_pool"] == 540


# ─── get_stamina_status ──────────────────────────────────────────────────────


def _seed_log(fake: FakeSupabase, sleep: int, energy: int) -> None:
    pool = compute_stamina_pool(sleep, energy)
    fake.tables["daily_logs"].append(
        {
            "id": "log-today",
            "user_id": USER_ID,
            "date": TODAY.isoformat(),
            "sleep_score": sleep,
            "energy_score": energy,
            "stamina_pool": pool,
            "notes": None,
            "created_at": "2026-05-06T08:00:00+00:00",
        }
    )


def _seed_task(
    fake: FakeSupabase,
    *,
    minutes: int,
    status: str,
    is_regen: bool = False,
    title: str = "task",
) -> None:
    fake.tables["daily_tasks"].append(
        {
            "id": f"task-{len(fake.tables['daily_tasks'])}",
            "user_id": USER_ID,
            "title": title,
            "date": TODAY.isoformat(),
            "status": status,
            "estimated_minutes": minutes,
            "is_regenerative": is_regen,
        }
    )


def test_status_uninitialised(fake_supabase: FakeSupabase) -> None:
    status = daily_log_service.get_stamina_status(fake_supabase)
    assert status.is_initialized is False
    assert status.base_pool == 0
    assert status.ap_available == 0


def test_status_no_tasks_equals_base(fake_supabase: FakeSupabase) -> None:
    _seed_log(fake_supabase, 70, 70)
    status = daily_log_service.get_stamina_status(fake_supabase)
    assert status.is_initialized is True
    assert status.base_pool == 420
    assert status.ap_used == 0
    assert status.ap_restored == 0
    assert status.ap_available == 420
    assert status.percentage == 100.0


def test_status_completed_task_drains(fake_supabase: FakeSupabase) -> None:
    _seed_log(fake_supabase, 70, 70)
    _seed_task(fake_supabase, minutes=60, status="done")
    _seed_task(fake_supabase, minutes=90, status="todo")  # not yet done
    status = daily_log_service.get_stamina_status(fake_supabase)
    assert status.ap_used == 60
    assert status.ap_available == 420 - 60
    # Both tasks appear in the breakdown — completed flag distinguishes them.
    assert {t.is_completed for t in status.tasks_breakdown} == {True, False}


def test_status_regenerative_restores(fake_supabase: FakeSupabase) -> None:
    _seed_log(fake_supabase, 70, 70)
    _seed_task(fake_supabase, minutes=20, status="done", is_regen=True)
    status = daily_log_service.get_stamina_status(fake_supabase)
    assert status.ap_restored == 20
    assert status.ap_used == 0
    assert status.ap_available == 420 + 20
    # AP cost is signed negative for regenerative tasks.
    assert status.tasks_breakdown[0].ap_cost == -20


def test_status_floor_at_zero(fake_supabase: FakeSupabase) -> None:
    _seed_log(fake_supabase, 30, 30)  # pool = 180
    _seed_task(fake_supabase, minutes=300, status="done")
    status = daily_log_service.get_stamina_status(fake_supabase)
    # Without flooring this would be -120; service must clamp at 0.
    assert status.ap_available == 0


# ─── boosts ──────────────────────────────────────────────────────────────────


def _seed_boost_today(
    fake: FakeSupabase, boost_type: BoostType, *, minutes_ago: int
) -> None:
    used_at = (datetime.now(tz=UTC) - timedelta(minutes=minutes_ago)).isoformat()
    fake.tables["stamina_boosts"].append(
        {
            "id": f"b-{len(fake.tables['stamina_boosts'])}",
            "user_id": USER_ID,
            "date": TODAY.isoformat(),
            "boost_type": boost_type.value,
            "ap_restored": BOOST_CONFIG[boost_type]["ap"],
            "used_at": used_at,
        }
    )


def test_boost_use_inserts_and_returns_status(fake_supabase: FakeSupabase) -> None:
    _seed_log(fake_supabase, 70, 70)
    result = daily_log_service.use_boost(fake_supabase, BoostType.COFFEE)
    assert result.ap_restored == 30
    assert result.new_ap_available == 420 + 30
    assert len(fake_supabase.tables["stamina_boosts"]) == 1


def test_boost_on_cooldown_raises(fake_supabase: FakeSupabase) -> None:
    _seed_log(fake_supabase, 70, 70)
    # Coffee cooldown is 4h. A use 1h ago → still on cooldown.
    _seed_boost_today(fake_supabase, BoostType.COFFEE, minutes_ago=60)
    with pytest.raises(BoostOnCooldown) as exc:
        daily_log_service.use_boost(fake_supabase, BoostType.COFFEE)
    assert exc.value.remaining_minutes > 0


def test_boost_after_cooldown_succeeds(fake_supabase: FakeSupabase) -> None:
    _seed_log(fake_supabase, 70, 70)
    # Coffee cooldown is 4h — pretend it was used 5h ago.
    _seed_boost_today(fake_supabase, BoostType.COFFEE, minutes_ago=300)
    result = daily_log_service.use_boost(fake_supabase, BoostType.COFFEE)
    assert result.ap_restored == 30


def test_coffee_max_2_per_day(fake_supabase: FakeSupabase) -> None:
    _seed_log(fake_supabase, 70, 70)
    # Two existing coffees — both well past their 4h cooldown.
    _seed_boost_today(fake_supabase, BoostType.COFFEE, minutes_ago=600)
    _seed_boost_today(fake_supabase, BoostType.COFFEE, minutes_ago=400)
    with pytest.raises(BoostMaxReached) as exc:
        daily_log_service.use_boost(fake_supabase, BoostType.COFFEE)
    assert exc.value.max_per_day == 2


def test_unlimited_boost_no_max(fake_supabase: FakeSupabase) -> None:
    _seed_log(fake_supabase, 70, 70)
    # Walk has cooldown 2h, no max_per_day.
    _seed_boost_today(fake_supabase, BoostType.WALK, minutes_ago=200)  # > 2h
    result = daily_log_service.use_boost(fake_supabase, BoostType.WALK)
    assert result.ap_restored == 20


def test_availability_reports_cooldown(fake_supabase: FakeSupabase) -> None:
    _seed_log(fake_supabase, 70, 70)
    _seed_boost_today(fake_supabase, BoostType.COFFEE, minutes_ago=30)
    avail = daily_log_service.get_boost_availability(fake_supabase)
    coffee = next(a for a in avail if a.boost_type == BoostType.COFFEE)
    assert coffee.is_available is False
    assert coffee.cooldown_remaining_min is not None
    # 4h - 30m = 3h30m → 210 min, allow ±2 min for the elapsed test runtime.
    assert 205 <= coffee.cooldown_remaining_min <= 215


def test_availability_reports_max_reached(fake_supabase: FakeSupabase) -> None:
    _seed_log(fake_supabase, 70, 70)
    _seed_boost_today(fake_supabase, BoostType.NAP, minutes_ago=600)  # past cooldown
    avail = daily_log_service.get_boost_availability(fake_supabase)
    nap = next(a for a in avail if a.boost_type == BoostType.NAP)
    # Nap max_per_day is 1 → already used → unavailable, no cooldown left.
    assert nap.is_available is False
    assert nap.uses_today == 1
