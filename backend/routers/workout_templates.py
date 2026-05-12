"""PROMETHEUS — reusable workout templates."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Response
from supabase import Client

from core.supabase_client import get_supabase
from models.schemas import (
    WorkoutTemplateCreate,
    WorkoutTemplateScheduleRequest,
    WorkoutTemplateUpdate,
)
from services import workout_template_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/workout-templates", tags=["workout-templates"])


@router.get("")
async def list_templates(
    supabase: Client = Depends(get_supabase),
) -> list[dict]:
    try:
        return workout_template_service.list_templates(supabase)
    except Exception as e:
        logger.exception("workout_templates.list error")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/{template_id}")
async def get_template(
    template_id: str,
    supabase: Client = Depends(get_supabase),
) -> dict:
    try:
        result = workout_template_service.get_template(supabase, template_id)
    except Exception as e:
        logger.exception("workout_templates.get error")
        raise HTTPException(status_code=500, detail=str(e)) from e
    if not result:
        raise HTTPException(status_code=404, detail="Template not found")
    return result


@router.post("")
async def create_template(
    payload: WorkoutTemplateCreate,
    supabase: Client = Depends(get_supabase),
) -> dict:
    try:
        return workout_template_service.upsert_template(
            supabase, name=payload.name, exercises=payload.exercises
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve)) from ve
    except Exception as e:
        logger.exception("workout_templates.create error")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.patch("/{template_id}")
async def update_template(
    template_id: str,
    payload: WorkoutTemplateUpdate,
    supabase: Client = Depends(get_supabase),
) -> dict:
    try:
        result = workout_template_service.update_template(
            supabase,
            template_id,
            name=payload.name,
            exercises=payload.exercises,
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve)) from ve
    except Exception as e:
        logger.exception("workout_templates.update error")
        raise HTTPException(status_code=500, detail=str(e)) from e
    if not result:
        raise HTTPException(status_code=404, detail="Template not found")
    return result


@router.delete("/{template_id}", status_code=204)
async def delete_template(
    template_id: str,
    supabase: Client = Depends(get_supabase),
) -> Response:
    try:
        deleted = workout_template_service.delete_template(supabase, template_id)
    except Exception as e:
        logger.exception("workout_templates.delete error")
        raise HTTPException(status_code=500, detail=str(e)) from e
    if not deleted:
        raise HTTPException(status_code=404, detail="Template not found")
    return Response(status_code=204)


@router.post("/{template_id}/schedule")
async def schedule_template(
    template_id: str,
    payload: WorkoutTemplateScheduleRequest,
    supabase: Client = Depends(get_supabase),
) -> list[dict]:
    if not payload.dates:
        return []
    try:
        return workout_template_service.schedule_template(
            supabase, template_id, payload.dates
        )
    except Exception as e:
        logger.exception("workout_templates.schedule error")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/{template_id}/start-today")
async def start_today(
    template_id: str,
    supabase: Client = Depends(get_supabase),
) -> dict:
    try:
        result = workout_template_service.start_today(supabase, template_id)
    except Exception as e:
        logger.exception("workout_templates.start_today error")
        raise HTTPException(status_code=500, detail=str(e)) from e
    if not result:
        raise HTTPException(status_code=404, detail="Template not found")
    return result
