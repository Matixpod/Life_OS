"""Aggregates streak/pattern/PvE data into a single KronosContext."""

from datetime import UTC, datetime
from datetime import date as DateType

from supabase import Client

from core import config
from core.supabase_client import get_fresh_supabase, get_user_id
from models.kronos import (
    KronosAlert,
    KronosContext,
    PatternData,
    PvEScore,
    StreakData,
    TaskCategory,
)

from .pattern_analyzer import analyze_patterns
from .pve_scorer import calculate_pve
from .streak_tracker import calculate_streaks

_MIN_CATEGORIES_FOR_GLOBAL = 3
_RECENT_ZERO_WINDOW_DAYS = 7
_RECENT_ZERO_THRESHOLD = 3


def _global_score(pves: list[PvEScore]) -> float | None:
    """Mean of per-category ratios, scaled to 0–100.

    Returns None when fewer than 3 categories have data — the score is too
    noisy with less than that to be worth reporting.
    """
    rated = [p for p in pves if p.daily_breakdown]
    if len(rated) < _MIN_CATEGORIES_FOR_GLOBAL:
        return None
    avg = sum(p.overall_ratio for p in rated) / len(rated)
    return round(avg * 100, 1)


def _categories_with_task_today(
    supabase: Client, user_id: str, today: DateType
) -> set[TaskCategory]:
    res = (
        supabase.table(config.TABLE_DAILY_TASKS)
        .select("category")
        .eq("user_id", user_id)
        .eq("date", str(today))
        .execute()
    )
    out: set[TaskCategory] = set()
    for r in res.data or []:
        cat = r.get("category")
        if not cat:
            continue
        try:
            out.add(TaskCategory(cat))
        except ValueError:
            pass
    return out


def _build_alerts(
    streaks: list[StreakData],
    patterns: list[PatternData],
    pves: list[PvEScore],
    today: DateType,
    today_categories: set[TaskCategory],
) -> list[KronosAlert]:
    alerts: list[KronosAlert] = []

    for p in patterns:
        if p.insufficient_data:
            continue
        for zone in p.dead_zones:
            alerts.append(
                KronosAlert(
                    type="dead_zone",
                    category=p.category,
                    message=(
                        f"{zone.replace('_', ' ')}: completion rate "
                        "below 30% over the last 90 days"
                    ),
                )
            )

    for s in streaks:
        if s.current_streak > 0 and s.category not in today_categories:
            alerts.append(
                KronosAlert(
                    type="streak_at_risk",
                    category=s.category,
                    message=(
                        f"{s.category.value} streak ({s.current_streak}d) "
                        "breaks tomorrow if no task added"
                    ),
                )
            )

    for p in pves:
        recent = [
            d
            for d in p.zero_execution_days
            if (today - d).days <= _RECENT_ZERO_WINDOW_DAYS
        ]
        if len(recent) >= _RECENT_ZERO_THRESHOLD:
            alerts.append(
                KronosAlert(
                    type="zero_execution",
                    category=p.category,
                    message=(
                        f"{p.category.value}: {len(recent)} zero-execution "
                        f"days in the last {_RECENT_ZERO_WINDOW_DAYS}"
                    ),
                )
            )

    return alerts


def build_context(
    supabase: Client, today: DateType | None = None
) -> KronosContext:
    """Run all three analyzers and assemble a KronosContext for this user."""
    user_id = get_user_id(supabase)
    today = today or DateType.today()

    streaks = calculate_streaks(supabase, today=today)
    patterns = analyze_patterns(supabase, today=today)
    pves = calculate_pve(supabase, today=today)
    today_categories = _categories_with_task_today(supabase, user_id, today)

    return KronosContext(
        user_id=user_id,
        generated_at=datetime.now(tz=UTC),
        streaks=streaks,
        patterns=patterns,
        pve_scores=pves,
        global_consistency_score=_global_score(pves),
        alerts=_build_alerts(streaks, patterns, pves, today, today_categories),
    )


def refresh_streaks(category: str | None = None) -> None:
    """Recompute streaks and upsert them into the `kronos_streaks` cache.

    Called as a fire-and-forget BackgroundTask after every task complete/skip
    (Phase 5 of the Task System). Keeps the `kronos_streaks` table in sync
    with what `calculate_streaks` would compute on the fly, so downstream
    consumers (KRONOS dashboard widgets, other agents) can read the cache
    without re-running the full lookback query.

    `category` filters the upsert to a single row when given — useful when
    only one task changed. With None, all 6 categories are refreshed.
    Errors are logged and swallowed because this runs in the background and
    must never break the originating request.

    Uses a fresh Supabase client (not the request singleton). FastAPI runs
    sync background tasks in a threadpool, and the singleton's HTTP/2
    connection is not safe to share with the request that just spawned it.
    """
    try:
        supabase = get_fresh_supabase()
        user_id = get_user_id(supabase)
        streaks = calculate_streaks(supabase)
        if category is not None:
            streaks = [s for s in streaks if s.category.value == category]
        if not streaks:
            return

        now_iso = datetime.now(tz=UTC).isoformat()
        rows = [
            {
                "user_id": user_id,
                "category": s.category.value,
                "current_streak": s.current_streak,
                "longest_streak": s.longest_streak,
                "last_active_date": (
                    s.last_active_date.isoformat() if s.last_active_date else None
                ),
                "updated_at": now_iso,
            }
            for s in streaks
        ]
        (
            supabase.table(config.TABLE_KRONOS_STREAKS)
            .upsert(rows, on_conflict="user_id,category")
            .execute()
        )
    except Exception:
        # Background task: never raise into the FastAPI loop.
        import logging

        logging.getLogger(__name__).exception("refresh_streaks failed")
