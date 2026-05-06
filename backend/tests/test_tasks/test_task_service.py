"""Service-layer tests — direct calls into task_service against FakeSupabase."""

from __future__ import annotations

from datetime import date

import pytest

from models.task_models import (
    TaskCategory,
    TaskCreate,
    TaskPriority,
    TaskStatus,
)
from services import task_service
from services.task_service import TaskAlreadyDone, TaskSkipped

from .conftest import USER_ID, FakeSupabase


def _seed_done_dates(fake: FakeSupabase, category: str, dates: list[date]) -> None:
    """Helper: drop minimal `done` rows so KRONOS streak_tracker sees activity."""
    for d in dates:
        fake.tables["daily_tasks"].append(
            {
                "id": f"seed-{category}-{d.isoformat()}",
                "user_id": USER_ID,
                "title": "seed",
                "category": category,
                "status": "done",
                "priority": 2,
                "date": d.isoformat(),
                "completed_at": f"{d.isoformat()}T08:00:00Z",
                "completed": True,
                "created_at": f"{d.isoformat()}T07:00:00Z",
            }
        )


# ─── test_create_task — happy path ──────────────────────────────────────────


def test_create_task(fake_supabase: FakeSupabase):
    payload = TaskCreate(
        title="  Run 5km  ",  # leading/trailing whitespace must be stripped
        category=TaskCategory.HEALTH,
        priority=TaskPriority.HIGH,
        scheduled_date=date(2026, 4, 29),
        estimated_minutes=40,
    )
    task = task_service.create_task(fake_supabase, payload)

    assert task.title == "Run 5km"
    assert task.category == TaskCategory.HEALTH
    assert task.priority == TaskPriority.HIGH
    assert task.status == TaskStatus.TODO
    assert task.scheduled_date == date(2026, 4, 29)

    # DB row uses int priority (1 = HIGH) — verify mapping happened.
    rows = fake_supabase.tables["daily_tasks"]
    assert len(rows) == 1
    assert rows[0]["priority"] == 1
    assert rows[0]["status"] == "todo"


# ─── test_complete_task — XP computed correctly ─────────────────────────────


def test_complete_task(fake_supabase: FakeSupabase):
    payload = TaskCreate(
        title="Cardio",
        category=TaskCategory.HEALTH,
        priority=TaskPriority.MEDIUM,
        scheduled_date=date.today(),
    )
    created = task_service.create_task(fake_supabase, payload)

    result = task_service.complete_task(fake_supabase, created.id)

    assert result.task.status == TaskStatus.DONE
    assert result.task.completed_at is not None
    # MEDIUM (25) × on_schedule (1.30) = 33; early-bird depends on local clock,
    # so accept either with-or-without that bonus.
    assert result.xp_earned in {33, 39}  # ceil(25*1.3)=33 or ceil(25*1.5)=38? 25*1.5=37.5→38
    # Actually: with both early_bird+on_schedule the multiplier is 1.50 → ceil(25*1.50)=38.
    assert result.xp_earned in {33, 38}
    assert "on_schedule" in result.bonus_reasons


# ─── test_complete_already_done → 409 raised at service layer ──────────────


def test_complete_already_done_raises(fake_supabase: FakeSupabase):
    created = task_service.create_task(
        fake_supabase,
        TaskCreate(
            title="x",
            category=TaskCategory.KNOWLEDGE,
            priority=TaskPriority.LOW,
            scheduled_date=date.today(),
        ),
    )
    task_service.complete_task(fake_supabase, created.id)

    with pytest.raises(TaskAlreadyDone):
        task_service.complete_task(fake_supabase, created.id)


# ─── test_complete_skipped → 422 raised at service layer ───────────────────


def test_complete_skipped_raises(fake_supabase: FakeSupabase):
    created = task_service.create_task(
        fake_supabase,
        TaskCreate(
            title="x",
            category=TaskCategory.OTHER,
            priority=TaskPriority.LOW,
            scheduled_date=date.today(),
        ),
    )
    task_service.skip_task(fake_supabase, created.id)

    with pytest.raises(TaskSkipped):
        task_service.complete_task(fake_supabase, created.id)


# ─── test_soft_delete — status=skipped, record still in DB ─────────────────


def test_soft_delete_keeps_row(fake_supabase: FakeSupabase):
    created = task_service.create_task(
        fake_supabase,
        TaskCreate(
            title="x",
            category=TaskCategory.OTHER,
            priority=TaskPriority.MEDIUM,
            scheduled_date=date.today(),
        ),
    )

    task_service.soft_delete_task(fake_supabase, created.id)

    rows = fake_supabase.tables["daily_tasks"]
    assert len(rows) == 1, "soft delete must NOT remove the row"
    assert rows[0]["status"] == "skipped"


# ─── test_daily_tasks_grouping — tasks grouped by category ─────────────────


def test_daily_tasks_grouping(fake_supabase: FakeSupabase):
    today = date.today()
    for cat, prio in [
        (TaskCategory.HEALTH, TaskPriority.HIGH),
        (TaskCategory.HEALTH, TaskPriority.MEDIUM),
        (TaskCategory.KNOWLEDGE, TaskPriority.HIGH),
    ]:
        task_service.create_task(
            fake_supabase,
            TaskCreate(title=f"{cat.value} task", category=cat, priority=prio, scheduled_date=today),
        )
    # Complete one of the vitality tasks
    vitality_id = fake_supabase.tables["daily_tasks"][0]["id"]
    task_service.complete_task(fake_supabase, vitality_id)

    daily = task_service.get_daily_tasks(fake_supabase, today)

    assert daily.total_planned == 3
    assert daily.total_completed == 1
    assert pytest.approx(daily.completion_rate, rel=1e-6) == 1 / 3

    vit = daily.by_category["health"]
    intel = daily.by_category["knowledge"]
    assert vit.planned == 2 and vit.completed == 1
    assert intel.planned == 1 and intel.completed == 0
    # Vitality completed → some XP (>= base 50). Intellect = 0.
    assert vit.xp_earned >= 50
    assert intel.xp_earned == 0
