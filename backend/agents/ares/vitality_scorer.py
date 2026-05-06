"""Compute the ARES vitality score from `daily_tasks`.

The mapping from a task title to a sub-category is keyword-based (Polish
keywords). Task title matches multiple sub-categories → assigned to the
first match in priority order: activity > nutrition > sleep > hydration.

Score per sub-category:
    - 100% × (days_active / days_analyzed) is the base
    - "Each missed day in a row": penalised at -5 points per consecutive
      day without an active task at the *end* of the window
    - Floor of 20 when no tasks of that sub-category are detected at all
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from datetime import date as DateType

from supabase import Client

from core import config
from core.supabase_client import get_user_id

from .models import (
    SUBCATEGORY_WEIGHTS,
    AresScoreResult,
    SubcategoryScore,
    ToneMode,
    VitalitySubcategory,
)

# Priority order is the dict iteration order: Python 3.7+ preserves it.
SUBCATEGORY_KEYWORDS: dict[VitalitySubcategory, tuple[str, ...]] = {
    VitalitySubcategory.ACTIVITY: (
        "bieg",
        "siłownia",
        "silownia",
        "trening",
        "sport",
        "rower",
        "pływanie",
        "plywanie",
        "spacer",
        "joga",
        "fitness",
        "kardio",
        "stretching",
    ),
    VitalitySubcategory.NUTRITION: (
        "dieta",
        "posiłek",
        "posilek",
        "makro",
        "białko",
        "bialko",
        "warzywa",
        "gotowanie",
        "kalorie",
        "owoce",
    ),
    VitalitySubcategory.SLEEP: (
        "sen",
        "spanie",
        "odpoczynek",
        "regeneracja",
        "drzemka",
    ),
    VitalitySubcategory.HYDRATION: (
        "woda",
        "nawodnienie",
        "herbata",
        "elektrolity",
    ),
}

DEFAULT_WINDOW_DAYS = 14
EMPTY_FLOOR = 20.0
TRAILING_GAP_PENALTY = 5.0


def detect_subcategory(task_title: str) -> VitalitySubcategory | None:
    """Case-insensitive partial match. Returns the first sub-category hit."""
    if not task_title:
        return None
    lowered = task_title.lower()
    for subcategory, keywords in SUBCATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw in lowered:
                return subcategory
    return None


def compute_subcategory_score(
    completed_tasks: list[dict],
    subcategory: VitalitySubcategory,
    *,
    today: DateType | None = None,
    days: int = DEFAULT_WINDOW_DAYS,
) -> SubcategoryScore:
    """Score for a single sub-category based on completed-task days.

    `completed_tasks` is a list of dicts with at least `title` and `date`
    (string in YYYY-MM-DD form). The caller owns the SQL query.
    """
    today = today or datetime.now(tz=UTC).date()
    window_start = today - timedelta(days=days - 1)

    matched_dates: set[DateType] = set()
    matched_count = 0
    for row in completed_tasks:
        title = row.get("title") or ""
        if detect_subcategory(title) != subcategory:
            continue
        date_raw = row.get("date") or row.get("scheduled_date")
        if not date_raw:
            continue
        try:
            d = DateType.fromisoformat(str(date_raw)[:10])
        except ValueError:
            continue
        if d < window_start or d > today:
            continue
        matched_count += 1
        matched_dates.add(d)

    if matched_count == 0:
        return SubcategoryScore(
            subcategory=subcategory,
            score=EMPTY_FLOOR,
            tasks_detected=0,
            days_active=0,
            days_analyzed=days,
            weight=SUBCATEGORY_WEIGHTS[subcategory],
        )

    days_active = len(matched_dates)
    base = 100.0 * (days_active / days)

    # Trailing-gap penalty: count days from `today` walking back until the
    # first active day, then apply -5 per gap day. Capped at the base score.
    gap = 0
    cursor = today
    while cursor not in matched_dates and cursor >= window_start:
        gap += 1
        cursor -= timedelta(days=1)
    score = max(0.0, base - gap * TRAILING_GAP_PENALTY)

    return SubcategoryScore(
        subcategory=subcategory,
        score=round(score, 2),
        tasks_detected=matched_count,
        days_active=days_active,
        days_analyzed=days,
        weight=SUBCATEGORY_WEIGHTS[subcategory],
    )


def _tone_for(score: float) -> ToneMode:
    if score >= 80.0:
        return ToneMode.PEAK
    if score >= 60.0:
        return ToneMode.GOOD
    if score >= 40.0:
        return ToneMode.NEEDS_WORK
    return ToneMode.CRISIS


def _fetch_completed_tasks(
    supabase: Client,
    user_id: str,
    *,
    today: DateType,
    days: int,
) -> list[dict]:
    window_start = today - timedelta(days=days - 1)
    res = (
        supabase.table(config.TABLE_DAILY_TASKS)
        .select("title, date, status, category")
        .eq("user_id", user_id)
        .eq("status", "done")
        .gte("date", window_start.isoformat())
        .lte("date", today.isoformat())
        .execute()
    )
    return list(res.data or [])


def _previous_health_score(supabase: Client, user_id: str) -> float | None:
    res = (
        supabase.table(config.TABLE_ARES_SCORES)
        .select("health_score, computed_at")
        .eq("user_id", user_id)
        .order("computed_at", desc=True)
        .limit(1)
        .execute()
    )
    if not res.data:
        return None
    raw = res.data[0].get("health_score")
    if raw is None:
        return None
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


def compute_health_score(
    supabase: Client,
    *,
    today: DateType | None = None,
    days: int = DEFAULT_WINDOW_DAYS,
    persist: bool = True,
) -> AresScoreResult:
    """Run all 4 sub-scorers, weight-combine, optionally persist."""
    user_id = get_user_id(supabase)
    today = today or datetime.now(tz=UTC).date()
    completed = _fetch_completed_tasks(
        supabase, user_id, today=today, days=days
    )

    sub_scores = [
        compute_subcategory_score(completed, sub, today=today, days=days)
        for sub in VitalitySubcategory
    ]

    weighted_total = sum(s.score * s.weight for s in sub_scores)
    health_score = round(min(100.0, max(0.0, weighted_total)), 2)
    delta_base = _previous_health_score(supabase, user_id)
    score_delta = (
        round(health_score - delta_base, 2) if delta_base is not None else None
    )

    result = AresScoreResult(
        user_id=user_id,
        health_score=health_score,
        subcategory_scores=sub_scores,
        score_delta=score_delta,
        tone_mode=_tone_for(health_score),
        computed_at=datetime.now(tz=UTC),
    )

    if persist:
        _persist_score(supabase, result)
    return result


def _persist_score(supabase: Client, result: AresScoreResult) -> None:
    """Insert one row into ares_scores. Best-effort — never raises into caller."""
    try:
        sub_map = {s.subcategory: s.score for s in result.subcategory_scores}
        record = {
            "user_id": result.user_id,
            "health_score": result.health_score,
            "activity_score": sub_map.get(VitalitySubcategory.ACTIVITY, 0.0),
            "nutrition_score": sub_map.get(VitalitySubcategory.NUTRITION, 0.0),
            "sleep_score": sub_map.get(VitalitySubcategory.SLEEP, 0.0),
            "hydration_score": sub_map.get(VitalitySubcategory.HYDRATION, 0.0),
            "computed_at": result.computed_at.isoformat(),
        }
        supabase.table(config.TABLE_ARES_SCORES).insert(record).execute()
    except Exception:  # noqa: BLE001 — persistence must not break the request
        import logging

        logging.getLogger(__name__).exception("ares score persistence failed")


def fetch_score_history(
    supabase: Client,
    *,
    today: DateType | None = None,
    days: int = DEFAULT_WINDOW_DAYS,
) -> list[dict]:
    """Returns one entry per day in [today-days+1, today].

    A given day's score is the *latest* row from `ares_scores` whose
    `computed_at::date == day`. Days with no score are returned with
    `score=None` so the line chart can render gaps gracefully.
    """
    user_id = get_user_id(supabase)
    today = today or datetime.now(tz=UTC).date()
    window_start = today - timedelta(days=days - 1)

    res = (
        supabase.table(config.TABLE_ARES_SCORES)
        .select("health_score, computed_at")
        .eq("user_id", user_id)
        .gte("computed_at", window_start.isoformat())
        .order("computed_at", desc=False)
        .execute()
    )

    by_day: dict[DateType, float] = {}
    for row in res.data or []:
        raw = row.get("computed_at")
        if not raw:
            continue
        try:
            dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        except ValueError:
            continue
        d = dt.date()
        score = row.get("health_score")
        try:
            by_day[d] = float(score)
        except (TypeError, ValueError):
            continue

    out: list[dict] = []
    cursor = window_start
    while cursor <= today:
        out.append(
            {
                "date": cursor.isoformat(),
                "score": by_day.get(cursor),
            }
        )
        cursor += timedelta(days=1)
    return out


__all__ = [
    "DEFAULT_WINDOW_DAYS",
    "EMPTY_FLOOR",
    "SUBCATEGORY_KEYWORDS",
    "TRAILING_GAP_PENALTY",
    "compute_health_score",
    "compute_subcategory_score",
    "detect_subcategory",
    "fetch_score_history",
]
