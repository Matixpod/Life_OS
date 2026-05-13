from supabase import Client

from core import config
from core.supabase_client import get_user_id
from models.schemas import (
    StreakInfo,
    StreakRange,
    UserProfile,
    UserSettings,
    UserSettingsUpdate,
)


def get_profile(supabase: Client) -> UserProfile:
    res = supabase.table(config.TABLE_USERS).select("*").limit(1).execute()
    if not res.data:
        raise RuntimeError("No user row found.")
    return UserProfile(**res.data[0])


def get_streak(supabase: Client) -> StreakInfo:
    profile = get_profile(supabase)
    user_id = get_user_id(supabase)
    history_rows = (
        supabase.table(config.TABLE_STREAKS)
        .select("*")
        .eq("user_id", user_id)
        .order("start_date", desc=True)
        .limit(20)
        .execute()
    ).data or []
    history = [
        StreakRange(
            start_date=r["start_date"],
            end_date=r.get("end_date"),
            length_days=r.get("length_days") or 0,
        )
        for r in history_rows
    ]
    return StreakInfo(
        current_streak_days=profile.current_streak_days,
        longest_streak_days=profile.longest_streak_days,
        history=history,
    )


def get_settings(supabase: Client) -> UserSettings:
    """Read user-level settings. Single-user system — falls back to default."""
    res = (
        supabase.table(config.TABLE_USERS)
        .select("weekly_step_goal")
        .limit(1)
        .execute()
    )
    if not res.data:
        raise RuntimeError("No user row found.")
    return UserSettings(weekly_step_goal=res.data[0].get("weekly_step_goal") or 70000)


def update_settings(
    supabase: Client, payload: UserSettingsUpdate
) -> UserSettings:
    user_id = get_user_id(supabase)
    res = (
        supabase.table(config.TABLE_USERS)
        .update({"weekly_step_goal": payload.weekly_step_goal})
        .eq("id", user_id)
        .execute()
    )
    if not res.data:
        raise RuntimeError("Failed to update user settings.")
    return UserSettings(weekly_step_goal=res.data[0]["weekly_step_goal"])
