"""DB persistence for the Steps module.

`step_logs` is a unique-per-(user_id, date) ledger; the service exposes
upsert/read helpers plus two aggregators:

* `get_steps_week` — the current ISO week (Mon→Sun), always 7 entries
  with `None` for days that have no row yet.
* `get_burn_rate` — the trailing 7 calendar days from today, with
  per-day kcal summed across all cardio sessions. Uses the persisted
  `kcal_total` when available and the MET fallback otherwise.
"""

from __future__ import annotations

from datetime import date as DateType
from datetime import timedelta

from supabase import Client

from core import config
from core.supabase_client import get_user_id
from models.schemas import (
    BurnRateDay,
    StepLog,
    StepLogDay,
    StepLogRequest,
)

# ─── MET fallback ────────────────────────────────────────────────────────────

DEFAULT_BODY_WEIGHT_KG = 75.0
MET_VALUES: dict[str, float] = {
    "running": 9.0,
    "treadmill": 7.0,
    "bike": 6.0,
    "elliptical": 7.0,
    "swimming": 7.0,
    "rowing": 7.0,
    "hiit": 8.0,
    "cardio": 7.0,
    "other": 6.0,
}


def _met_kcal(duration_min: int, activity_type: str | None, weight_kg: float) -> float:
    """Pure MET-based kcal estimate: `(MET * 3.5 * kg / 200) * minutes`."""
    met = MET_VALUES.get((activity_type or "").lower(), 6.0)
    return (met * 3.5 * weight_kg / 200.0) * float(duration_min)


# ─── Step logs ───────────────────────────────────────────────────────────────


def upsert_steps(supabase: Client, payload: StepLogRequest) -> StepLog:
    """Insert or overwrite the row for `(user_id, payload.date)`."""
    user_id = get_user_id(supabase)
    record = {
        "user_id": user_id,
        "date": payload.date.isoformat(),
        "steps": payload.steps,
    }
    res = (
        supabase.table(config.TABLE_STEP_LOGS)
        .upsert(record, on_conflict="user_id,date")
        .execute()
    )
    row = res.data[0] if res.data else record
    return StepLog(id=row.get("id", ""), date=payload.date, steps=payload.steps)


def get_steps_for_date(
    supabase: Client, target: DateType
) -> StepLog | None:
    user_id = get_user_id(supabase)
    res = (
        supabase.table(config.TABLE_STEP_LOGS)
        .select("id, date, steps")
        .eq("user_id", user_id)
        .eq("date", target.isoformat())
        .limit(1)
        .execute()
    )
    if not res.data:
        return None
    row = res.data[0]
    return StepLog(id=row["id"], date=target, steps=row["steps"])


def get_steps_week(supabase: Client) -> list[StepLogDay]:
    """Return the current ISO week (Monday → Sunday), always 7 entries."""
    today = DateType.today()
    monday = today - timedelta(days=today.weekday())
    sunday = monday + timedelta(days=6)

    user_id = get_user_id(supabase)
    res = (
        supabase.table(config.TABLE_STEP_LOGS)
        .select("date, steps")
        .eq("user_id", user_id)
        .gte("date", monday.isoformat())
        .lte("date", sunday.isoformat())
        .execute()
    )
    by_date: dict[str, int] = {
        str(r["date"]): int(r["steps"]) for r in (res.data or [])
    }
    out: list[StepLogDay] = []
    for offset in range(7):
        iso = (monday + timedelta(days=offset)).isoformat()
        out.append(StepLogDay(date=iso, steps=by_date.get(iso)))
    return out


# ─── Burn rate ───────────────────────────────────────────────────────────────


def get_burn_rate(supabase: Client) -> list[BurnRateDay]:
    """Last 7 calendar days ending today, summing all cardio sessions per day."""
    today = DateType.today()
    start = today - timedelta(days=6)

    user_id = get_user_id(supabase)
    res = (
        supabase.table(config.TABLE_CARDIO_SESSIONS)
        .select("date, activity_type, duration_min, kcal_total")
        .eq("user_id", user_id)
        .gte("date", start.isoformat())
        .lte("date", today.isoformat())
        .execute()
    )

    # Per-day accumulators.
    kcal_by_date: dict[str, float] = {}
    dur_by_date: dict[str, int] = {}
    type_by_date: dict[str, str] = {}

    for row in res.data or []:
        iso = str(row["date"])
        duration = int(row.get("duration_min") or 0)
        activity = row.get("activity_type")
        kcal_raw = row.get("kcal_total")
        if kcal_raw is None:
            kcal = _met_kcal(duration, activity, DEFAULT_BODY_WEIGHT_KG)
        else:
            kcal = float(kcal_raw)
        kcal_by_date[iso] = kcal_by_date.get(iso, 0.0) + kcal
        dur_by_date[iso] = dur_by_date.get(iso, 0) + duration
        type_by_date.setdefault(iso, activity or "")

    out: list[BurnRateDay] = []
    for offset in range(7):
        iso = (start + timedelta(days=offset)).isoformat()
        out.append(
            BurnRateDay(
                date=iso,
                kcal=int(kcal_by_date.get(iso, 0.0)),
                duration_minutes=dur_by_date.get(iso, 0),
                workout_type=type_by_date.get(iso) or None,
            )
        )
    return out


__all__ = [
    "DEFAULT_BODY_WEIGHT_KG",
    "MET_VALUES",
    "get_burn_rate",
    "get_steps_for_date",
    "get_steps_week",
    "upsert_steps",
]
