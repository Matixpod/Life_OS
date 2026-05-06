"""KRONOS API surface — dashboard, analyzers, and the streaming Claude analysis."""

import json
import logging
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from supabase import Client

from agents.kronos import claude_agent, context_builder
from agents.kronos.pattern_analyzer import analyze_patterns
from agents.kronos.pve_scorer import calculate_pve
from agents.kronos.streak_tracker import calculate_streaks
from core.supabase_client import get_supabase
from models.kronos import (
    KronosAnalysis,
    KronosAnalysisRequest,
    KronosContext,
    KronosDashboard,
    PatternData,
    PvEScore,
    StreakData,
)
from services import kronos_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/kronos", tags=["kronos"])


# ─── Read endpoints ───────────────────────────────────────────────────────────


@router.get("/streaks", response_model=list[StreakData])
async def get_streaks(
    supabase: Client = Depends(get_supabase),
) -> list[StreakData]:
    try:
        return calculate_streaks(supabase)
    except Exception as e:
        logger.exception("kronos streaks error")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/patterns", response_model=list[PatternData])
async def get_patterns(
    supabase: Client = Depends(get_supabase),
) -> list[PatternData]:
    try:
        return analyze_patterns(supabase)
    except Exception as e:
        logger.exception("kronos patterns error")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/pve", response_model=list[PvEScore])
async def get_pve(
    supabase: Client = Depends(get_supabase),
) -> list[PvEScore]:
    try:
        return calculate_pve(supabase)
    except Exception as e:
        logger.exception("kronos pve error")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/context", response_model=KronosContext)
async def get_context(
    supabase: Client = Depends(get_supabase),
) -> KronosContext:
    """Cross-agent context endpoint — used by other Life OS agents."""
    try:
        return context_builder.build_context(supabase)
    except Exception as e:
        logger.exception("kronos context error")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard", response_model=KronosDashboard)
async def get_dashboard(
    supabase: Client = Depends(get_supabase),
) -> KronosDashboard:
    try:
        ctx = context_builder.build_context(supabase)
        last = kronos_service.latest_analysis_at(supabase)
        return KronosDashboard(
            global_consistency_score=ctx.global_consistency_score,
            streaks=ctx.streaks,
            patterns=ctx.patterns,
            pve_scores=ctx.pve_scores,
            last_analysis_at=last,
            alerts=ctx.alerts,
        )
    except Exception as e:
        logger.exception("kronos dashboard error")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analysis/history", response_model=list[KronosAnalysis])
async def get_analysis_history(
    limit: int = Query(default=20, ge=1, le=100),
    supabase: Client = Depends(get_supabase),
) -> list[KronosAnalysis]:
    try:
        rows = kronos_service.list_analyses(supabase, limit=limit)
        return [KronosAnalysis(**r) for r in rows]
    except Exception as e:
        logger.exception("kronos analyses history error")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Streaming analysis ───────────────────────────────────────────────────────


def _sse(data: dict) -> bytes:
    return f"data: {json.dumps(data)}\n\n".encode()


def _has_any_data(ctx: KronosContext) -> bool:
    return any(s.last_active_date for s in ctx.streaks) or any(
        p.daily_breakdown for p in ctx.pve_scores
    )


@router.post("/analysis")
async def post_analysis(
    payload: KronosAnalysisRequest,
    supabase: Client = Depends(get_supabase),
) -> StreamingResponse:
    try:
        ctx = context_builder.build_context(supabase)
    except Exception as e:
        logger.exception("kronos context build error")
        raise HTTPException(status_code=500, detail=str(e))

    if not _has_any_data(ctx):
        raise HTTPException(
            status_code=400,
            detail=(
                "No tasks logged yet — add some daily tasks before "
                "requesting an analysis."
            ),
        )

    async def event_stream() -> AsyncIterator[bytes]:
        chunks: list[str] = []
        status: str = "complete"
        try:
            async for chunk in claude_agent.stream_analysis(
                ctx,
                analysis_type=payload.analysis_type,
                focus_category=payload.focus_category,
                supabase=supabase,
            ):
                chunks.append(chunk)
                yield _sse({"chunk": chunk})
        except Exception as e:
            status = "incomplete"
            logger.exception("kronos analysis stream error")
            yield _sse({"error": str(e)})
        finally:
            full_text = "".join(chunks)
            saved = kronos_service.save_analysis(
                supabase,
                analysis_text=full_text,
                triggered_by=payload.analysis_type,
                focus_category=payload.focus_category,
                status=status,  # type: ignore[arg-type]
            )
            yield _sse(
                {
                    "done": True,
                    "analysis_id": saved.get("id"),
                    "status": status,
                }
            )

    return StreamingResponse(event_stream(), media_type="text/event-stream")
