import logging

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from core.supabase_client import get_supabase
from models.schemas import StreakInfo, UserProfile
from services import user_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/user", tags=["user"])


@router.get("/profile", response_model=UserProfile)
async def profile(supabase: Client = Depends(get_supabase)) -> UserProfile:
    try:
        return user_service.get_profile(supabase)
    except Exception as e:
        logger.exception("profile error")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/streak", response_model=StreakInfo)
async def streak(supabase: Client = Depends(get_supabase)) -> StreakInfo:
    try:
        return user_service.get_streak(supabase)
    except Exception as e:
        logger.exception("streak error")
        raise HTTPException(status_code=500, detail=str(e))
