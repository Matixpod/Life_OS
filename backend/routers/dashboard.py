import logging
from datetime import date as DateType
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from supabase import Client

from core.supabase_client import get_supabase
from models.schemas import DailySummary
from services import dashboard_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/daily-summary", response_model=DailySummary)
async def daily_summary(
    date: str | None = Query(default=None),
    supabase: Client = Depends(get_supabase),
) -> DailySummary:
    target = DateType.today() if not date else datetime.strptime(date, "%Y-%m-%d").date()
    try:
        return dashboard_service.get_summary(supabase, target)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("daily-summary error")
        raise HTTPException(status_code=500, detail=str(e))
