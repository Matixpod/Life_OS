import logging

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from core.supabase_client import get_supabase
from models.schemas import MentalHealthLogRequest
from services import mental_health_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/mental-health", tags=["mental-health"])


@router.post("/log")
async def log(
    payload: MentalHealthLogRequest, supabase: Client = Depends(get_supabase)
) -> dict:
    try:
        saved = mental_health_service.upsert_mental_health(supabase, payload)
        return {"success": True, "data": saved}
    except Exception as e:
        logger.exception("mental-health log error")
        raise HTTPException(status_code=500, detail=str(e))
