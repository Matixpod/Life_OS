"""Day-of-week and hour-of-day completion patterns per category."""

from collections import defaultdict
from datetime import date as DateType
from datetime import datetime, timedelta

from supabase import Client

from core import config
from core.supabase_client import get_user_id
from models.kronos import PatternData, TaskCategory

_LOOKBACK_DAYS = 90
_MIN_SAMPLES = 7
_PEAK_THRESHOLD = 0.70
_DEAD_THRESHOLD = 0.30
_DAY_MIN_SAMPLES = 2  # don't classify a DoW as peak/dead with fewer than this many tasks

DAY_NAMES = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
]
TIME_BUCKETS: dict[str, list[int]] = {
    "morning": list(range(5, 12)),
    "afternoon": list(range(12, 18)),
    "evening": list(range(18, 23)),
    "night": [23, 0, 1, 2, 3, 4],
}


def _bucket_for_hour(h: int) -> str:
    for name, hours in TIME_BUCKETS.items():
        if h in hours:
            return name
    return "afternoon"


def _parse_completed_at(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _fetch_tasks(
    supabase: Client, user_id: str, since: DateType
) -> list[dict]:
    res = (
        supabase.table(config.TABLE_DAILY_TASKS)
        .select("category,date,status,completed_at")
        .eq("user_id", user_id)
        .gte("date", str(since))
        .execute()
    )
    return [r for r in (res.data or []) if r.get("category")]


def analyze_patterns(
    supabase: Client, today: DateType | None = None
) -> list[PatternData]:
    """Compute completion-rate patterns per category over the last 90 days.

    `by_day_of_week` is a true rate: done / total per weekday.
    `by_hour_of_day` is the distribution of completion timestamps among done
    tasks (sums to 1.0); pattern detection of "when does this user actually
    finish things" rather than a per-hour ratio (the data has no scheduled
    time-of-day to use as a denominator).
    """
    user_id = get_user_id(supabase)
    today = today or DateType.today()
    since = today - timedelta(days=_LOOKBACK_DAYS)
    rows = _fetch_tasks(supabase, user_id, since)

    per_cat: dict[TaskCategory, list[dict]] = {}
    for row in rows:
        try:
            cat = TaskCategory(row["category"])
        except (ValueError, KeyError):
            continue
        per_cat.setdefault(cat, []).append(row)

    out: list[PatternData] = []
    for category in TaskCategory:
        cat_rows = per_cat.get(category, [])
        n = len(cat_rows)
        if n < _MIN_SAMPLES:
            out.append(
                PatternData(category=category, sample_size=n, insufficient_data=True)
            )
            continue

        dow_total: dict[int, int] = defaultdict(int)
        dow_done: dict[int, int] = defaultdict(int)
        hour_done: dict[int, int] = defaultdict(int)
        dow_bucket_done: dict[tuple[int, str], int] = defaultdict(int)

        for r in cat_rows:
            d = DateType.fromisoformat(r["date"])
            dow = d.weekday()
            dow_total[dow] += 1
            if r.get("status") == "done":
                dow_done[dow] += 1
                ts = _parse_completed_at(r.get("completed_at"))
                if ts is not None:
                    hour = ts.hour
                    hour_done[hour] += 1
                    dow_bucket_done[(dow, _bucket_for_hour(hour))] += 1

        by_day = {
            DAY_NAMES[i]: round(dow_done[i] / dow_total[i], 3)
            for i in range(7)
            if dow_total[i] > 0
        }
        total_done = sum(hour_done.values())
        by_hour = (
            {h: round(c / total_done, 3) for h, c in hour_done.items()}
            if total_done
            else {}
        )

        peak_zones: list[str] = []
        dead_zones: list[str] = []
        for i in range(7):
            if dow_total[i] < _DAY_MIN_SAMPLES:
                continue
            rate = dow_done[i] / dow_total[i]
            if rate >= _PEAK_THRESHOLD:
                best_bucket = None
                best_count = 0
                for (d_idx, bucket), count in dow_bucket_done.items():
                    if d_idx == i and count > best_count:
                        best_bucket = bucket
                        best_count = count
                label = (
                    f"{DAY_NAMES[i]}_{best_bucket}"
                    if best_bucket
                    else f"{DAY_NAMES[i]}_all_day"
                )
                peak_zones.append(label)
            elif rate <= _DEAD_THRESHOLD:
                dead_zones.append(f"{DAY_NAMES[i]}_all_day")

        out.append(
            PatternData(
                category=category,
                by_day_of_week=by_day,
                by_hour_of_day=by_hour,
                peak_zones=peak_zones,
                dead_zones=dead_zones,
                sample_size=n,
                insufficient_data=False,
            )
        )
    return out
