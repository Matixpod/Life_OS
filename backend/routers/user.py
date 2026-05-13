import logging

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from core.supabase_client import get_supabase
from models.schemas import (
    StreakInfo,
    UserProfile,
    UserSettings,
    UserSettingsUpdate,
)
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


@router.get("/settings", response_model=UserSettings)
async def settings(supabase: Client = Depends(get_supabase)) -> UserSettings:
    try:
        return user_service.get_settings(supabase)
    except Exception as e:  # noqa: BLE001
        logger.exception("settings get error")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.patch("/settings", response_model=UserSettings)
async def update_settings(
    payload: UserSettingsUpdate,
    supabase: Client = Depends(get_supabase),
) -> UserSettings:
    try:
        return user_service.update_settings(supabase, payload)
    except Exception as e:  # noqa: BLE001
        logger.exception("settings patch error")
        raise HTTPException(status_code=500, detail=str(e)) from e
