"""ARES API surface — vitality score, dashboard, and streaming AI analysis."""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from datetime import date as DateType
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from supabase import Client

from agents.ares import ares_agent, context_builder
from agents.ares.models import (
    AresAnalysis,
    AresAnalysisRequest,
    AresContextResponse,
    AresDashboard,
    AresScoreHistoryPoint,
    AresScoreResult,
    VitalitySubcategory,
)
from agents.ares.vitality_scorer import compute_health_score, fetch_score_history
from agents.shared.proposal_tool import propose_task
from core.supabase_client import get_supabase, get_user_id
from models.kronos import TaskCategory
from models.task_models import TaskPriority
from services import ares_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ares", tags=["ares"])


def _row_to_analysis(row: dict) -> AresAnalysis:
    created = ares_service.parse_iso(row.get("created_at"))
    return AresAnalysis(
        id=row["id"],
        analysis_text=row.get("analysis_text") or "",
        health_score=float(row.get("health_score") or 0.0),
        score_delta=(
            float(row["score_delta"]) if row.get("score_delta") is not None else None
        ),
        analysis_type=row.get("analysis_type") or "weekly",
        status=row.get("status") or "complete",
        created_at=created or _now_utc(),
    )


def _now_utc():
    from datetime import UTC, datetime

    return datetime.now(tz=UTC)


# ─── Read endpoints ───────────────────────────────────────────────────────


@router.get("/score", response_model=AresScoreResult)
async def get_score(
    supabase: Client = Depends(get_supabase),
) -> AresScoreResult:
    try:
        return compute_health_score(supabase, persist=False)
    except Exception as e:
        logger.exception("ares.score error")
        raise HTTPException(status_code=500, detail=str(e)) from e


class ScoreHistoryResponse(BaseModel):
    history: list[AresScoreHistoryPoint]


@router.get("/score/history", response_model=ScoreHistoryResponse)
async def get_score_history(
    days: int = Query(default=30, ge=1, le=180),
    supabase: Client = Depends(get_supabase),
) -> ScoreHistoryResponse:
    try:
        rows = fetch_score_history(supabase, days=days)
    except Exception as e:
        logger.exception("ares.score.history error")
        raise HTTPException(status_code=500, detail=str(e)) from e
    return ScoreHistoryResponse(
        history=[AresScoreHistoryPoint(**r) for r in rows]
    )


@router.get("/context", response_model=AresContextResponse)
async def get_context(
    supabase: Client = Depends(get_supabase),
) -> AresContextResponse:
    try:
        ctx = context_builder.build_ares_context(supabase, persist_score=False)
    except Exception as e:
        logger.exception("ares.context error")
        raise HTTPException(status_code=500, detail=str(e)) from e
    return AresContextResponse(
        user_id=ctx.user_id,
        generated_at=ctx.generated_at,
        score=ctx.score,
        kronos_available=ctx.kronos_context is not None,
        prompt_text=ctx.to_prompt_string(),
    )


@router.get("/dashboard", response_model=AresDashboard)
async def get_dashboard(
    supabase: Client = Depends(get_supabase),
) -> AresDashboard:
    try:
        score = compute_health_score(supabase, persist=False)
        history_rows = fetch_score_history(supabase, days=14)
        last_row = ares_service.latest_analysis(supabase)
    except Exception as e:
        logger.exception("ares.dashboard error")
        raise HTTPException(status_code=500, detail=str(e)) from e

    last_analysis = _row_to_analysis(last_row) if last_row else None
    return AresDashboard(
        current_score=score,
        score_history=[AresScoreHistoryPoint(**r) for r in history_rows],
        last_analysis=last_analysis,
        last_analysis_at=last_analysis.created_at if last_analysis else None,
    )


@router.get("/analysis/history", response_model=list[AresAnalysis])
async def get_analysis_history(
    limit: int = Query(default=20, ge=1, le=100),
    supabase: Client = Depends(get_supabase),
) -> list[AresAnalysis]:
    try:
        rows = ares_service.list_analyses(supabase, limit=limit)
    except Exception as e:
        logger.exception("ares.analysis.history error")
        raise HTTPException(status_code=500, detail=str(e)) from e
    return [_row_to_analysis(r) for r in rows]


