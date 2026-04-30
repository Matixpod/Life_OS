"""Plan-vs-execution scoring per category over a 30-day window."""

from collections import defaultdict
from datetime import date as DateType
from datetime import timedelta

from supabase import Client

from core import config
from core.supabase_client import get_user_id
from models.kronos import DailyPvE, PvEScore, TaskCategory

_LOOKBACK_DAYS = 30


def calculate_pve(
    supabase: Client, today: DateType | None = None
) -> list[PvEScore]:
    """Compute 30-day plan-vs-execution score per category.

    Denominator is *all* tasks scheduled for the day in that category
    (including skipped) — so a day where every task was skipped lands at
    0% execution rather than being filtered out as a missing-data day.
    """
    user_id = get_user_id(supabase)
    today = today or DateType.today()
    since = today - timedelta(days=_LOOKBACK_DAYS)

    res = (
        supabase.table(config.TABLE_DAILY_TASKS)
        .select("category,date,status")
        .eq("user_id", user_id)
        .gte("date", str(since))
        .lte("date", str(today))
        .execute()
    )
    rows = [r for r in (res.data or []) if r.get("category")]

    counts: dict[tuple[TaskCategory, DateType], dict[str, int]] = defaultdict(
        lambda: {"planned": 0, "done": 0}
    )
    for r in rows:
        try:
            cat = TaskCategory(r["category"])
        except ValueError:
            continue
        d = DateType.fromisoformat(r["date"])
        bucket = counts[(cat, d)]
        bucket["planned"] += 1
        if r.get("status") == "done":
            bucket["done"] += 1

    out: list[PvEScore] = []
    for category in TaskCategory:
        days: list[DailyPvE] = []
        for (cat, d), c in counts.items():
            if cat != category:
                continue
            ratio = (
                min(c["done"] / c["planned"], 1.0) if c["planned"] else 0.0
            )
            days.append(
                DailyPvE(
                    date=d,
                    planned=c["planned"],
                    completed=c["done"],
                    ratio=round(ratio, 3),
                )
            )
        days.sort(key=lambda x: x.date)

        if not days:
            out.append(PvEScore(category=category, overall_ratio=0.0))
            continue

        overall = round(sum(d.ratio for d in days) / len(days), 3)
        zero_days = [
            d.date for d in days if d.planned > 0 and d.completed == 0
        ]
        best = max(days, key=lambda x: x.ratio).date
        worst = min(days, key=lambda x: x.ratio).date
        out.append(
            PvEScore(
                category=category,
                overall_ratio=overall,
                daily_breakdown=days,
                zero_execution_days=zero_days,
                best_day=best,
                worst_day=worst,
            )
        )
    return out
