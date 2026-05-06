"""Unified calendar endpoints — single day, date range."""

from __future__ import annotations

import logging
from datetime import date as DateType

from fastapi import APIRouter, Depends, HTTPException, Query
from supabase import Client

from core.supabase_client import get_supabase, get_user_id
from models.calendar_models import CalendarDay, CalendarRange
from services import calendar_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.get("/range", response_model=CalendarRange)
async def get_range_route(
    start: str = Query(...),
    end: str = Query(...),
    supabase: Client = Depends(get_supabase),
) -> CalendarRange:
    try:
        start_d = DateType.fromisoformat(start)
        end_d = DateType.fromisoformat(end)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"Invalid date: {e}") from e
    if end_d < start_d:
        raise HTTPException(status_code=422, detail="end must be ≥ start")
    user_id = get_user_id(supabase)
    try:
        days = calendar_service.get_calendar_range(
            supabase, user_id, start_d, end_d
        )
    except calendar_service.CalendarRangeTooLarge as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.exception("calendar.range error")
        raise HTTPException(status_code=500, detail=str(e)) from e
    return CalendarRange(start=start_d, end=end_d, days=days)


@router.get("/{date_str}", response_model=CalendarDay)
async def get_day_route(
    date_str: str,
    supabase: Client = Depends(get_supabase),
) -> CalendarDay:
    try:
        target = DateType.fromisoformat(date_str)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"Invalid date: {e}") from e
    user_id = get_user_id(supabase)
    try:
        return calendar_service.get_calendar_day(supabase, user_id, target)
    except Exception as e:
        logger.exception("calendar.day error")
        raise HTTPException(status_code=500, detail=str(e)) from e


__all__ = ["router"]
