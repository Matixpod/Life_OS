import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from supabase import Client

from core.supabase_client import get_supabase
from models.schemas import ReviewGenerateRequest
from services import review_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/review", tags=["review"])


@router.post("/generate")
async def generate(
    payload: ReviewGenerateRequest | None = None,
    type: Literal["weekly", "monthly"] = Query(default="weekly"),
    supabase: Client = Depends(get_supabase),
) -> dict:
    review_type = (payload.type if payload else None) or type
    try:
        return review_service.generate(supabase, review_type)
    except Exception as e:
        logger.exception("review generate error")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/list")
async def list_reviews(
    type: Literal["weekly", "monthly"] | None = Query(default=None),
    supabase: Client = Depends(get_supabase),
) -> list[dict]:
    try:
        return review_service.list_reviews(supabase, type)
    except Exception as e:
        logger.exception("review list error")
        raise HTTPException(status_code=500, detail=str(e))
