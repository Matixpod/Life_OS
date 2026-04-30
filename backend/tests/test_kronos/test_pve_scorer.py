"""PvE scorer scenarios with a fake in-memory Supabase."""

from datetime import date, timedelta

from agents.kronos.pve_scorer import calculate_pve
from models.kronos import TaskCategory

from .conftest import USER_ID, FakeSupabase


def _seed_tasks(
    sb: FakeSupabase,
    rows: list[tuple[date, TaskCategory, str]],
) -> None:
    """rows = [(date, category, status)]"""
    sb.tables.setdefault("daily_tasks", []).extend(
        {
            "user_id": USER_ID,
            "category": cat.value,
            "date": d.isoformat(),
            "status": status,
        }
        for d, cat, status in rows
    )


def _score_for(scores, category: TaskCategory):
    return next(s for s in scores if s.category == category)


def test_full_execution_today(fake_supabase):
    today = date(2026, 4, 29)
    _seed_tasks(
        fake_supabase,
        [(today, TaskCategory.VITALITY, "done")] * 5,
    )

    scores = calculate_pve(fake_supabase, today=today)
    vit = _score_for(scores, TaskCategory.VITALITY)

    assert vit.overall_ratio == 1.0
    assert vit.zero_execution_days == []
    assert vit.best_day == today
    assert vit.worst_day == today
    assert len(vit.daily_breakdown) == 1
    assert vit.daily_breakdown[0].planned == 5
    assert vit.daily_breakdown[0].completed == 5


def test_zero_execution_day(fake_supabase):
    today = date(2026, 4, 29)
    yesterday = today - timedelta(days=1)
    _seed_tasks(
        fake_supabase,
        [(yesterday, TaskCategory.WEALTH, "todo")] * 3,
    )

    scores = calculate_pve(fake_supabase, today=today)
    wlt = _score_for(scores, TaskCategory.WEALTH)

    assert yesterday in wlt.zero_execution_days
    assert wlt.overall_ratio < 1.0


def test_mixed_week(fake_supabase):
    today = date(2026, 4, 29)
    rows: list[tuple[date, TaskCategory, str]] = []
    for i in range(7):
        d = today - timedelta(days=i)
        rows.append((d, TaskCategory.CHARISMA, "done" if i % 2 == 0 else "todo"))

    _seed_tasks(fake_supabase, rows)
    scores = calculate_pve(fake_supabase, today=today)
    cha = _score_for(scores, TaskCategory.CHARISMA)

    assert 0.0 < cha.overall_ratio < 1.0
    assert cha.best_day is not None
    assert cha.worst_day is not None
    assert cha.best_day != cha.worst_day
