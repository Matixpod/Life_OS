"""Persistence for KRONOS analyses (the analyzers themselves stay in agents/)."""

from datetime import datetime
from typing import Literal

from supabase import Client

from core import config
from core.supabase_client import get_user_id
from models.kronos import TaskCategory


def save_analysis(
    supabase: Client,
    *,
    analysis_text: str,
    triggered_by: str,
    focus_category: TaskCategory | None = None,
    status: Literal["complete", "incomplete"] = "complete",
) -> dict:
    """Insert a KRONOS analysis row and return the persisted record."""
    user_id = get_user_id(supabase)
    record = {
        "user_id": user_id,
        "analysis_text": analysis_text,
        "triggered_by": triggered_by,
        "focus_category": focus_category.value if focus_category else None,
        "status": status,
    }
    res = (
        supabase.table(config.TABLE_KRONOS_ANALYSES)
        .insert(record)
        .execute()
    )
    return res.data[0] if res.data else record


def list_analyses(supabase: Client, limit: int = 20) -> list[dict]:
    user_id = get_user_id(supabase)
    res = (
        supabase.table(config.TABLE_KRONOS_ANALYSES)
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return res.data or []


def latest_analysis_at(supabase: Client) -> datetime | None:
    user_id = get_user_id(supabase)
    res = (
        supabase.table(config.TABLE_KRONOS_ANALYSES)
        .select("created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not res.data:
        return None
    raw = res.data[0]["created_at"]
    return datetime.fromisoformat(raw.replace("Z", "+00:00"))
