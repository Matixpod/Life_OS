import logging

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from core.supabase_client import get_supabase
from models.schemas import WorkoutLogRequest
from services import workout_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/workout", tags=["workout"])


@router.post("/log")
async def log(
    payload: WorkoutLogRequest, supabase: Client = Depends(get_supabase)
) -> dict:
    try:
        saved = workout_service.insert_workout(supabase, payload)
        return {"success": True, "data": saved}
    except Exception as e:
        logger.exception("workout log error")
        raise HTTPException(status_code=500, detail=str(e))
