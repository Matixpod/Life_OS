"""Habits API — CRUD + completion + per-date entry materialisation."""

from __future__ import annotations

import logging
from datetime import date as DateType

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from core.supabase_client import get_supabase, get_user_id
from models.habit_models import (
    Habit,
    HabitCompletionResult,
    HabitCreate,
    HabitUpdate,
)
from models.task_models import Task
from services import habits_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/habits", tags=["habits"])


@router.get("", response_model=list[Habit])
async def list_habits(
    include_inactive: bool = False,
    supabase: Client = Depends(get_supabase),
) -> list[Habit]:
    user_id = get_user_id(supabase)
    return habits_service.get_habits(
        supabase, user_id, include_inactive=include_inactive
    )


@router.post("", response_model=Habit, status_code=201)
async def create_habit_route(
    payload: HabitCreate,
    supabase: Client = Depends(get_supabase),
) -> Habit:
    user_id = get_user_id(supabase)
    try:
        return habits_service.create_habit(supabase, user_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except Exception as e:
        logger.exception("habits.create error")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.patch("/{habit_id}", response_model=Habit)
async def update_habit_route(
    habit_id: str,
    payload: HabitUpdate,
    supabase: Client = Depends(get_supabase),
) -> Habit:
    user_id = get_user_id(supabase)
    try:
        return habits_service.update_habit(supabase, user_id, habit_id, payload)
    except habits_service.HabitNotFound:
        raise HTTPException(status_code=404, detail=f"Habit {habit_id} not found")
    except Exception as e:
        logger.exception("habits.update error")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/{habit_id}", status_code=204)
async def delete_habit_route(
    habit_id: str,
    supabase: Client = Depends(get_supabase),
) -> None:
    user_id = get_user_id(supabase)
    try:
        habits_service.soft_delete_habit(supabase, user_id, habit_id)
    except habits_service.HabitNotFound:
        raise HTTPException(status_code=404, detail=f"Habit {habit_id} not found")
    except Exception as e:
        logger.exception("habits.delete error")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/{habit_id}/complete", response_model=HabitCompletionResult)
async def complete_habit_today(
    habit_id: str,
    supabase: Client = Depends(get_supabase),
) -> HabitCompletionResult:
    """Convenience: complete today's daily_tasks entry for this habit.

    Generates today's entry if missing (idempotent), then marks it done.
    """
    user_id = get_user_id(supabase)
    today = DateType.today()
    try:
        entries = habits_service.generate_habit_entries(
            supabase, user_id, today
        )
        match = next((e for e in entries if e.habit_id == habit_id), None)
        if match is None:
            # Habit not eligible today — still try to mark its existing entry done.
            from core import config  # local import — avoids module cycle

            res = (
                supabase.table(config.TABLE_DAILY_TASKS)
                .select("*")
                .eq("user_id", user_id)
                .eq("habit_id", habit_id)
                .eq("date", today.isoformat())
                .limit(1)
                .execute()
            )
            if not res.data:
                raise HTTPException(
                    status_code=409,
                    detail="Habit nie ma dzisiaj wpisu (recurrence się nie spełnia).",
                )
            entry_id = res.data[0]["id"]
        else:
            entry_id = match.id
        return habits_service.complete_habit_entry(supabase, user_id, entry_id)
    except HTTPException:
        raise
    except habits_service.HabitNotFound:
        raise HTTPException(status_code=404, detail=f"Habit {habit_id} not found")
    except Exception as e:
        logger.exception("habits.complete error")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/{habit_id}/uncomplete", response_model=HabitCompletionResult)
async def uncomplete_habit_today_route(
    habit_id: str,
    supabase: Client = Depends(get_supabase),
) -> HabitCompletionResult:
    """Revert today's habit entry from done back to todo (idempotent)."""
    user_id = get_user_id(supabase)
    try:
        return habits_service.uncomplete_habit_today(supabase, user_id, habit_id)
    except habits_service.HabitNotFound:
        raise HTTPException(status_code=404, detail=f"Habit {habit_id} not found")
    except LookupError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e
    except Exception as e:
        logger.exception("habits.uncomplete error")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/entries/{daily_task_id}/complete", response_model=HabitCompletionResult)
async def complete_habit_entry_route(
    daily_task_id: str,
    supabase: Client = Depends(get_supabase),
) -> HabitCompletionResult:
    """Mark a specific habit entry done and recalculate the streak."""
    user_id = get_user_id(supabase)
    try:
        return habits_service.complete_habit_entry(supabase, user_id, daily_task_id)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as e:
        logger.exception("habits.entries.complete error")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/entries/{daily_task_id}/uncomplete", response_model=HabitCompletionResult)
async def uncomplete_habit_entry_route(
    daily_task_id: str,
    supabase: Client = Depends(get_supabase),
) -> HabitCompletionResult:
    """Revert a specific habit entry from done back to todo."""
    user_id = get_user_id(supabase)
    try:
        return habits_service.uncomplete_habit_entry(supabase, user_id, daily_task_id)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as e:
        logger.exception("habits.entries.uncomplete error")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/entries/{date_str}", response_model=list[Task])
async def get_habit_entries_for_date(
    date_str: str,
    supabase: Client = Depends(get_supabase),
) -> list[Task]:
    try:
        target = DateType.fromisoformat(date_str)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"Invalid date: {e}") from e
    user_id = get_user_id(supabase)
    try:
        return habits_service.generate_habit_entries(supabase, user_id, target)
    except Exception as e:
        logger.exception("habits.entries error")
        raise HTTPException(status_code=500, detail=str(e)) from e


__all__ = ["router"]
