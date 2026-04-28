import logging
from datetime import date as DateType

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from core.supabase_client import get_supabase
from services import intelligence_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/intelligence", tags=["intelligence"])


@router.get("/today")
async def today(supabase: Client = Depends(get_supabase)) -> dict:
    try:
        return intelligence_service.get_or_generate(supabase, DateType.today())
    except Exception as e:
        logger.exception("intelligence today error")
        raise HTTPException(status_code=500, detail=str(e))
