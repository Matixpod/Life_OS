"""HTTP surface for the Steps module."""

from __future__ import annotations

import logging
from datetime import date as DateType
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from core.supabase_client import get_supabase
from models.schemas import BurnRateDay, StepLog, StepLogDay, StepLogRequest
from services import steps_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/steps", tags=["steps"])


@router.get("/today", response_model=StepLog | None)
async def today(supabase: Client = Depends(get_supabase)) -> StepLog | None:
    try:
        return steps_service.get_steps_for_date(supabase, DateType.today())
    except Exception as e:  # noqa: BLE001
        logger.exception("steps today error")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/yesterday", response_model=StepLog | None)
async def yesterday(
    supabase: Client = Depends(get_supabase),
) -> StepLog | None:
    try:
        return steps_service.get_steps_for_date(
            supabase, DateType.today() - timedelta(days=1)
        )
    except Exception as e:  # noqa: BLE001
        logger.exception("steps yesterday error")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/week", response_model=list[StepLogDay])
async def week(supabase: Client = Depends(get_supabase)) -> list[StepLogDay]:
    try:
        return steps_service.get_steps_week(supabase)
    except Exception as e:  # noqa: BLE001
        logger.exception("steps week error")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/log", response_model=StepLog)
async def log(
    payload: StepLogRequest, supabase: Client = Depends(get_supabase)
) -> StepLog:
    try:
        return steps_service.upsert_steps(supabase, payload)
    except Exception as e:  # noqa: BLE001
        logger.exception("steps log error")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/burn-rate", response_model=list[BurnRateDay])
async def burn_rate(
    supabase: Client = Depends(get_supabase),
) -> list[BurnRateDay]:
    try:
        return steps_service.get_burn_rate(supabase)
    except Exception as e:  # noqa: BLE001
        logger.exception("steps burn-rate error")
        raise HTTPException(status_code=500, detail=str(e)) from e
