import logging
from datetime import date as DateType
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from supabase import Client

from core.supabase_client import get_supabase
from models.goals import (
    AccountabilityAlert,
    DailyPlanResponse,
    DailyTaskCreate,
    DailyTaskResponse,
    DailyTaskUpdate,
    GeneratePlanRequest,
    GoalsSummaryResponse,
    LifeAreaCreate,
    LifeAreaResponse,
    LifeAreaUpdate,
    PostponeTaskRequest,
    ProjectCreate,
    ProjectResponse,
    ProjectUpdate,
)
from services import goals_agent_service, goals_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/goals", tags=["goals"])


def _parse_date(value: str | None) -> DateType:
    if not value:
        return DateType.today()
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"Invalid date: {e}")


# ─── Life Areas ───────────────────────────────────────────────────────────────


@router.get("/areas", response_model=list[LifeAreaResponse])
async def list_areas(
    include_inactive: bool = Query(default=False),
    supabase: Client = Depends(get_supabase),
) -> list[LifeAreaResponse]:
    try:
        rows = goals_service.get_life_areas(supabase, include_inactive=include_inactive)
        return [LifeAreaResponse(**r) for r in rows]
    except Exception as e:
        logger.exception("list life areas error")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/areas", response_model=LifeAreaResponse)
async def create_area(
    payload: LifeAreaCreate, supabase: Client = Depends(get_supabase)
) -> LifeAreaResponse:
    try:
        row = goals_service.create_life_area(supabase, payload)
        return LifeAreaResponse(**row)
    except Exception as e:
        logger.exception("create life area error")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/areas/{area_id}", response_model=LifeAreaResponse)
async def update_area(
    area_id: str, payload: LifeAreaUpdate, supabase: Client = Depends(get_supabase)
) -> LifeAreaResponse:
    try:
        row = goals_service.update_life_area(supabase, area_id, payload)
        if not row:
            raise HTTPException(status_code=404, detail="Life area not found")
        return LifeAreaResponse(**row)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("update life area error")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/areas/{area_id}")
async def delete_area(
    area_id: str, supabase: Client = Depends(get_supabase)
) -> dict:
    try:
        row = goals_service.deactivate_life_area(supabase, area_id)
        return {"success": True, "data": row}
    except Exception as e:
        logger.exception("delete life area error")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Projects ─────────────────────────────────────────────────────────────────


@router.get("/projects", response_model=list[ProjectResponse])
async def list_projects(
    status: str | None = Query(default=None),
    supabase: Client = Depends(get_supabase),
) -> list[ProjectResponse]:
    try:
        rows = goals_service.get_projects(supabase, status=status)
        return [ProjectResponse(**r) for r in rows]
    except Exception as e:
        logger.exception("list projects error")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/projects", response_model=ProjectResponse)
async def create_project(
    payload: ProjectCreate, supabase: Client = Depends(get_supabase)
) -> ProjectResponse:
    try:
        row = goals_service.create_project(supabase, payload)
        return ProjectResponse(**row)
    except Exception as e:
        logger.exception("create project error")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    payload: ProjectUpdate,
    supabase: Client = Depends(get_supabase),
) -> ProjectResponse:
    try:
        row = goals_service.update_project(supabase, project_id, payload)
        if not row:
            raise HTTPException(status_code=404, detail="Project not found")
        return ProjectResponse(**row)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("update project error")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/stalled", response_model=list[ProjectResponse])
async def list_stalled_projects(
    supabase: Client = Depends(get_supabase),
) -> list[ProjectResponse]:
    try:
        rows = goals_service.check_stalled_projects(supabase)
        return [ProjectResponse(**r) for r in rows]
    except Exception as e:
        logger.exception("list stalled projects error")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Daily Tasks ──────────────────────────────────────────────────────────────


@router.get("/tasks", response_model=list[DailyTaskResponse])
async def list_tasks(
    date: str | None = Query(default=None),
    supabase: Client = Depends(get_supabase),
) -> list[DailyTaskResponse]:
    try:
        target = _parse_date(date)
        rows = goals_service.get_tasks_for_date(supabase, target)
        return [DailyTaskResponse(**r) for r in rows]
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("list tasks error")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tasks", response_model=DailyTaskResponse)
async def create_task(
    payload: DailyTaskCreate, supabase: Client = Depends(get_supabase)
) -> DailyTaskResponse:
    try:
        row = goals_service.create_task(supabase, payload)
        return DailyTaskResponse(**row)
    except Exception as e:
        logger.exception("create task error")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/tasks/{task_id}", response_model=DailyTaskResponse)