# ─── Streaming analysis ──────────────────────────────────────────────────


def _sse(data: dict) -> bytes:
    return f"data: {json.dumps(data)}\n\n".encode()


@router.post("/analysis")
async def post_analysis(
    payload: AresAnalysisRequest,
    supabase: Client = Depends(get_supabase),
) -> StreamingResponse:
    try:
        ctx = context_builder.build_ares_context(supabase, persist_score=True)
    except Exception as e:
        logger.exception("ares.context.build error")
        raise HTTPException(status_code=500, detail=str(e)) from e

    health_score = ctx.score.health_score
    score_delta = ctx.score.score_delta
    analysis_type = payload.analysis_type

    async def event_stream() -> AsyncIterator[bytes]:
        chunks: list[str] = []
        status: str = "complete"
        # Send initial score badge so the UI can render the gauge before tokens arrive.
        yield _sse(
            {
                "score": health_score,
                "tone": ctx.score.tone_mode.value,
                "delta": score_delta,
            }
        )
        try:
            async for chunk in ares_agent.stream_analysis(
                ctx,
                analysis_type=analysis_type,
                supabase=supabase,
            ):
                chunks.append(chunk)
                yield _sse({"chunk": chunk})
        except Exception as e:
            status = "incomplete"
            logger.exception("ares.analysis.stream error")
            yield _sse({"error": str(e)})
        finally:
            full_text = "".join(chunks)
            saved: dict = {}
            try:
                saved = ares_service.save_analysis(
                    supabase,
                    analysis_text=full_text,
                    health_score=health_score,
                    score_delta=score_delta,
                    analysis_type=analysis_type,
                    status=status,  # type: ignore[arg-type]
                )
            except Exception:
                logger.exception("ares.analysis.save error")

            # If the analysis flagged a clearly weak sub-category, drop a
            # one-click proposal in the Calendar so the user can act on it.
            try:
                if status == "complete":
                    _maybe_propose_followup(supabase, ctx)
            except Exception:
                logger.exception("ares.analysis.propose error")

            yield _sse(
                {
                    "done": True,
                    "analysis_id": saved.get("id"),
                    "status": status,
                }
            )

    return StreamingResponse(event_stream(), media_type="text/event-stream")


_SUBCATEGORY_PROPOSAL: dict[VitalitySubcategory, tuple[str, TaskPriority]] = {
    VitalitySubcategory.ACTIVITY: (
        "Trening — uzupełnienie tygodnia",
        TaskPriority.HIGH,
    ),
    VitalitySubcategory.NUTRITION: (
        "Posiłek z białkiem i warzywami",
        TaskPriority.MEDIUM,
    ),
    VitalitySubcategory.SLEEP: (
        "Sen 8h — kładziesz się o stałej porze",
        TaskPriority.HIGH,
    ),
    VitalitySubcategory.HYDRATION: (
        "Woda 2L w ciągu dnia",
        TaskPriority.MEDIUM,
    ),
}


def _maybe_propose_followup(supabase: Client, ctx) -> None:  # noqa: ANN001 — AresContext (avoid forward import noise)
    """Heuristic proposal trigger: weakest sub-category with 0 tasks logged."""
    score = ctx.score
    candidates = [
        s for s in score.subcategory_scores if s.tasks_detected == 0
    ]
    if not candidates:
        return
    weakest = min(candidates, key=lambda s: s.score)
    title, priority = _SUBCATEGORY_PROPOSAL[weakest.subcategory]
    user_id = get_user_id(supabase)
    propose_task(
        supabase,
        agent_id="ares",
        user_id=user_id,
        title=title,
        category=TaskCategory.VITALITY,
        target_date=DateType.today() + timedelta(days=1),
        reason=(
            f"{weakest.subcategory.value}: 0 zadań w ostatnich "
            f"{weakest.days_analyzed} dniach (health score {score.health_score:.0f}/100)."
        ),
        priority=priority,
    )


__all__ = ["router"]
