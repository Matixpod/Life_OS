"""Pure-logic unit tests for compute_xp — no DB, no FastAPI."""

from datetime import UTC, date, datetime

import pytest

from models.task_models import Task, TaskCategory, TaskPriority, TaskStatus
from services.xp_engine import compute_xp


def _task(
    *,
    priority: TaskPriority,
    completed_at: datetime | None = None,
    scheduled_date: date | None = None,
) -> Task:
    return Task(
        id="t",
        user_id="u",
        title="x",
        category=TaskCategory.HEALTH,
        status=TaskStatus.DONE,
        priority=priority,
        scheduled_date=scheduled_date,
        completed_at=completed_at,
        created_at=datetime(2026, 4, 29, 0, 0, tzinfo=UTC),
    )


# ─── Phase 8: test_xp_early_bird_bonus ──────────────────────────────────────


def test_xp_early_bird_bonus():
    """Completed before noon local → +20% on top of base."""
    morning = datetime(2026, 4, 29, 8, 30, tzinfo=UTC)
    xp, reasons = compute_xp(_task(priority=TaskPriority.LOW, completed_at=morning), streak=0)
    # Base 10 × 1.20 = 12
    assert xp == 12
    assert "early_bird" in reasons


def test_xp_no_early_bird_after_noon():
    """Completed at noon or later → no early-bird bonus."""
    noon = datetime(2026, 4, 29, 12, 0, tzinfo=UTC)
    xp, reasons = compute_xp(_task(priority=TaskPriority.LOW, completed_at=noon), streak=0)
    assert xp == 10
    assert "early_bird" not in reasons


# ─── Phase 8: test_xp_streak_bonus ──────────────────────────────────────────


@pytest.mark.parametrize("streak,expected_bonus", [(0, False), (2, False), (3, True), (7, True)])
def test_xp_streak_bonus_threshold(streak: int, expected_bonus: bool):
    """Streak bonus fires at >= 3 days."""
    afternoon = datetime(2026, 4, 29, 15, 0, tzinfo=UTC)  # past noon → no early bird
    xp, reasons = compute_xp(
        _task(priority=TaskPriority.MEDIUM, completed_at=afternoon),
        streak=streak,
    )
    if expected_bonus:
        assert "streak_bonus" in reasons
        assert xp == 29  # ceil(25 × 1.15) = 29
    else:
        assert "streak_bonus" not in reasons
        assert xp == 25


# ─── Phase 8: test_xp_on_schedule_bonus ─────────────────────────────────────


def test_xp_on_schedule_bonus():
    """Completed on the same date the task was scheduled for → +30%."""
    sched = date(2026, 4, 29)
    afternoon = datetime(2026, 4, 29, 14, 0, tzinfo=UTC)  # past noon → no early bird
    xp, reasons = compute_xp(
        _task(priority=TaskPriority.MEDIUM, completed_at=afternoon, scheduled_date=sched),
        streak=0,
    )
    assert "on_schedule" in reasons
    assert xp == 33  # ceil(25 × 1.30) = 33


def test_xp_off_schedule_no_bonus():
    """Completed on a different day than scheduled → no on_schedule bonus."""
    sched = date(2026, 4, 28)  # yesterday
    today_pm = datetime(2026, 4, 29, 14, 0, tzinfo=UTC)
    xp, reasons = compute_xp(
        _task(priority=TaskPriority.MEDIUM, completed_at=today_pm, scheduled_date=sched),
        streak=0,
    )
    assert "on_schedule" not in reasons
    assert xp == 25


def test_xp_all_bonuses_stack_additively():
    """High + early + on_schedule + streak: 50 × (1 + 0.20 + 0.30 + 0.15) = 82.5 → 83."""
    sched = date(2026, 4, 29)
    morning = datetime(2026, 4, 29, 7, 0, tzinfo=UTC)
    xp, reasons = compute_xp(
        _task(priority=TaskPriority.HIGH, completed_at=morning, scheduled_date=sched),
        streak=5,
    )
    assert set(reasons) == {"early_bird", "on_schedule", "streak_bonus"}
    assert xp == 83
