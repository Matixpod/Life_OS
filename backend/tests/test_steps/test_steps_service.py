"""Service-layer tests for the Steps module.

Covers: upsert semantics (overwrite same date), week aggregation
(always 7 entries, Monday→Sunday of the current ISO week, null for
missing days), and burn-rate aggregation (always 7 calendar days
ending today, sums multiple sessions per day, uses persisted
`kcal_total` when present and the MET fallback when null).
"""

from __future__ import annotations

from datetime import date as DateType
from datetime import timedelta

from models.schemas import StepLogRequest
from services import steps_service

from .conftest import USER_ID, FakeSupabase

TODAY = DateType.today()


def _monday_of(d: DateType) -> DateType:
    return d - timedelta(days=d.weekday())


def test_upsert_inserts_new_row(fake_supabase: FakeSupabase) -> None:
    res = steps_service.upsert_steps(
        fake_supabase, StepLogRequest(date=TODAY, steps=8432)
    )
    assert res.steps == 8432
    assert res.date == TODAY
    assert len(fake_supabase.tables["step_logs"]) == 1


def test_upsert_overwrites_same_date(fake_supabase: FakeSupabase) -> None:
    steps_service.upsert_steps(
        fake_supabase, StepLogRequest(date=TODAY, steps=1000)
    )
    steps_service.upsert_steps(
        fake_supabase, StepLogRequest(date=TODAY, steps=2000)
    )
    assert len(fake_supabase.tables["step_logs"]) == 1
    assert fake_supabase.tables["step_logs"][0]["steps"] == 2000


def test_get_steps_for_date_returns_none_when_missing(
    fake_supabase: FakeSupabase,
) -> None:
    assert steps_service.get_steps_for_date(fake_supabase, TODAY) is None


def test_get_steps_for_date_returns_log_when_present(
    fake_supabase: FakeSupabase,
) -> None:
    steps_service.upsert_steps(
        fake_supabase, StepLogRequest(date=TODAY, steps=9000)
    )
    log = steps_service.get_steps_for_date(fake_supabase, TODAY)
    assert log is not None
    assert log.steps == 9000


def test_get_steps_week_returns_seven_entries_with_nulls(
    fake_supabase: FakeSupabase,
) -> None:
    monday = _monday_of(TODAY)
    # log only Mon + Wed
    for offset, steps in [(0, 8100), (2, 12000)]:
        steps_service.upsert_steps(
            fake_supabase,
            StepLogRequest(date=monday + timedelta(days=offset), steps=steps),
        )

    week = steps_service.get_steps_week(fake_supabase)
    assert len(week) == 7
    assert week[0].date == monday.isoformat()
    assert week[0].steps == 8100
    assert week[1].steps is None
    assert week[2].steps == 12000
    assert week[6].date == (monday + timedelta(days=6)).isoformat()


def test_get_burn_rate_zero_when_no_sessions(
    fake_supabase: FakeSupabase,
) -> None:
    rows = steps_service.get_burn_rate(fake_supabase)
    assert len(rows) == 7
    assert all(r.kcal == 0 and r.duration_minutes == 0 for r in rows)


def test_get_burn_rate_uses_persisted_kcal(
    fake_supabase: FakeSupabase,
) -> None:
    fake_supabase.tables["cardio_sessions"].append({
        "id": "11111111-1111-1111-1111-111111111111",
        "user_id": USER_ID,
        "date": TODAY.isoformat(),
        "activity_type": "running",
        "label": "Bieg",
        "duration_min": 45,
        "kcal_total": 420.5,
    })
    rows = steps_service.get_burn_rate(fake_supabase)
    today_row = rows[-1]
    assert today_row.date == TODAY.isoformat()
    assert today_row.kcal == 420
    assert today_row.duration_minutes == 45
    assert today_row.workout_type == "running"


def test_get_burn_rate_falls_back_to_met_when_kcal_missing(
    fake_supabase: FakeSupabase,
) -> None:
    fake_supabase.tables["cardio_sessions"].append({
        "id": "22222222-2222-2222-2222-222222222222",
        "user_id": USER_ID,
        "date": TODAY.isoformat(),
        "activity_type": "bike",
        "label": "Rower",
        "duration_min": 60,
        "kcal_total": None,
    })
    rows = steps_service.get_burn_rate(fake_supabase)
    # MET bike=6, weight 75kg, 60 min → (6 * 3.5 * 75 / 200) * 60 = 472.5 → 472
    assert rows[-1].kcal == 472


def test_get_burn_rate_sums_multiple_sessions_same_day(
    fake_supabase: FakeSupabase,
) -> None:
    fake_supabase.tables["cardio_sessions"].extend([
        {
            "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            "user_id": USER_ID,
            "date": TODAY.isoformat(),
            "activity_type": "running",
            "label": "Bieg",
            "duration_min": 30,
            "kcal_total": 300,
        },
        {
            "id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            "user_id": USER_ID,
            "date": TODAY.isoformat(),
            "activity_type": "bike",
            "label": "Rower",
            "duration_min": 20,
            "kcal_total": 150,
        },
    ])
    today_row = steps_service.get_burn_rate(fake_supabase)[-1]
    assert today_row.kcal == 450
    assert today_row.duration_minutes == 50
