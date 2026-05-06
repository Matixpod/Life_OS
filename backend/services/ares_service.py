"""DB persistence for ARES analyses (scoring lives in agents/ares/vitality_scorer.py)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from supabase import Client

from core import config
from core.supabase_client import get_user_id

AnalysisStatus = Literal["complete", "incomplete"]


def save_analysis(
    supabase: Client,
    *,
    analysis_text: str,
    health_score: float,
    score_delta: float | None,
    analysis_type: str,
    status: AnalysisStatus = "complete",
) -> dict:
    user_id = get_user_id(supabase)
    record = {
        "user_id": user_id,
        "analysis_text": analysis_text,
        "health_score": round(float(health_score), 2),
        "score_delta": (
            round(float(score_delta), 2) if score_delta is not None else None
        ),
        "analysis_type": analysis_type,
        "status": status,
    }
    res = supabase.table(config.TABLE_ARES_ANALYSES).insert(record).execute()
    return res.data[0] if res.data else record


def list_analyses(supabase: Client, limit: int = 20) -> list[dict]:
    user_id = get_user_id(supabase)
    res = (
        supabase.table(config.TABLE_ARES_ANALYSES)
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return res.data or []


def latest_analysis(supabase: Client) -> dict | None:
    user_id = get_user_id(supabase)
    res = (
        supabase.table(config.TABLE_ARES_ANALYSES)
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not res.data:
        return None
    return res.data[0]


def list_scores(supabase: Client, limit: int = 30) -> list[dict]:
    user_id = get_user_id(supabase)
    res = (
        supabase.table(config.TABLE_ARES_SCORES)
        .select("*")
        .eq("user_id", user_id)
        .order("computed_at", desc=True)
        .limit(limit)
        .execute()
    )
    return res.data or []


def parse_iso(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except ValueError:
        return None


__all__ = [
    "latest_analysis",
    "list_analyses",
    "list_scores",
    "parse_iso",
    "save_analysis",
]
