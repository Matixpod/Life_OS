"""DB persistence for the PROMETHEUS Cardio module.

Profile is a single row per user; sessions accumulate with kcal & fat splits
computed by `agents.prometheus.cardio_agent` before insert. The fat summary
deliberately combines cardio AND strength sessions so the FatJar reflects the
user's total fat-burn for the period — not just cardio.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from datetime import date as DateType

from supabase import Client

from agents.prometheus import cardio_agent
from core import config
from core.supabase_client import get_user_id
from models.schemas import CardioProfile, CardioSessionCreate

# ─── Profile ─────────────────────────────────────────────────────────────────


def get_profile(supabase: Client) -> dict | None:
    user_id = get_user_id(supabase)
    res = (
        supabase.table(config.TABLE_CARDIO_PROFILES)
        .select("*")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def upsert_profile(supabase: Client, payload: CardioProfile) -> dict:
    user_id = get_user_id(supabase)
    record = {
        **payload.model_dump(),
        "user_id": user_id,
        "updated_at": datetime.now(tz=UTC).isoformat(),
    }
    res = (
        supabase.table(config.TABLE_CARDIO_PROFILES)
        .upsert(record, on_conflict="user_id")
        .execute()
    )
    return res.data[0] if res.data else record


# ─── Sessions ────────────────────────────────────────────────────────────────


async def create_session(
    supabase: Client, payload: CardioSessionCreate
) -> dict:
    user_id = get_user_id(supabase)
    profile_row = get_profile(supabase)
    profile = CardioProfile(**profile_row) if profile_row else None

    analysis = await cardio_agent.analyze_cardio_session(
        payload, profile, supabase
    )

    record = {
        "user_id": user_id,
        "date": str(payload.date),
        "activity_type": payload.activity_type,
        "label": payload.label,
        "duration_min": payload.duration_min,
        "avg_hr": payload.avg_hr,
        "params": payload.params.model_dump(exclude_none=True),
        **analysis,
    }
    res = (
        supabase.table(config.TABLE_CARDIO_SESSIONS).insert(record).execute()
    )
    if not res.data:
        raise RuntimeError("Failed to create cardio session")
    return res.data[0]


def get_sessions(supabase: Client, *, days_back: int = 90) -> list[dict]:
    user_id = get_user_id(supabase)
    since = (DateType.today() - timedelta(days=days_back)).isoformat()
    res = (
        supabase.table(config.TABLE_CARDIO_SESSIONS)
        .select("*")
        .eq("user_id", user_id)
        .gte("date", since)
        .order("date", desc=True)
        .order("created_at", desc=True)
        .execute()
    )
    return res.data or []


def delete_session(supabase: Client, session_id: str) -> bool:
    user_id = get_user_id(supabase)
    res = (
        supabase.table(config.TABLE_CARDIO_SESSIONS)
        .delete()
        .eq("id", session_id)
        .eq("user_id", user_id)
        .execute()
    )
    return bool(res.data)


# ─── Fat summary (cardio + strength combined) ────────────────────────────────


def _sum_fat(supabase: Client, table: str, user_id: str, since: str) -> float:
    res = (
        supabase.table(table)
        .select("fat_grams")
        .eq("user_id", user_id)
        .gte("date", since)
        .execute()
    )
    total = 0.0
    for row in res.data or []:
        try:
            total += float(row.get("fat_grams") or 0)
        except (TypeError, ValueError):
            continue
    return total


def _count_rows(
    supabase: Client, table: str, user_id: str, since: str
) -> int:
    res = (
        supabase.table(table)
        .select("id")
        .eq("user_id", user_id)
        .gte("date", since)
        .execute()
    )
    return len(res.data or [])


def get_fat_summary(supabase: Client) -> dict:
    user_id = get_user_id(supabase)
    today = DateType.today()
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)
    epoch = "2020-01-01"

    today_iso = today.isoformat()
    week_iso = week_start.isoformat()
    month_iso = month_start.isoformat()

    cardio = config.TABLE_CARDIO_SESSIONS
    strength = config.TABLE_PROMETHEUS_SESSIONS

    today_cardio = _sum_fat(supabase, cardio, user_id, today_iso)
    today_strength = _sum_fat(supabase, strength, user_id, today_iso)
    week_cardio = _sum_fat(supabase, cardio, user_id, week_iso)
    week_strength = _sum_fat(supabase, strength, user_id, week_iso)
    month_cardio = _sum_fat(supabase, cardio, user_id, month_iso)
    month_strength = _sum_fat(supabase, strength, user_id, month_iso)
    total_cardio = _sum_fat(supabase, cardio, user_id, epoch)
    total_strength = _sum_fat(supabase, strength, user_id, epoch)
    sessions_this_week = (
        _count_rows(supabase, cardio, user_id, week_iso)
        + _count_rows(supabase, strength, user_id, week_iso)
    )

    return {
        "today_fat_grams": round(today_cardio + today_strength, 2),
        "week_fat_grams": round(week_cardio + week_strength, 2),
        "month_fat_grams": round(month_cardio + month_strength, 2),
        "total_fat_grams": round(total_cardio + total_strength, 2),
        "sessions_this_week": sessions_this_week,
        "week_cardio_grams": round(week_cardio, 2),
        "week_strength_grams": round(week_strength, 2),
    }


__all__ = [
    "create_session",
    "delete_session",
    "get_fat_summary",
    "get_profile",
    "get_sessions",
    "upsert_profile",
]
