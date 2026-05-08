"""Pydantic v2 models for habits (recurring tasks)."""

from __future__ import annotations

from datetime import date as DateType
from datetime import datetime, time
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field

from models.kronos import TaskCategory
from models.task_models import DayPart, Task, TaskPriority

__all__ = [
    "CustomRecurrenceRule",
    "Habit",
    "HabitCompletionResult",
    "HabitCreate",
    "HabitUpdate",
    "RecurrenceType",
]


class RecurrenceType(StrEnum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    SELECTED_DAYS = "selected_days"
    CUSTOM = "custom"


class CustomRecurrenceRule(BaseModel):
    """Free-form rule for `recurrence_type='custom'`.

    Two supported shapes:
      * `{interval, unit}` — every N days/weeks/months from start_date
      * `{times_per, per}` — N times per week/month (counted via completions)
    """

    interval: int = Field(default=1, ge=1, le=365)
    unit: Literal["days", "weeks", "months"] = "days"
    times_per: int | None = Field(default=None, ge=1, le=14)
    per: Literal["week", "month"] | None = None


class HabitCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    category: TaskCategory
    priority: TaskPriority = TaskPriority.MEDIUM
    recurrence_type: RecurrenceType = RecurrenceType.DAILY
    selected_days: list[int] | None = Field(
        default=None, description="ISO weekdays 1..7"
    )
    monthly_day: int | None = Field(default=None, ge=1, le=31)
    custom_rule: CustomRecurrenceRule | None = None
    start_date: DateType = Field(default_factory=DateType.today)
    end_date: DateType | None = None
    estimated_minutes: int | None = Field(default=None, ge=0, le=600)
    is_regenerative: bool = False
    notes: str | None = None
    start_time: time | None = None
    day_part: DayPart | None = None


class HabitUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    category: TaskCategory | None = None
    priority: TaskPriority | None = None
    recurrence_type: RecurrenceType | None = None
    selected_days: list[int] | None = None
    monthly_day: int | None = Field(default=None, ge=1, le=31)
    custom_rule: CustomRecurrenceRule | None = None
    start_date: DateType | None = None
    end_date: DateType | None = None
    estimated_minutes: int | None = Field(default=None, ge=0, le=600)
    is_regenerative: bool | None = None
    is_active: bool | None = None
    notes: str | None = None
    start_time: time | None = None
    day_part: DayPart | None = None


class Habit(BaseModel):
    id: str
    user_id: str
    title: str
    category: TaskCategory
    priority: TaskPriority
    recurrence_type: RecurrenceType
    selected_days: list[int] | None = None
    monthly_day: int | None = None
    custom_rule: CustomRecurrenceRule | None = None
    is_active: bool = True
    start_date: DateType
    end_date: DateType | None = None
    estimated_minutes: int | None = None
    is_regenerative: bool = False
    streak: int = Field(default=0, ge=0)
    longest_streak: int = Field(default=0, ge=0)
    notes: str | None = None
    created_at: datetime
    updated_at: datetime | None = None
    completed_today: bool = False
    start_time: time | None = None
    day_part: DayPart | None = None


class HabitCompletionResult(BaseModel):
    habit: Habit
    daily_task: Task
    streak_updated: bool
    new_streak: int
