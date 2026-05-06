"""Aggregate ARES + KRONOS context for the AI provider prompt."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from datetime import date as DateType

from supabase import Client

from agents.kronos.context_builder import build_context as build_kronos_context

from .models import AresContext, AresScoreResult
from .vitality_scorer import compute_health_score

logger = logging.getLogger(__name__)


def build_ares_context(
    supabase: Client,
    *,
    today: DateType | None = None,
    persist_score: bool = True,
) -> AresContext:
    """Run vitality scorer and KRONOS context builder; assemble AresContext.

    KRONOS failures are non-fatal — ARES still produces an analysis with the
    score data and a "brak danych KRONOS" hint in the prompt string.
    """
    score: AresScoreResult = compute_health_score(
        supabase, today=today, persist=persist_score
    )

    kronos_ctx = None
    try:
        kronos_ctx = build_kronos_context(supabase, today=today)
    except Exception:  # noqa: BLE001 — KRONOS is enriching context only
        logger.exception("ARES: KRONOS context unavailable, continuing without it")

    return AresContext(
        user_id=score.user_id,
        generated_at=datetime.now(tz=UTC),
        score=score,
        kronos_context=kronos_ctx,
    )


__all__ = ["build_ares_context"]
