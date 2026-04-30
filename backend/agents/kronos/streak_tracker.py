"""Per-category streak tracking from daily_tasks."""

from datetime import date as DateType
from datetime import timedelta

from supabase import Client

from core import config
from core.supabase_client import get_user_id
from models.kronos import StreakData, TaskCategory, TrendDirection

_LOOKBACK_DAYS = 180
_BREAKS_LOOKBACK_DAYS = 90
_MAX_BREAKS_RETURNED = 5
_TREND_OFFSET_DAYS = 7
# A change of >= this many days between current and 7-days-ago streak
# is needed before we call the trend "up" or "down".
_TREND_DELTA = 2


def _fetch_active_dates(
    supabase: Client, user_id: str, since: DateType
) -> dict[TaskCategory, set[DateType]]:
    """Return {category: {dates with at least one done task}} since the given date."""
    res = (
        supabase.table(config.TABLE_DAILY_TASKS)
        .select("category,date,status")
        .eq("user_id", user_id)
        .eq("status", "done")
        .gte("date", str(since))
        .execute()
    )
    by_cat: dict[TaskCategory, set[DateType]] = {}
    for row in res.data or []:
        cat_str = row.get("category")
        if not cat_str:
            continue
        try:
            cat = TaskCategory(cat_str)
        except ValueError:
            continue
        by_cat.setdefault(cat, set()).add(DateType.fromisoformat(row["date"]))
    return by_cat


def _walk_streak(active: set[DateType], anchor: DateType) -> int:
    """Count consecutive active days walking backward from anchor (inclusive)."""
    n = 0
    d = anchor
    while d in active:
        n += 1
        d -= timedelta(days=1)
    return n


def _current_streak(
    active: set[DateType], today: DateType
) -> tuple[int, DateType | None]:
    # Streak is alive if either today or yesterday had a done task —
    # today might just not be over yet.
    if today in active:
        return _walk_streak(active, today), today
    yesterday = today - timedelta(days=1)
    if yesterday in active:
        return _walk_streak(active, yesterday), yesterday
    return 0, (max(active) if active else None)


def _longest_streak(active: set[DateType]) -> int:
    if not active:
        return 0
    sorted_dates = sorted(active)
    longest = 1
    run = 1
    for i in range(1, len(sorted_dates)):
        if (sorted_dates[i] - sorted_dates[i - 1]).days == 1:
            run += 1
            longest = max(longest, run)
        else:
            run = 1
    return longest


def _find_breaks(active: set[DateType], today: DateType) -> list[DateType]:
    """Days in last 90 where the previous day was active and this day was not.

    Returns most recent first, capped at 5 entries to keep prompt size bounded.
    Today itself is excluded — the day isn't over.
    """
    cutoff = today - timedelta(days=_BREAKS_LOOKBACK_DAYS)
    breaks: list[DateType] = []
    d = today - timedelta(days=1)
    while d >= cutoff:
        if d not in active and (d - timedelta(days=1)) in active:
            breaks.append(d)
            if len(breaks) >= _MAX_BREAKS_RETURNED:
                break
        d -= timedelta(days=1)
    return breaks


def _trend(
    active: set[DateType], today: DateType, current: int
) -> TrendDirection:
    past = today - timedelta(days=_TREND_OFFSET_DAYS)
    past_streak, _ = _current_streak(active, past)
    delta = current - past_streak
    if delta >= _TREND_DELTA:
        return "up"
    if delta <= -_TREND_DELTA:
        return "down"
    return "stable"


def calculate_streaks(
    supabase: Client, today: DateType | None = None
) -> list[StreakData]:
    """Compute StreakData for every TaskCategory based on the last 180 days."""
    user_id = get_user_id(supabase)
    today = today or DateType.today()
    since = today - timedelta(days=_LOOKBACK_DAYS)
    by_cat = _fetch_active_dates(supabase, user_id, since)

    out: list[StreakData] = []
    for category in TaskCategory:
        active = by_cat.get(category, set())
        current, last_active = _current_streak(active, today)
        longest = max(_longest_streak(active), current)
        breaks = _find_breaks(active, today)
        trend = _trend(active, today, current)
        out.append(
            StreakData(
                category=category,
                current_streak=current,
                longest_streak=longest,
                last_active_date=last_active,
                streak_broken_on=breaks,
                trend=trend,
            )
        )
    return out
