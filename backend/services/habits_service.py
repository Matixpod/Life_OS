"""Habits — recurring tasks with streaks.

Habit *definitions* live in the `habits` table. Habit *instances* live in
`daily_tasks` with `task_type='habit_entry'` and `habit_id` set — this lets
the existing KRONOS streak/pattern code see habit completions without any
modification.

The recurrence engine is deterministic and pure: `should_habit_appear(habit,
date)` is a function of (habit, date) only. Calendar generation is
idempotent — calling `generate_habit_entries` twice for the same date
inserts at most one row per habit.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from datetime import date as DateType

from supabase import Client

from core import config
from models.habit_models import (
    CustomRecurrenceRule,
    Habit,
    HabitCompletionResult,
    HabitCreate,
    HabitUpdate,
    RecurrenceType,
)
from models.kronos import TaskCategory
from models.task_models import PRIORITY_TO_INT, Task, TaskPriority, TaskStatus

logger = logging.getLogger(__name__)


TABLE_HABITS = "habits"


# ─── Errors ────────────────────────────────────────────────────────────────


class HabitNotFound(LookupError):
    """Raised when a habit lookup misses or belongs to another user."""


# ─── Conversion helpers ────────────────────────────────────────────────────


def _row_to_habit(row: dict) -> Habit:
    start_time_raw = row.get("start_time")
    day_part_raw = row.get("day_part")
    return Habit(
        id=row["id"],
        user_id=row["user_id"],
        title=row["title"],
        category=TaskCategory(row["category"]),
        priority=TaskPriority(row.get("priority") or "medium"),
        recurrence_type=RecurrenceType(row.get("recurrence_type") or "daily"),
        selected_days=row.get("selected_days"),
        monthly_day=row.get("monthly_day"),
        custom_rule=(
            CustomRecurrenceRule(**row["custom_rule"])
            if row.get("custom_rule")
            else None
        ),
        is_active=bool(row.get("is_active", True)),
        start_date=DateType.fromisoformat(str(row["start_date"])[:10]),
        end_date=(
            DateType.fromisoformat(str(row["end_date"])[:10])
            if row.get("end_date")
            else None
        ),
        estimated_minutes=row.get("estimated_minutes"),
        is_regenerative=bool(row.get("is_regenerative", False)),
        streak=int(row.get("streak", 0)),
        longest_streak=int(row.get("longest_streak", 0)),
        notes=row.get("notes"),
        created_at=_parse_iso(row["created_at"]) or datetime.now(tz=UTC),
        updated_at=_parse_iso(row.get("updated_at")),
        start_time=_parse_time(start_time_raw) if start_time_raw else None,
        day_part=day_part_raw if day_part_raw in {"morning", "day", "evening"} else None,
    )


def _parse_time(raw):  # type: ignore[no-untyped-def]
    from datetime import time as _time

    if isinstance(raw, _time):
        return raw
    try:
        return _time.fromisoformat(str(raw)[:8])
    except ValueError:
        return None


def _infer_day_part(t) -> str | None:  # type: ignore[no-untyped-def]
    if t is None:
        return None
    h = t.hour
    if 5 <= h < 12:
        return "morning"
    if 12 <= h < 18:
        return "day"
    return "evening"


def _parse_iso(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except ValueError:
        return None


# ─── CRUD ──────────────────────────────────────────────────────────────────


def create_habit(supabase: Client, user_id: str, data: HabitCreate) -> Habit:
    inferred_part = (
        data.day_part if data.day_part is not None else _infer_day_part(data.start_time)
    )
    record = {
        "user_id": user_id,
        "title": data.title.strip(),
        "category": data.category.value,
        "priority": data.priority.value,
        "recurrence_type": data.recurrence_type.value,
        "selected_days": data.selected_days,
        "monthly_day": data.monthly_day,
        "custom_rule": (
            data.custom_rule.model_dump(exclude_none=True)
            if data.custom_rule
            else None
        ),
        "start_date": data.start_date.isoformat(),
        "end_date": data.end_date.isoformat() if data.end_date else None,
        "estimated_minutes": data.estimated_minutes,
        "is_regenerative": data.is_regenerative,
        "notes": data.notes,
        "start_time": data.start_time.isoformat() if data.start_time else None,
        "day_part": inferred_part,
    }
    res = supabase.table(TABLE_HABITS).insert(record).execute()
    if not res.data:
        raise RuntimeError("Failed to insert habit")
    return _row_to_habit(res.data[0])


def update_habit(
    supabase: Client, user_id: str, habit_id: str, data: HabitUpdate
) -> Habit:
    existing = _fetch_habit_row(supabase, user_id, habit_id)
    patch: dict = {"updated_at": datetime.now(tz=UTC).isoformat()}
    if data.title is not None:
        patch["title"] = data.title.strip()
    if data.category is not None:
        patch["category"] = data.category.value
    if data.priority is not None:
        patch["priority"] = data.priority.value
    if data.recurrence_type is not None:
        patch["recurrence_type"] = data.recurrence_type.value
    if data.selected_days is not None:
        patch["selected_days"] = data.selected_days
    if data.monthly_day is not None:
        patch["monthly_day"] = data.monthly_day
    if data.custom_rule is not None:
        patch["custom_rule"] = data.custom_rule.model_dump(exclude_none=True)
    if data.start_date is not None:
        patch["start_date"] = data.start_date.isoformat()
    if data.end_date is not None:
        patch["end_date"] = data.end_date.isoformat()
    if data.estimated_minutes is not None:
        patch["estimated_minutes"] = data.estimated_minutes
    if data.is_regenerative is not None:
        patch["is_regenerative"] = data.is_regenerative
    if data.is_active is not None:
        patch["is_active"] = data.is_active
    if data.notes is not None:
        patch["notes"] = data.notes
    if "start_time" in data.model_fields_set:
        patch["start_time"] = (
            data.start_time.isoformat() if data.start_time else None
        )
        if "day_part" not in data.model_fields_set:
            patch["day_part"] = _infer_day_part(data.start_time)
    if "day_part" in data.model_fields_set:
        patch["day_part"] = data.day_part
    res = (
        supabase.table(TABLE_HABITS)
        .update(patch)
        .eq("id", habit_id)
        .eq("user_id", user_id)
        .execute()
    )

    # Propagate stamina-affecting changes onto open habit-entry rows so the
    # current day's pool reflects the edit. Done entries are left untouched
    # to preserve historical bookkeeping.
    daily_patch: dict = {}
    if data.estimated_minutes is not None:
        daily_patch["estimated_minutes"] = data.estimated_minutes
    if data.is_regenerative is not None:
        daily_patch["is_regenerative"] = data.is_regenerative
    if "start_time" in data.model_fields_set:
        daily_patch["start_time"] = (
            data.start_time.isoformat() if data.start_time else None
        )
        if "day_part" not in data.model_fields_set:
            daily_patch["day_part"] = _infer_day_part(data.start_time)
    if "day_part" in data.model_fields_set:
        daily_patch["day_part"] = data.day_part
    if daily_patch:
        (
            supabase.table(config.TABLE_DAILY_TASKS)
            .update(daily_patch)
            .eq("user_id", user_id)
            .eq("habit_id", habit_id)
            .eq("task_type", "habit_entry")
            .neq("status", "done")
            .execute()
        )

    if not res.data:
        # update returned nothing — refetch
        return _row_to_habit(existing)
    return _row_to_habit(res.data[0])


def soft_delete_habit(supabase: Client, user_id: str, habit_id: str) -> None:
    """Soft delete: set is_active=false. Existing daily_tasks rows kept."""
    _fetch_habit_row(supabase, user_id, habit_id)
    (
        supabase.table(TABLE_HABITS)
        .update(
            {
                "is_active": False,
                "updated_at": datetime.now(tz=UTC).isoformat(),
            }
        )
        .eq("id", habit_id)
        .eq("user_id", user_id)
        .execute()
    )


def get_habits(
    supabase: Client, user_id: str, *, include_inactive: bool = False
) -> list[Habit]:
    q = supabase.table(TABLE_HABITS).select("*").eq("user_id", user_id)
    if not include_inactive:
        q = q.eq("is_active", True)
    res = q.order("created_at", desc=True).execute()
    habits = [_row_to_habit(r) for r in (res.data or [])]
    if not habits:
        return habits

    today = DateType.today().isoformat()
    done_res = (
        supabase.table(config.TABLE_DAILY_TASKS)
        .select("habit_id,status")
        .eq("user_id", user_id)
        .eq("date", today)
        .eq("task_type", "habit_entry")
        .eq("status", "done")
        .execute()
    )
    done_habit_ids = {
        row["habit_id"] for row in (done_res.data or []) if row.get("habit_id")
    }
    for h in habits:
        if h.id in done_habit_ids:
            h.completed_today = True
    return habits


def get_habit(supabase: Client, user_id: str, habit_id: str) -> Habit:
    return _row_to_habit(_fetch_habit_row(supabase, user_id, habit_id))


def _fetch_habit_row(
    supabase: Client, user_id: str, habit_id: str
) -> dict:
    res = (
        supabase.table(TABLE_HABITS)
        .select("*")
        .eq("user_id", user_id)
        .eq("id", habit_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HabitNotFound(habit_id)
    return res.data[0]


# ─── Recurrence engine ─────────────────────────────────────────────────────


def should_habit_appear(habit: Habit, target: DateType) -> bool:
    """Pure: whether `habit` is supposed to manifest on `target`.

    ISO weekday convention used throughout: 1=Mon … 7=Sun.
    """
    if not habit.is_active:
        return False
    if target < habit.start_date:
        return False
    if habit.end_date and target > habit.end_date:
        return False

    rt = habit.recurrence_type
    iso_dow = target.isoweekday()  # 1..7

    if rt == RecurrenceType.DAILY:
        return True

    if rt == RecurrenceType.WEEKLY:
        # weekly: same ISO weekday as start_date when no selected_days,
        # otherwise the first entry of selected_days.
        if habit.selected_days:
            return iso_dow == habit.selected_days[0]
        return target.isoweekday() == habit.start_date.isoweekday()

    if rt == RecurrenceType.SELECTED_DAYS:
        return iso_dow in (habit.selected_days or [])

    if rt == RecurrenceType.MONTHLY:
        if habit.monthly_day is None:
            return target.day == habit.start_date.day
        # PROMPT edge case: monthly_day=31 on a month that has < 31 days → skip.
        return target.day == habit.monthly_day

    if rt == RecurrenceType.CUSTOM and habit.custom_rule:
        rule = habit.custom_rule
        if rule.times_per is not None:
            # Times-per-period rules can't be evaluated in pure form — they
            # depend on completion history. We surface "eligible every day"
            # so the entry is generated; the UI/agent can show progress.
            return True
        delta = (target - habit.start_date).days
        if delta < 0:
            return False
        if rule.unit == "days":
            return delta % max(1, rule.interval) == 0
        if rule.unit == "weeks":
            if iso_dow != habit.start_date.isoweekday():
                return False
            weeks = delta // 7
            return weeks % max(1, rule.interval) == 0
        if rule.unit == "months":
            if target.day != habit.start_date.day:
                return False
            months = (target.year - habit.start_date.year) * 12 + (
                target.month - habit.start_date.month
            )
            return months >= 0 and months % max(1, rule.interval) == 0

    return False


# ─── Idempotent entry generation ───────────────────────────────────────────


def generate_habit_entries(
    supabase: Client, user_id: str, target: DateType
) -> list[Task]:
    """Ensure every active habit eligible for `target` has a daily_tasks row.

    Idempotent: callers can invoke this multiple times for the same date
    without creating duplicates. Returns the entries (existing + new).
    """
    habits = get_habits(supabase, user_id, include_inactive=False)
    eligible = [h for h in habits if should_habit_appear(h, target)]
    if not eligible:
        return []

    # Existing rows on this date for these habits
    existing_res = (
        supabase.table(config.TABLE_DAILY_TASKS)
        .select("*")
        .eq("user_id", user_id)
        .eq("date", target.isoformat())
        .eq("task_type", "habit_entry")
        .execute()
    )
    existing_by_habit: dict[str, dict] = {}
    for row in existing_res.data or []:
        hid = row.get("habit_id")
        if hid:
            existing_by_habit[hid] = row

    to_insert: list[dict] = []
    for habit in eligible:
        if habit.id in existing_by_habit:
            continue
        to_insert.append(
            {
                "user_id": user_id,
                "date": target.isoformat(),
                "title": habit.title,
                "category": habit.category.value,
                "priority": PRIORITY_TO_INT.get(habit.priority, 2),
                "status": "todo",
                "task_type": "habit_entry",
                "habit_id": habit.id,
                "source": "agent",
                "estimated_minutes": habit.estimated_minutes,
                "is_regenerative": habit.is_regenerative,
                "start_time": (
                    habit.start_time.isoformat() if habit.start_time else None
                ),
                "day_part": habit.day_part
                or _infer_day_part(habit.start_time),
            }
        )

    inserted_rows: list[dict] = []
    if to_insert:
        ins = (
            supabase.table(config.TABLE_DAILY_TASKS)
            .insert(to_insert)
            .execute()
        )
        inserted_rows = ins.data or []

    all_rows = list(existing_by_habit.values()) + inserted_rows
    return [_row_to_task(r) for r in all_rows]


def _row_to_task(row: dict) -> Task:
    """Lightweight mapping — full mapping lives in services/task_service.py."""
    from models.task_models import INT_TO_PRIORITY  # local import — avoid cycle

    cat = row.get("category")
    status_raw = row.get("status") or "todo"
    pri_int = row.get("priority") or 2
    start_time_raw = row.get("start_time")
    day_part_raw = row.get("day_part")
    return Task(
        id=row["id"],
        user_id=row["user_id"],
        title=row.get("title") or "",
        category=TaskCategory(cat) if cat else None,
        status=TaskStatus(status_raw),
        priority=INT_TO_PRIORITY.get(pri_int, TaskPriority.MEDIUM),
        scheduled_date=(
            DateType.fromisoformat(str(row["date"])[:10])
            if row.get("date")
            else None
        ),
        completed_at=_parse_iso(row.get("completed_at")),
        estimated_minutes=row.get("estimated_minutes"),
        is_main_quest=bool(row.get("is_main_quest", False)),
        is_regenerative=bool(row.get("is_regenerative", False)),
        ap_cost=row.get("ap_cost"),
        notes=row.get("notes"),
        created_at=_parse_iso(row.get("created_at")) or datetime.now(tz=UTC),
        task_type=row.get("task_type") or "task",
        habit_id=row.get("habit_id"),
        project_task_id=row.get("project_task_id"),
        start_time=_parse_time(start_time_raw) if start_time_raw else None,
        day_part=day_part_raw if day_part_raw in {"morning", "day", "evening"} else None,
    )


# ─── Streak recalculation ──────────────────────────────────────────────────


def _compute_streak(
    supabase: Client, user_id: str, habit_id: str, today: DateType
) -> tuple[int, int]:
    """Returns (current_streak, longest_streak) by walking back from `today`.

    A "streak day" = a day on which there is a `done` daily_tasks row for
    this habit. Walks backwards from today; the streak ends at the first
    eligible day (per recurrence rules) without a done entry.
    """
    res = (
        supabase.table(config.TABLE_DAILY_TASKS)
        .select("date,status")
        .eq("user_id", user_id)
        .eq("habit_id", habit_id)
        .gte("date", (today - timedelta(days=400)).isoformat())
        .execute()
    )
    done_dates: set[DateType] = set()
    for row in res.data or []:
        if (row.get("status") or "") != "done":
            continue
        try:
            done_dates.add(DateType.fromisoformat(str(row["date"])[:10]))
        except ValueError:
            continue

    habit = get_habit(supabase, user_id, habit_id)

    current = 0
    cursor = today
    while cursor >= habit.start_date:
        if not should_habit_appear(habit, cursor):
            cursor -= timedelta(days=1)
            continue
        if cursor in done_dates:
            current += 1
            cursor -= timedelta(days=1)
            continue
        break

    # Longest: scan all eligible days in window, longest run of "done" days
    longest = 0
    run = 0
    cursor = habit.start_date
    while cursor <= today:
        if should_habit_appear(habit, cursor):
            if cursor in done_dates:
                run += 1
                longest = max(longest, run)
            else:
                run = 0
        cursor += timedelta(days=1)
    longest = max(longest, current)
    return current, longest


def complete_habit_entry(
    supabase: Client, user_id: str, daily_task_id: str
) -> HabitCompletionResult:
    """Mark a habit entry done and recalculate the parent habit's streak."""
    res = (
        supabase.table(config.TABLE_DAILY_TASKS)
        .select("*")
        .eq("id", daily_task_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise LookupError(f"Daily task {daily_task_id} not found")
    row = res.data[0]
    if row.get("task_type") != "habit_entry":
        raise ValueError("Daily task is not a habit_entry")
    habit_id = row.get("habit_id")
    if not habit_id:
        raise ValueError("Habit entry has no habit_id")

    now = datetime.now(tz=UTC)
    update_payload = {
        "status": "done",
        "completed": True,
        "completed_at": now.isoformat(),
    }
    upd = (
        supabase.table(config.TABLE_DAILY_TASKS)
        .update(update_payload)
        .eq("id", daily_task_id)
        .eq("user_id", user_id)
        .execute()
    )
    new_row = (upd.data or [row])[0]
    daily_task = _row_to_task(new_row)

    today = DateType.today()
    current, longest = _compute_streak(supabase, user_id, habit_id, today)

    habit_row = (
        supabase.table(TABLE_HABITS)
        .update(
            {
                "streak": current,
                "longest_streak": longest,
                "updated_at": now.isoformat(),
            }
        )
        .eq("id", habit_id)
        .eq("user_id", user_id)
        .execute()
    )
    habit = _row_to_habit((habit_row.data or [])[0]) if habit_row.data else (
        get_habit(supabase, user_id, habit_id)
    )

    return HabitCompletionResult(
        habit=habit,
        daily_task=daily_task,
        streak_updated=True,
        new_streak=current,
    )


def uncomplete_habit_entry(
    supabase: Client, user_id: str, daily_task_id: str
) -> HabitCompletionResult:
    """Revert a habit_entry from done back to todo and recompute streak."""
    res = (
        supabase.table(config.TABLE_DAILY_TASKS)
        .select("*")
        .eq("id", daily_task_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise LookupError(f"Daily task {daily_task_id} not found")
    row = res.data[0]
    if row.get("task_type") != "habit_entry":
        raise ValueError("Daily task is not a habit_entry")
    habit_id = row.get("habit_id")
    if not habit_id:
        raise ValueError("Habit entry has no habit_id")

    now = datetime.now(tz=UTC)
    update_payload = {
        "status": "todo",
        "completed": False,
        "completed_at": None,
    }
    upd = (
        supabase.table(config.TABLE_DAILY_TASKS)
        .update(update_payload)
        .eq("id", daily_task_id)
        .eq("user_id", user_id)
        .execute()
    )
    new_row = (upd.data or [row])[0]
    daily_task = _row_to_task({**new_row, **update_payload})

    today = DateType.today()
    current, longest = _compute_streak(supabase, user_id, habit_id, today)

    habit_row = (
        supabase.table(TABLE_HABITS)
        .update(
            {
                "streak": current,
                "longest_streak": longest,
                "updated_at": now.isoformat(),
            }
        )
        .eq("id", habit_id)
        .eq("user_id", user_id)
        .execute()
    )
    habit = (
        _row_to_habit((habit_row.data or [])[0])
        if habit_row.data
        else get_habit(supabase, user_id, habit_id)
    )

    return HabitCompletionResult(
        habit=habit,
        daily_task=daily_task,
        streak_updated=True,
        new_streak=current,
    )


def uncomplete_habit_today(
    supabase: Client, user_id: str, habit_id: str
) -> HabitCompletionResult:
    """Revert today's habit_entry from done back to todo and recompute streak."""
    _fetch_habit_row(supabase, user_id, habit_id)
    today = DateType.today()
    res = (
        supabase.table(config.TABLE_DAILY_TASKS)
        .select("*")
        .eq("user_id", user_id)
        .eq("habit_id", habit_id)
        .eq("date", today.isoformat())
        .limit(1)
        .execute()
    )
    if not res.data:
        raise LookupError(f"No habit entry for {habit_id} on {today.isoformat()}")
    row = res.data[0]
    now = datetime.now(tz=UTC)
    update_payload = {
        "status": "todo",
        "completed": False,
        "completed_at": None,
    }
    upd = (
        supabase.table(config.TABLE_DAILY_TASKS)
        .update(update_payload)
        .eq("id", row["id"])
        .eq("user_id", user_id)
        .execute()
    )
    new_row = (upd.data or [row])[0]
    daily_task = _row_to_task({**new_row, **update_payload})

    current, longest = _compute_streak(supabase, user_id, habit_id, today)
    habit_row = (
        supabase.table(TABLE_HABITS)
        .update(
            {
                "streak": current,
                "longest_streak": longest,
                "updated_at": now.isoformat(),
            }
        )
        .eq("id", habit_id)
        .eq("user_id", user_id)
        .execute()
    )
    habit = (
        _row_to_habit((habit_row.data or [])[0])
        if habit_row.data
        else get_habit(supabase, user_id, habit_id)
    )

    return HabitCompletionResult(
        habit=habit,
        daily_task=daily_task,
        streak_updated=True,
        new_streak=current,
    )


__all__ = [
    "HabitNotFound",
    "complete_habit_entry",
    "create_habit",
    "generate_habit_entries",
    "get_habit",
    "get_habits",
    "should_habit_appear",
    "soft_delete_habit",
    "uncomplete_habit_entry",
    "uncomplete_habit_today",
    "update_habit",
]
