"""Daily System API — morning briefing, stamina ledger, quick boosts.

Mounted at `/api/v1/daily` (consistent with the rest of the codebase —
PROMPT spec says `/api/v1/daily/...`, all other routers use the same
v1 prefix). The router is the only layer that maps service-layer
exceptions onto HTTP status codes.

Single-user system (ADR-003) — no `get_current_user`; the service
resolves the user from the canonical `users` row.
"""

import logging
from datetime import date as DateType

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from core.supabase_client import get_supabase
from models.daily_system_models import (
    BoostAvailability,
    BoostResult,
    BoostType,
    DailyLog,
    DailyLogCreate,
    StaminaStatus,
)
from services import daily_log_service
from services.daily_log_service import BoostMaxReached, BoostOnCooldown

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/daily", tags=["daily"])


# ─── Daily log ───────────────────────────────────────────────────────────────


@router.post("/log", response_model=DailyLog, status_code=201)
async def create_log(
    payload: DailyLogCreate,
    supabase: Client = Depends(get_supabase),
) -> DailyLog:
    try:
        return daily_log_service.create_daily_log(
            supabase, payload.sleep_score, payload.energy_score, payload.notes
        )
    except Exception as e:
        logger.exception("daily.log.create error")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/log", response_model=DailyLog | None)
async def get_today(
    supabase: Client = Depends(get_supabase),
) -> DailyLog | None:
    try:
        return daily_log_service.get_today_log(supabase)
    except Exception as e:
        logger.exception("daily.log.today error")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/log/{date}", response_model=DailyLog | None)
async def get_for_date(
    date: str,
    supabase: Client = Depends(get_supabase),
) -> DailyLog | None:
    try:
        target = DateType.fromisoformat(date)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"Invalid date: {e}")
    try:
        return daily_log_service.get_log_for_date(supabase, target)
    except Exception as e:
        logger.exception("daily.log.byDate error")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Stamina ─────────────────────────────────────────────────────────────────


@router.get("/stamina", response_model=StaminaStatus)
async def get_stamina(
    supabase: Client = Depends(get_supabase),
) -> StaminaStatus:
    try:
        return daily_log_service.get_stamina_status(supabase)
    except Exception as e:
        logger.exception("daily.stamina error")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Boosts ──────────────────────────────────────────────────────────────────


@router.get("/boosts", response_model=list[BoostAvailability])
async def list_boosts(
    supabase: Client = Depends(get_supabase),
) -> list[BoostAvailability]:
    try:
        return daily_log_service.get_boost_availability(supabase)
    except Exception as e:
        logger.exception("daily.boosts.list error")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/boosts/{boost_type}", response_model=BoostResult)
async def use_boost(
    boost_type: BoostType,
    supabase: Client = Depends(get_supabase),
) -> BoostResult:
    try:
        return daily_log_service.use_boost(supabase, boost_type)
    except BoostOnCooldown as e:
        raise HTTPException(
            status_code=429,
            detail={
                "error": "cooldown",
                "boost_type": e.boost_type.value,
                "cooldown_remaining_min": e.remaining_minutes,
            },
        )
    except BoostMaxReached as e:
        raise HTTPException(
            status_code=429,
            detail={
                "error": "max_reached",
                "boost_type": e.boost_type.value,
                "max_per_day": e.max_per_day,
            },
        )
    except Exception as e:
        logger.exception("daily.boosts.use error")
        raise HTTPException(status_code=500, detail=str(e))


# ─── History ─────────────────────────────────────────────────────────────────


@router.get("/history", response_model=list[DailyLog])
async def history(
    supabase: Client = Depends(get_supabase),
) -> list[DailyLog]:
    try:
        return daily_log_service.get_history(supabase, days=14)
    except Exception as e:
        logger.exception("daily.history error")
        raise HTTPException(status_code=500, detail=str(e))
