"""Pydantic v2 models for the unified Calendar view."""

from __future__ import annotations

from datetime import date as DateType
from datetime import time
from typing import Literal

from pydantic import BaseModel, Field

from models.kronos import TaskCategory, TaskStatus
from models.proposal_models import AgentTaskProposal
from models.task_models import DayPart, TaskPriority

__all__ = ["CalendarDay", "CalendarItem", "CalendarItemType", "CalendarRange"]

CalendarItemType = Literal["task", "habit_entry", "project_task"]


class CalendarItem(BaseModel):
    """A single row rendered in the Calendar view.

    `agent_route` is computed server-side from the item's category so the
    frontend can `navigate(item.agent_route)` without any branching.
    """

    id: str
    type: CalendarItemType
    title: str
    category: TaskCategory | None = None
    status: TaskStatus = TaskStatus.TODO
    priority: TaskPriority = TaskPriority.MEDIUM
    scheduled_date: DateType
    habit_id: str | None = None
    project_id: str | None = None
    project_title: str | None = None
    project_task_id: str | None = None
    agent_route: str
    is_main_quest: bool = False
    start_time: time | None = None
    day_part: DayPart | None = None


class CalendarDay(BaseModel):
    date: DateType
    items: list[CalendarItem] = Field(default_factory=list)
    proposals: list[AgentTaskProposal] = Field(default_factory=list)
    completion_rate: float = Field(default=0.0, ge=0.0, le=1.0)


class CalendarRange(BaseModel):
    start: DateType
    end: DateType
    days: list[CalendarDay] = Field(default_factory=list)
