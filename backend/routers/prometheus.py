"""PROMETHEUS — gym module API surface."""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from datetime import date as DateType

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import StreamingResponse
from supabase import Client

from agents.prometheus import agent as prometheus_agent
from core.supabase_client import get_supabase
from models.schemas import (
    CardioProfile,
    CardioSessionCreate,
    CardioSessionResult,
    ExerciseCreate,
    FatSummary,
    LastSetsResponse,
    ParseExerciseRequest,
    ParseExerciseResponse,
    PrometheusChatRequest,
    SessionCreate,
    SessionUpdate,
)
from services import cardio_service, prometheus_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/prometheus", tags=["prometheus"])


def _sse(data: dict) -> bytes:
    return f"data: {json.dumps(data)}\n\n".encode()


# ─── Exercise library ─────────────────────────────────────────────────────────


@router.get("/exercises")
async def list_exercises(
    search: str | None = Query(default=None),
    supabase: Client = Depends(get_supabase),
) -> list[dict]:
    try:
        return prometheus_service.get_exercise_library(supabase, search=search)
    except Exception as e:
        logger.exception("prometheus.exercises.list error")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/exercises")
async def create_exercise(
    payload: ExerciseCreate,
    supabase: Client = Depends(get_supabase),
) -> dict:
    try:
        return prometheus_service.upsert_exercise(supabase, payload)
    except Exception as e:
        logger.exception("prometheus.exercises.upsert error")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/exercises/{exercise_id}", status_code=204)
async def delete_exercise(
    exercise_id: str,
    supabase: Client = Depends(get_supabase),
) -> Response:
    try:
        deleted = prometheus_service.delete_exercise(supabase, exercise_id)
    except Exception as e:
        logger.exception("prometheus.exercises.delete error")
        raise HTTPException(status_code=500, detail=str(e)) from e
    if not deleted:
        raise HTTPException(status_code=404, detail="Exercise not found")
    return Response(status_code=204)


@router.get(
    "/exercises/{exercise_id}/last-sets",
    response_model=LastSetsResponse,
)
async def get_last_sets(
    exercise_id: str,
    supabase: Client = Depends(get_supabase),
) -> LastSetsResponse:
    try:
        sets = prometheus_service.get_last_sets_for_exercise(
            supabase, exercise_id
        )
    except Exception as e:
        logger.exception("prometheus.exercises.last_sets error")
        raise HTTPException(status_code=500, detail=str(e)) from e
    return LastSetsResponse(sets=sets)


