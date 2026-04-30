from datetime import date as DateType
from typing import Literal

from pydantic import BaseModel, Field

# ─── Life Areas ───────────────────────────────────────────────────────────────


class LifeAreaCreate(BaseModel):
    name: str
    icon: str
    color: str
    description: str | None = None
    sort_order: int = 0


class LifeAreaUpdate(BaseModel):
    name: str | None = None
    icon: str | None = None
    color: str | None = None
    description: str | None = None
    sort_order: int | None = None
    active: bool | None = None


class LifeAreaResponse(BaseModel):
    id: str
    name: str
    icon: str
    color: str
    description: str | None = None
    sort_order: int = 0
    active: bool = True


# ─── Projects ─────────────────────────────────────────────────────────────────

ProjectStatus = Literal["active", "paused", "completed", "dropped"]
Priority = Literal[1, 2, 3]


class LifeAreaNested(BaseModel):
    id: str
    name: str
    icon: str
    color: str


class ProjectCreate(BaseModel):
    title: str
    life_area_id: str | None = None
    description: str | None = None
    why: str | None = None
    status: ProjectStatus = "active"
    priority: int = Field(default=2, ge=1, le=3)
    target_date: DateType | None = None


class ProjectUpdate(BaseModel):
    title: str | None = None
    life_area_id: str | None = None
    description: str | None = None
    why: str | None = None
    status: ProjectStatus | None = None
    priority: int | None = Field(default=None, ge=1, le=3)
    target_date: DateType | None = None
    progress_pct: int | None = Field(default=None, ge=0, le=100)


class ProjectResponse(BaseModel):
    id: str
    life_area_id: str | None = None
    life_area: LifeAreaNested | None = None
    title: str
    description: str | None = None
    why: str | None = None
    status: ProjectStatus = "active"
    priority: int = 2
    target_date: DateType | None = None
    progress_pct: int = 0
    last_task_date: DateType | None = None
    stalled_flag: bool = False
    created_at: str | None = None


# ─── Daily Tasks ──────────────────────────────────────────────────────────────

TaskSource = Literal["manual", "agent", "google_calendar"]


class ProjectNested(BaseModel):
    id: str
    title: str
    life_area_id: str | None = None


class DailyTaskCreate(BaseModel):
    title: str
    date: DateType
    project_id: str | None = None
    life_area_id: str | None = None
    notes: str | None = None
    priority: int = Field(default=2, ge=1, le=3)
    estimated_minutes: int | None = None
    source: TaskSource = "manual"


class DailyTaskUpdate(BaseModel):
    title: str | None = None
    project_id: str | None = None
    life_area_id: str | None = None
    notes: str | None = None
    priority: int | None = Field(default=None, ge=1, le=3)
    estimated_minutes: int | None = None


class DailyTaskResponse(BaseModel):
    id: str
    project_id: str | None = None
    project: ProjectNested | None = None
    life_area_id: str | None = None
    life_area: LifeAreaNested | None = None
    date: DateType
    title: str
    notes: str | None = None
    priority: int = 2
    estimated_minutes: int | None = None
    source: TaskSource = "manual"
    completed: bool = False
    completed_at: str | None = None
    postponed_count: int = 0
    postponed_reason: str | None = None
    agent_justification: str | None = None


class PostponeTaskRequest(BaseModel):
    reason: str
    new_date: DateType | None = None  # defaults to tomorrow


# ─── Plans ────────────────────────────────────────────────────────────────────


class GeneratePlanRequest(BaseModel):
    date: DateType | None = None
    force_regenerate: bool = False


class AgentTaskSuggestion(BaseModel):
    title: str
    project_id: str | None = None
    life_area_id: str | None = None
    priority: int = 2
    estimated_minutes: int = 30
    justification: str = ""
    how_to_start: str = ""


class DailyPlanResponse(BaseModel):
    id: str
    date: DateType
    generated_at: str | None = None
    tasks_suggested: list[AgentTaskSuggestion] = []
    plan_summary: str = ""
    energy_context: str = ""
    accepted: bool = False
    modified: bool = False


# ─── Summary (dashboard card) ─────────────────────────────────────────────────


class GoalsSummaryResponse(BaseModel):
    total: int = 0
    completed: int = 0
    p1_completed: int = 0
    p1_total: int = 0
    has_agent_plan: bool = False


# ─── Accountability ───────────────────────────────────────────────────────────


class AccountabilityAlert(BaseModel):
    type: Literal["repeated_postpone", "stalled_project"]
    task_id: str | None = None
    project_id: str | None = None
    message: str
    actions: list[str]
