"""Pydantic v2 models for the Task System.

The Task System is the primary data-entry interface for Life OS — every
downstream agent (KRONOS, ARES, ATHENA) reads from `daily_tasks`. These
models are the contract between the FastAPI routes and the frontend.

Per ADR-010, the underlying table is `daily_tasks` (not a parallel `tasks`
table). The PROMPT field name `scheduled_date` maps to the DB column `date`;
the service layer is responsible for the rename.

`TaskCategory` and `TaskStatus` are intentionally re-exported from
`models.kronos` so the Task System and KRONOS share a single source of
truth for the RPG-style category enum.
"""

from datetime import date as DateType
from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field

from models.kronos import TaskCategory, TaskStatus

__all__ = [
    "TaskCategory",
    "TaskStatus",
    "TaskPriority",
    "PRIORITY_TO_INT",
    "INT_TO_PRIORITY",
    "TaskCreate",
    "TaskUpdate",
    "Task",
    "CategoryDaySummary",
    "DailyTaskList",
    "WeeklyTaskList",
    "TaskCompletionResult",
]


# ─── Priority ─────────────────────────────────────────────────────────────────


class TaskPriority(StrEnum):
    """Human-readable priority used by the API.

    Mapped to/from the existing `daily_tasks.priority` INTEGER column
    (1..3, where 1 is highest — the convention already used by
    `goals_service.get_goals_summary`'s P1 logic).
    """

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


PRIORITY_TO_INT: dict[TaskPriority, int] = {
    TaskPriority.HIGH: 1,
    TaskPriority.MEDIUM: 2,
    TaskPriority.LOW: 3,
}

INT_TO_PRIORITY: dict[int, TaskPriority] = {v: k for k, v in PRIORITY_TO_INT.items()}


# ─── Request payloads ────────────────────────────────────────────────────────


class TaskCreate(BaseModel):
    """Payload for `POST /api/tasks`.

    `scheduled_date` is optional to support the Backlog view (tasks with no
    planned date). When omitted, the service layer must either reject the
    request (until the DB allows nullable `date`) or default to today.
    """

    title: str = Field(min_length=1, max_length=200)
    category: TaskCategory
    priority: TaskPriority = TaskPriority.MEDIUM
    scheduled_date: DateType | None = None
    estimated_minutes: int | None = Field(default=None, ge=5, le=480)
    notes: str | None = Field(default=None, max_length=1000)


class TaskUpdate(BaseModel):
    """Payload for `PATCH /api/tasks/{id}`. All fields optional."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    category: TaskCategory | None = None
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    scheduled_date: DateType | None = None
    estimated_minutes: int | None = Field(default=None, ge=5, le=480)
    notes: str | None = Field(default=None, max_length=1000)


# ─── Resource model ──────────────────────────────────────────────────────────


class Task(BaseModel):
    """Full task record returned by the API.

    `scheduled_date` is nullable to represent backlog items.
    """

    id: str
    user_id: str
    title: str
    category: TaskCategory | None = None
    status: TaskStatus = TaskStatus.TODO
    priority: TaskPriority = TaskPriority.MEDIUM
    scheduled_date: DateType | None = None
    completed_at: datetime | None = None
    estimated_minutes: int | None = None
    notes: str | None = None
    created_at: datetime


# ─── Aggregations ────────────────────────────────────────────────────────────


class CategoryDaySummary(BaseModel):
    """Per-category roll-up inside a single day."""

    category: TaskCategory
    planned: int = Field(ge=0)
    completed: int = Field(ge=0)
    xp_earned: int = Field(ge=0)


class DailyTaskList(BaseModel):
    """Response for `GET /api/tasks/today` and per-day items in `WeeklyTaskList`."""

    date: DateType
    tasks: list[Task] = Field(default_factory=list)
    by_category: dict[str, CategoryDaySummary] = Field(default_factory=dict)
    total_planned: int = Field(ge=0)
    total_completed: int = Field(ge=0)
    completion_rate: float = Field(ge=0.0, le=1.0)


class WeeklyTaskList(BaseModel):
    """Response for `GET /api/tasks/week`. ISO week, Mon–Sun."""

    week_start: DateType
    week_end: DateType
    days: list[DailyTaskList] = Field(default_factory=list)
    total_xp: int = Field(ge=0)
    best_day: DateType | None = None
    worst_day: DateType | None = None


# ─── Completion result ───────────────────────────────────────────────────────


class TaskCompletionResult(BaseModel):
    """Response for `POST /api/tasks/{id}/complete`.

    `bonus_reasons` are short machine tags consumed by the XP popup
    (e.g. `"early_bird"`, `"on_schedule"`, `"streak_bonus"`).
    """

    task: Task
    xp_earned: int = Field(ge=0)
    streak_updated: bool
    new_streak: int = Field(ge=0)
    bonus_reasons: list[str] = Field(default_factory=list)
