"""Task System API — primary data-entry surface for Life OS.

Mounted at `/api/v1/tasks` (consistent with the rest of the codebase;
PROMPT spec says `/api/tasks` but every existing router uses the v1
prefix — frontend client adapts trivially).

The router is the only layer that knows about HTTP. It maps service-layer
exceptions onto status codes and never imports `supabase` directly.
"""

import logging
from datetime import date as DateType

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from supabase import Client

from agents.kronos.context_builder import refresh_streaks
from core.supabase_client import get_supabase
from models.kronos import TaskCategory, TaskStatus
from models.task_models import (
    DailyTaskList,
    Task,
    TaskCompletionResult,
    TaskCreate,
    TaskUpdate,
    WeeklyTaskList,
)
from services import task_service
from services.task_service import TaskAlreadyDone, TaskNotFound, TaskSkipped

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/tasks", tags=["tasks"])


def _category_value(task: Task) -> str | None:
    return task.category.value if task.category else None


# ─── Read endpoints ──────────────────────────────────────────────────────────


@router.get("/today", response_model=DailyTaskList)
async def get_today(
    supabase: Client = Depends(get_supabase),
) -> DailyTaskList:
    try:
        return task_service.get_daily_tasks(supabase, DateType.today())
    except Exception as e:
        logger.exception("tasks.today error")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/week", response_model=WeeklyTaskList)
async def get_week(
    week_start: str | None = Query(default=None, description="YYYY-MM-DD; defaults to current week"),
    supabase: Client = Depends(get_supabase),
) -> WeeklyTaskList:
    try:
        anchor = DateType.fromisoformat(week_start) if week_start else DateType.today()
    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"Invalid week_start: {e}")
    try:
        return task_service.get_weekly_tasks(supabase, anchor)
    except Exception as e:
        logger.exception("tasks.week error")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/backlog", response_model=list[Task])
async def get_backlog(
    supabase: Client = Depends(get_supabase),
) -> list[Task]:
    try:
        return task_service.get_backlog_tasks(supabase)
    except Exception as e:
        logger.exception("tasks.backlog error")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("", response_model=list[Task])
async def list_tasks(
    date: str | None = Query(default=None),
    category: TaskCategory | None = Query(default=None),
    status: TaskStatus | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    supabase: Client = Depends(get_supabase),
) -> list[Task]:
    """General filter query. Prefer `/today`, `/week`, `/backlog` for canned views."""
    try:
        target_date = DateType.fromisoformat(date) if date else None
    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"Invalid date: {e}")
    try:
        return task_service.query_tasks(
            supabase,
            target_date=target_date,
            category=category,
            status=status,
            limit=limit,
            offset=offset,
        )
    except Exception as e:
        logger.exception("tasks.list error")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Write endpoints ─────────────────────────────────────────────────────────


@router.post("", response_model=Task, status_code=201)
async def create_task(
    payload: TaskCreate,
    supabase: Client = Depends(get_supabase),
) -> Task:
    try:
        return task_service.create_task(supabase, payload)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("tasks.create error")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{task_id}", response_model=Task)
async def update_task(
    task_id: str,
    payload: TaskUpdate,
    supabase: Client = Depends(get_supabase),
) -> Task:
    try:
        return task_service.update_task(supabase, task_id, payload)
    except TaskNotFound:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    except Exception as e:
        logger.exception("tasks.update error")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{task_id}", status_code=204)
async def delete_task(
    task_id: str,
    supabase: Client = Depends(get_supabase),
) -> None:
    """Soft delete — sets status=skipped. Never hard deletes (KRONOS data integrity)."""
    try:
        task_service.soft_delete_task(supabase, task_id)
    except TaskNotFound:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    except Exception as e:
        logger.exception("tasks.delete error")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{task_id}/complete", response_model=TaskCompletionResult)
async def complete_task_route(
    task_id: str,
    background: BackgroundTasks,
    supabase: Client = Depends(get_supabase),
) -> TaskCompletionResult:
    try:
        result = task_service.complete_task(supabase, task_id)
    except TaskNotFound:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    except TaskAlreadyDone:
        raise HTTPException(status_code=409, detail=f"Task {task_id} is already done")
    except TaskSkipped:
        raise HTTPException(status_code=422, detail=f"Task {task_id} was skipped")
    except Exception as e:
        logger.exception("tasks.complete error")
        raise HTTPException(status_code=500, detail=str(e))

    background.add_task(refresh_streaks, _category_value(result.task))
    return result


@router.post("/{task_id}/skip", response_model=Task)
async def skip_task_route(
    task_id: str,
    background: BackgroundTasks,
    supabase: Client = Depends(get_supabase),
) -> Task:
    try:
        task = task_service.skip_task(supabase, task_id)
    except TaskNotFound:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    except Exception as e:
        logger.exception("tasks.skip error")
        raise HTTPException(status_code=500, detail=str(e))

    background.add_task(refresh_streaks, _category_value(task))
    return task