async def update_task(
    task_id: str, payload: DailyTaskUpdate, supabase: Client = Depends(get_supabase)
) -> DailyTaskResponse:
    try:
        row = goals_service.update_task(supabase, task_id, payload)
        if not row:
            raise HTTPException(status_code=404, detail="Task not found")
        return DailyTaskResponse(**row)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("update task error")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/tasks/{task_id}/complete", response_model=DailyTaskResponse)
async def complete_task(
    task_id: str, supabase: Client = Depends(get_supabase)
) -> DailyTaskResponse:
    try:
        row = goals_service.complete_task(supabase, task_id)
        if not row:
            raise HTTPException(status_code=404, detail="Task not found")
        return DailyTaskResponse(**row)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("complete task error")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/tasks/{task_id}/postpone", response_model=DailyTaskResponse)
async def postpone_task(
    task_id: str,
    payload: PostponeTaskRequest,
    supabase: Client = Depends(get_supabase),
) -> DailyTaskResponse:
    try:
        row = goals_service.postpone_task(
            supabase, task_id, payload.reason, payload.new_date
        )
        if not row:
            raise HTTPException(status_code=404, detail="Task not found")
        return DailyTaskResponse(**row)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("postpone task error")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/tasks/{task_id}")
async def delete_task(
    task_id: str, supabase: Client = Depends(get_supabase)
) -> dict:
    try:
        ok = goals_service.delete_task(supabase, task_id)
        return {"success": ok}
    except Exception as e:
        logger.exception("delete task error")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Plan ─────────────────────────────────────────────────────────────────────


@router.get("/plan", response_model=DailyPlanResponse | None)
async def get_plan(
    date: str | None = Query(default=None),
    supabase: Client = Depends(get_supabase),
) -> DailyPlanResponse | None:
    try:
        target = _parse_date(date)
        existing = goals_service.get_plan_for_date(supabase, target)
        if not existing:
            return None
        return DailyPlanResponse(
            id=existing["id"],
            date=target,
            generated_at=existing.get("generated_at"),
            tasks_suggested=existing.get("tasks_suggested") or [],
            plan_summary=existing.get("plan_summary", "") or "",
            energy_context=existing.get("energy_context", "") or "",
            accepted=bool(existing.get("accepted")),
            modified=bool(existing.get("modified")),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("get plan error")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/plan/generate", response_model=DailyPlanResponse)
async def generate_plan(
    payload: GeneratePlanRequest, supabase: Client = Depends(get_supabase)
) -> DailyPlanResponse:
    try:
        plan_date = payload.date or DateType.today()
        return goals_agent_service.generate_daily_plan(
            supabase, plan_date, force_regenerate=payload.force_regenerate
        )
    except Exception as e:
        logger.exception("generate plan error")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/plan/{plan_id}/accept", response_model=DailyPlanResponse)
async def accept_plan(
    plan_id: str,
    modified: bool = Query(default=False),
    supabase: Client = Depends(get_supabase),
) -> DailyPlanResponse:
    try:
        row = goals_service.accept_plan(supabase, plan_id, modified=modified)
        if not row:
            raise HTTPException(status_code=404, detail="Plan not found")
        return DailyPlanResponse(
            id=row["id"],
            date=row["date"],
            generated_at=row.get("generated_at"),
            tasks_suggested=row.get("tasks_suggested") or [],
            plan_summary=row.get("plan_summary", "") or "",
            energy_context=row.get("energy_context", "") or "",
            accepted=bool(row.get("accepted")),
            modified=bool(row.get("modified")),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("accept plan error")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Summary + Accountability ────────────────────────────────────────────────


@router.get("/summary", response_model=GoalsSummaryResponse)
async def goals_summary(
    date: str | None = Query(default=None),
    supabase: Client = Depends(get_supabase),
) -> GoalsSummaryResponse:
    try:
        target = _parse_date(date)
        return goals_service.get_goals_summary(supabase, target)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("goals summary error")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/accountability", response_model=list[AccountabilityAlert])
async def accountability(
    supabase: Client = Depends(get_supabase),
) -> list[AccountabilityAlert]:
    try:
        return goals_agent_service.check_accountability_flags(supabase)
    except Exception as e:
        logger.exception("accountability error")
        raise HTTPException(status_code=500, detail=str(e))
