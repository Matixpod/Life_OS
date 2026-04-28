import logging

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from core.supabase_client import get_supabase
from models.schemas import SleepLogRequest
from services import sleep_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/sleep", tags=["sleep"])


@router.post("/log")
async def log(
    payload: SleepLogRequest, supabase: Client = Depends(get_supabase)
) -> dict:
    try:
        saved = sleep_service.upsert_sleep(supabase, payload)
        return {"success": True, "data": saved}
    except Exception as e:
        logger.exception("sleep log error")
        raise HTTPException(status_code=500, detail=str(e))
