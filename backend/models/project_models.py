"""Pydantic v2 models for the redesign's Projects → Sections → Tasks hierarchy.

Distinct from the legacy `goals_module` Project (the one served by
`/api/v1/goals/projects`) — both share the same DB row, so updates here
are visible to legacy callers too. The redesign extends the existing table
with `category`, `color`, `due_date` and a wider `status` set.
"""

from __future__ import annotations

from datetime import date as DateType
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from models.kronos import TaskCategory, TaskStatus
from models.task_models import TaskPriority

__all__ = [
    "Project",
    "ProjectCreate",
    "ProjectFull",
    "ProjectProgress",
    "ProjectSection",
    "ProjectSectionCreate",
    "ProjectSectionUpdate",
    "ProjectSectionWithTasks",
    "ProjectStatus",
    "ProjectTask",
    "ProjectTaskCreate",
    "ProjectTaskUpdate",
    "ProjectUpdate",
    "ReorderRequest",
]

ProjectStatus = Literal[
    "active", "paused", "completed", "dropped", "archived", "on_hold"
]


class ProjectCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    category: TaskCategory
    priority: TaskPriority = TaskPriority.MEDIUM
    due_date: DateType | None = None
    color: str = Field(default="#6366f1", min_length=1, max_length=16)


class ProjectUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    category: TaskCategory | None = None
    priority: TaskPriority | None = None
    due_date: DateType | None = None
    color: str | None = None
    status: ProjectStatus | None = None


class Project(BaseModel):
    id: str
    user_id: str
    title: str
    description: str | None = None
    category: TaskCategory | None = None
    status: ProjectStatus = "active"
    priority: TaskPriority = TaskPriority.MEDIUM
    due_date: DateType | None = None
    color: str = "#6366f1"
    created_at: datetime
    updated_at: datetime | None = None


class ProjectTaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    section_id: str | None = None
    priority: TaskPriority = TaskPriority.MEDIUM
    due_date: DateType | None = None
    estimated_minutes: int | None = Field(default=None, ge=1, le=600)
    notes: str | None = None


class ProjectTaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    section_id: str | None = None
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    due_date: DateType | None = None
    estimated_minutes: int | None = None
    notes: str | None = None
    position: int | None = None


class ProjectTask(BaseModel):
    id: str
    project_id: str
    section_id: str | None = None
    user_id: str
    title: str
    status: TaskStatus = TaskStatus.TODO
    priority: TaskPriority = TaskPriority.MEDIUM
    due_date: DateType | None = None
    completed_at: datetime | None = None
    estimated_minutes: int | None = None
    notes: str | None = None
    position: int = 0
    created_at: datetime


class ProjectSectionCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    position: int = Field(default=0, ge=0)


class ProjectSectionUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    position: int | None = Field(default=None, ge=0)


class ProjectSection(BaseModel):
    id: str
    project_id: str
    user_id: str
    title: str
    position: int
    created_at: datetime


class ProjectSectionWithTasks(ProjectSection):
    tasks: list[ProjectTask] = Field(default_factory=list)


class ProjectProgress(BaseModel):
    total_tasks: int
    completed_tasks: int
    completion_percentage: float
    overdue_count: int


class ProjectFull(Project):
    sections: list[ProjectSectionWithTasks] = Field(default_factory=list)
    progress: ProjectProgress


class ReorderRequest(BaseModel):
    ids: list[str] = Field(min_length=1)
