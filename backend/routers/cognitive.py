import logging
from datetime import date as DateType

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from supabase import Client

from core.supabase_client import get_supabase
from models.schemas import (
    CognitiveChallenge,
    CognitiveCompleteRequest,
    CognitiveExplainRequest,
)
from services import cognitive_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/cognitive", tags=["cognitive"])


@router.get("/today", response_model=CognitiveChallenge | None)
async def today(
    supabase: Client = Depends(get_supabase),
) -> CognitiveChallenge | None:
    try:
        return cognitive_service.get_today(supabase, DateType.today())
    except Exception as e:
        logger.exception("cognitive today error")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/complete")
async def complete(
    payload: CognitiveCompleteRequest, supabase: Client = Depends(get_supabase)
) -> dict:
    try:
        saved = cognitive_service.complete(supabase, payload)
        return {"success": True, "data": saved}
    except Exception as e:
        logger.exception("cognitive complete error")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/explain")
async def explain(payload: CognitiveExplainRequest) -> StreamingResponse:
    async def event_stream():
        async for chunk in cognitive_service.stream_explanation(
            payload.challenge_title, payload.user_question
        ):
            yield chunk

    return StreamingResponse(event_stream(), media_type="text/plain; charset=utf-8")
