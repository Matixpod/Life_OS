"""Streak tracker scenarios with a fake in-memory Supabase."""

from datetime import date, timedelta

from agents.kronos.streak_tracker import calculate_streaks
from models.kronos import TaskCategory

from .conftest import USER_ID, FakeSupabase


def _seed_done_tasks(
    sb: FakeSupabase,
    category: TaskCategory,
    days: list[date],
) -> None:
    sb.tables.setdefault("daily_tasks", []).extend(
        {
            "user_id": USER_ID,
            "category": category.value,
            "date": d.isoformat(),
            "status": "done",
            "completed": True,
        }
        for d in days
    )


def _streak_for(streaks, category: TaskCategory):
    return next(s for s in streaks if s.category == category)


def test_no_tasks_returns_empty_streaks(fake_supabase):
    streaks = calculate_streaks(fake_supabase, today=date(2026, 4, 29))

    assert len(streaks) == len(list(TaskCategory))
    for s in streaks:
        assert s.current_streak == 0
        assert s.longest_streak == 0
        assert s.last_active_date is None


def test_seven_day_streak_today_is_active(fake_supabase):
    today = date(2026, 4, 29)
    days = [today - timedelta(days=i) for i in range(7)]
    _seed_done_tasks(fake_supabase, TaskCategory.VITALITY, days)

    streaks = calculate_streaks(fake_supabase, today=today)
    vit = _streak_for(streaks, TaskCategory.VITALITY)

    assert vit.current_streak == 7
    assert vit.longest_streak >= 7
    assert vit.last_active_date == today
    assert vit.trend in {"up", "stable"}


def test_streak_broken_yesterday(fake_supabase):
    today = date(2026, 4, 29)
    # 5 days of done tasks ending two days ago — yesterday and today both empty.
    days = [today - timedelta(days=i) for i in range(2, 7)]
    _seed_done_tasks(fake_supabase, TaskCategory.INTELLECT, days)

    streaks = calculate_streaks(fake_supabase, today=today)
    intl = _streak_for(streaks, TaskCategory.INTELLECT)

    assert intl.current_streak == 0
    assert intl.longest_streak == 5


def test_streak_broken_three_weeks_ago(fake_supabase):
    today = date(2026, 4, 29)
    # 10 consecutive done days that ended 21 days ago.
    days = [today - timedelta(days=21 + i) for i in range(10)]
    _seed_done_tasks(fake_supabase, TaskCategory.DISCIPLINE, days)

    streaks = calculate_streaks(fake_supabase, today=today)
    disc = _streak_for(streaks, TaskCategory.DISCIPLINE)

    assert disc.current_streak == 0
    assert disc.longest_streak == 10