@router.post("/exercises/parse", response_model=ParseExerciseResponse)
async def parse_exercise(
    payload: ParseExerciseRequest,
    supabase: Client = Depends(get_supabase),
) -> ParseExerciseResponse:
    text = (payload.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")
    try:
        return await prometheus_agent.parse_exercise(text, supabase)
    except Exception as e:
        logger.exception("prometheus.exercises.parse error")
        raise HTTPException(status_code=502, detail=str(e)) from e


# ─── Sessions ─────────────────────────────────────────────────────────────────


@router.post("/sessions", status_code=201)
async def create_session(
    payload: SessionCreate,
    supabase: Client = Depends(get_supabase),
) -> dict:
    try:
        return await prometheus_service.create_session(supabase, payload)
    except Exception as e:
        logger.exception("prometheus.sessions.create error")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/sessions")
async def list_sessions(
    days_back: int = Query(default=30, ge=1, le=365),
    supabase: Client = Depends(get_supabase),
) -> list[dict]:
    try:
        return prometheus_service.get_sessions(supabase, days_back=days_back)
    except Exception as e:
        logger.exception("prometheus.sessions.list error")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/sessions/{session_id}")
async def get_session(
    session_id: str,
    supabase: Client = Depends(get_supabase),
) -> dict:
    try:
        session = prometheus_service.get_session_with_exercises(
            supabase, session_id
        )
    except Exception as e:
        logger.exception("prometheus.sessions.get error")
        raise HTTPException(status_code=500, detail=str(e)) from e
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.delete("/sessions/{session_id}", status_code=204)
async def delete_session(
    session_id: str,
    supabase: Client = Depends(get_supabase),
) -> Response:
    try:
        deleted = prometheus_service.delete_session(supabase, session_id)
    except Exception as e:
        logger.exception("prometheus.sessions.delete error")
        raise HTTPException(status_code=500, detail=str(e)) from e
    if not deleted:
        raise HTTPException(status_code=404, detail="Session not found")
    return Response(status_code=204)


@router.patch("/sessions/{session_id}")
async def patch_session(
    session_id: str,
    payload: SessionUpdate,
    supabase: Client = Depends(get_supabase),
) -> dict:
    try:
        updated = prometheus_service.update_session(
            supabase, session_id, payload
        )
    except Exception as e:
        logger.exception("prometheus.sessions.update error")
        raise HTTPException(status_code=500, detail=str(e)) from e
    if not updated:
        raise HTTPException(status_code=404, detail="Session not found")
    return updated


# ─── Recovery ─────────────────────────────────────────────────────────────────


@router.get("/recovery")
async def get_recovery(
    supabase: Client = Depends(get_supabase),
) -> dict[str, float]:
    try:
        return prometheus_service.get_muscle_recovery_map(supabase)
    except Exception as e:
        logger.exception("prometheus.recovery error")
        raise HTTPException(status_code=500, detail=str(e)) from e


# ─── Chat (SSE) ───────────────────────────────────────────────────────────────


@router.post("/chat")
async def chat(
    payload: PrometheusChatRequest,
    supabase: Client = Depends(get_supabase),
) -> StreamingResponse:
    if not payload.messages:
        raise HTTPException(status_code=400, detail="messages required")

    try:
        history = prometheus_service.get_sessions(supabase, days_back=14)
    except Exception as e:
        logger.exception("prometheus.chat.history error")
        raise HTTPException(status_code=500, detail=str(e)) from e

    serialised = [m.model_dump() for m in payload.messages]

    async def event_stream() -> AsyncIterator[bytes]:
        try:
            async for chunk in prometheus_agent.chat_stream(
                serialised, history, supabase
            ):
                yield _sse({"chunk": chunk})
        except Exception as e:
            logger.exception("prometheus.chat.stream error")
            yield _sse({"error": str(e)})
        finally:
            yield _sse({"done": True})

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ─── Weekly report ────────────────────────────────────────────────────────────


@router.get("/report")
async def get_report(
    week_start: DateType = Query(...),
    supabase: Client = Depends(get_supabase),
) -> dict | None:
    try:
        row = prometheus_service.get_latest_weekly_report(supabase, week_start)
    except Exception as e:
        logger.exception("prometheus.report.get error")
        raise HTTPException(status_code=500, detail=str(e)) from e
    if not row:
        return None
    payload = row.get("report_json") or {}
    return {**payload, "week_start": row.get("week_start")}


@router.post("/report/generate")
async def generate_report(
    week_start: DateType = Query(...),
    supabase: Client = Depends(get_supabase),
) -> StreamingResponse:
    try:
        sessions = prometheus_service.get_sessions(supabase, days_back=7)
    except Exception as e:
        logger.exception("prometheus.report.history error")
        raise HTTPException(status_code=500, detail=str(e)) from e

    async def event_stream() -> AsyncIterator[bytes]:
        chunks: list[str] = []
        try:
            async for chunk in prometheus_agent.generate_weekly_report(
                sessions, supabase
            ):
                chunks.append(chunk)
                yield _sse({"chunk": chunk})
        except Exception as e:
            logger.exception("prometheus.report.stream error")
            yield _sse({"error": str(e)})
            return

        report = prometheus_agent.parse_report_json("".join(chunks))
        try:
            prometheus_service.save_weekly_report(
                supabase, week_start, report
            )
        except Exception:
            logger.exception("prometheus.report.save error")
        yield _sse({"done": True, "report": report, "week_start": str(week_start)})

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ─── Cardio ───────────────────────────────────────────────────────────────────


@router.get("/cardio/profile", response_model=CardioProfile | None)
async def get_cardio_profile(
    supabase: Client = Depends(get_supabase),
) -> CardioProfile | None:
    try:
        row = cardio_service.get_profile(supabase)
    except Exception as e:
        logger.exception("prometheus.cardio.profile.get error")
        raise HTTPException(status_code=500, detail=str(e)) from e
    if not row:
        raise HTTPException(status_code=404, detail="Profile not set")
    return CardioProfile(**row)


@router.put("/cardio/profile", response_model=CardioProfile)
async def upsert_cardio_profile(
    payload: CardioProfile,
    supabase: Client = Depends(get_supabase),
) -> CardioProfile:
    try:
        row = cardio_service.upsert_profile(supabase, payload)
    except Exception as e:
        logger.exception("prometheus.cardio.profile.upsert error")
        raise HTTPException(status_code=500, detail=str(e)) from e
    return CardioProfile(**row)


@router.post(
    "/cardio/sessions", status_code=201, response_model=CardioSessionResult
)
async def create_cardio_session(
    payload: CardioSessionCreate,
    supabase: Client = Depends(get_supabase),
) -> CardioSessionResult:
    if payload.activity_type not in {
        "treadmill", "running", "bike", "elliptical",
        "swimming", "rowing", "hiit", "other",
    }:
        raise HTTPException(status_code=400, detail="Unknown activity_type")
    try:
        row = await cardio_service.create_session(supabase, payload)
    except Exception as e:
        logger.exception("prometheus.cardio.sessions.create error")
        raise HTTPException(status_code=500, detail=str(e)) from e
    return CardioSessionResult(**row)


@router.get("/cardio/sessions", response_model=list[CardioSessionResult])
async def list_cardio_sessions(
    days_back: int = Query(default=90, ge=1, le=365),
    supabase: Client = Depends(get_supabase),
) -> list[CardioSessionResult]:
    try:
        rows = cardio_service.get_sessions(supabase, days_back=days_back)
    except Exception as e:
        logger.exception("prometheus.cardio.sessions.list error")
        raise HTTPException(status_code=500, detail=str(e)) from e
    return [CardioSessionResult(**r) for r in rows]


@router.delete("/cardio/sessions/{session_id}", status_code=204)
async def delete_cardio_session(
    session_id: str,
    supabase: Client = Depends(get_supabase),
) -> Response:
    try:
        deleted = cardio_service.delete_session(supabase, session_id)
    except Exception as e:
        logger.exception("prometheus.cardio.sessions.delete error")
        raise HTTPException(status_code=500, detail=str(e)) from e
    if not deleted:
        raise HTTPException(status_code=404, detail="Cardio session not found")
    return Response(status_code=204)


@router.get("/cardio/summary", response_model=FatSummary)
async def get_cardio_summary(
    supabase: Client = Depends(get_supabase),
) -> FatSummary:
    try:
        return FatSummary(**cardio_service.get_fat_summary(supabase))
    except Exception as e:
        logger.exception("prometheus.cardio.summary error")
        raise HTTPException(status_code=500, detail=str(e)) from e


__all__ = ["router"]
