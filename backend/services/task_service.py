"""Task System service layer.

CRUD + aggregation operations on `daily_tasks` (per ADR-010, the canonical
task table — there is no parallel `tasks` table). Functions follow the
existing `goals_service` pattern: `(supabase: Client, payload)` with
`user_id` resolved internally via `get_user_id`. This deviates from the
PROMPT signature `(user_id, data)` but keeps the codebase coherent —
single-user system, no JWT layer yet.

Custom exceptions are raised for conditions the router maps to specific
HTTP statuses (404, 409, 422). The router is the only layer that knows
about HTTP.
"""

from datetime import UTC, datetime, time, timedelta
from datetime import date as DateType

from supabase import Client

from agents.kronos.streak_tracker import calculate_streaks
from core import config
from core.supabase_client import get_user_id
from models.kronos import TaskCategory, TaskStatus
from models.task_models import (
    INT_TO_PRIORITY,
    PRIORITY_TO_INT,
    CategoryDaySummary,
    DailyTaskList,
    Task,
    TaskCompletionResult,
    TaskCreate,
    TaskPriority,
    TaskUpdate,
    WeeklyTaskList,
    WorkoutCompleteMeta,
)
from services.xp_engine import compute_xp

# ─── Exceptions (router maps to HTTP) ─────────────────────────────────────────


class TaskNotFound(Exception):
    """Task does not exist for this user. → 404"""


class TaskAlreadyDone(Exception):
    """complete_task called on a task already marked done. → 409"""


class TaskSkipped(Exception):
    """complete_task called on a skipped task. → 422"""


# ─── Row mapper ──────────────────────────────────────────────────────────────


def _row_to_task(row: dict) -> Task:
    cat_raw = row.get("category")
    category: TaskCategory | None
    if cat_raw:
        try:
            category = TaskCategory(cat_raw)
        except ValueError:
            category = None
    else:
        category = None

    status_raw = row.get("status") or TaskStatus.TODO.value
    try:
        status = TaskStatus(status_raw)
    except ValueError:
        status = TaskStatus.TODO

    priority_int = row.get("priority") or 2
    priority = INT_TO_PRIORITY.get(priority_int, TaskPriority.MEDIUM)

    scheduled_raw = row.get("date")
    scheduled_date = DateType.fromisoformat(scheduled_raw) if scheduled_raw else None

    start_time_raw = row.get("start_time")
    start_time_value = _parse_time(start_time_raw) if start_time_raw else None
    day_part_raw = row.get("day_part")
    day_part_value = day_part_raw if day_part_raw in {"morning", "day", "evening"} else None

    return Task(
        id=row["id"],
        user_id=row["user_id"],
        title=row["title"],
        category=category,
        status=status,
        priority=priority,
        scheduled_date=scheduled_date,
        completed_at=row.get("completed_at"),
        estimated_minutes=row.get("estimated_minutes"),
        notes=row.get("notes"),
        created_at=row["created_at"],
        task_type=row.get("task_type") or "task",
        habit_id=row.get("habit_id"),
        project_task_id=row.get("project_task_id"),
        workout_template_label=row.get("workout_template_label"),
        is_main_quest=bool(row.get("is_main_quest")),
        is_regenerative=bool(row.get("is_regenerative")),
        ap_cost=row.get("ap_cost"),
        start_time=start_time_value,
        day_part=day_part_value,
    )


def _parse_time(raw: str | time) -> time | None:
    if isinstance(raw, time):
        return raw
    try:
        return time.fromisoformat(str(raw)[:8])
    except ValueError:
        return None


def _infer_day_part(t: time | None) -> str | None:
    """Map a wall-clock time to one of 'morning' / 'day' / 'evening'.

    Windows: 05:00–11:59 morning · 12:00–17:59 day · 18:00–04:59 evening.
    Returns None when no time is provided so callers can leave the column
    untouched (a manual day_part survives without a time).
    """
    if t is None:
        return None
    h = t.hour
    if 5 <= h < 12:
        return "morning"
    if 12 <= h < 18:
        return "day"
    return "evening"


def _fetch_owned_row(supabase: Client, task_id: str, user_id: str) -> dict | None:
    res = (
        supabase.table(config.TABLE_DAILY_TASKS)
        .select("*")
        .eq("id", task_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


# ─── CRUD ────────────────────────────────────────────────────────────────────


def create_task(supabase: Client, payload: TaskCreate) -> Task:
    user_id = get_user_id(supabase)
    title = payload.title.strip()
    if not title:
        raise ValueError("Title is empty after trimming whitespace.")

    inferred_part = (
        payload.day_part
        if payload.day_part is not None
        else _infer_day_part(payload.start_time)
    )
    record: dict = {
        "user_id": user_id,
        "title": title,
        "category": payload.category.value,
        "priority": PRIORITY_TO_INT[payload.priority],
        "estimated_minutes": payload.estimated_minutes,
        "notes": payload.notes,
        "status": TaskStatus.TODO.value,
        "source": "manual",
        "is_main_quest": payload.is_main_quest,
        "is_regenerative": payload.is_regenerative,
        "start_time": payload.start_time.isoformat() if payload.start_time else None,
        "day_part": inferred_part,
        "task_type": payload.task_type,
        "workout_template_label": payload.workout_template_label,
    }
    # `daily_tasks.date` is currently NOT NULL (migration 003). When the
    # column is later relaxed to support backlog, omitting `date` here
    # will work without further changes.
    if payload.scheduled_date is not None:
        record["date"] = str(payload.scheduled_date)

    res = supabase.table(config.TABLE_DAILY_TASKS).insert(record).execute()
    return _row_to_task(res.data[0])


def update_task(supabase: Client, task_id: str, payload: TaskUpdate) -> Task:
    user_id = get_user_id(supabase)
    row = _fetch_owned_row(supabase, task_id, user_id)
    if not row:
        raise TaskNotFound(task_id)

    update: dict = {}
    if payload.title is not None:
        update["title"] = payload.title.strip()
    if payload.category is not None:
        update["category"] = payload.category.value
    if payload.status is not None:
        update["status"] = payload.status.value
        if payload.status == TaskStatus.DONE:
            update["completed"] = True
            if not row.get("completed_at"):
                update["completed_at"] = datetime.now(tz=UTC).isoformat()
        elif payload.status in (TaskStatus.TODO, TaskStatus.IN_PROGRESS):
            update["completed"] = False
    if payload.priority is not None:
        update["priority"] = PRIORITY_TO_INT[payload.priority]
    if payload.scheduled_date is not None:
        update["date"] = str(payload.scheduled_date)
    if payload.estimated_minutes is not None:
        update["estimated_minutes"] = payload.estimated_minutes
    if payload.notes is not None:
        update["notes"] = payload.notes
    if payload.is_main_quest is not None:
        update["is_main_quest"] = payload.is_main_quest
    if payload.is_regenerative is not None:
        update["is_regenerative"] = payload.is_regenerative
    if "start_time" in payload.model_fields_set:
        update["start_time"] = (
            payload.start_time.isoformat() if payload.start_time else None
        )
        # If the caller didn't override day_part, snap it to the time window so
        # the column never drifts from the rule "08:00 → morning".
        if "day_part" not in payload.model_fields_set:
            update["day_part"] = _infer_day_part(payload.start_time)
    if "day_part" in payload.model_fields_set:
        update["day_part"] = payload.day_part

    if not update:
        return _row_to_task(row)

    res = (
        supabase.table(config.TABLE_DAILY_TASKS)
        .update(update)
        .eq("id", task_id)
        .execute()
    )
    return _row_to_task(res.data[0] if res.data else {**row, **update})


async def complete_task(
    supabase: Client,
    task_id: str,
    *,
    workout_meta: WorkoutCompleteMeta | None = None,
) -> TaskCompletionResult:
    user_id = get_user_id(supabase)
    row = _fetch_owned_row(supabase, task_id, user_id)
    if not row:
        raise TaskNotFound(task_id)

    current_status = row.get("status")
    if current_status == TaskStatus.DONE.value:
        raise TaskAlreadyDone(task_id)
    if current_status == TaskStatus.SKIPPED.value:
        raise TaskSkipped(task_id)

    cat_raw = row.get("category")
    pre_streak = _streak_for_category(supabase, cat_raw)

    now = datetime.now(tz=UTC)
    update = {
        "status": TaskStatus.DONE.value,
        "completed_at": now.isoformat(),
        "completed": True,  # legacy boolean kept in sync for goals module
    }
    res = (
        supabase.table(config.TABLE_DAILY_TASKS)
        .update(update)
        .eq("id", task_id)
        .execute()
    )
    updated = res.data[0] if res.data else {**row, **update}
    task = _row_to_task(updated)

    xp_earned, bonus_reasons = compute_xp(task, pre_streak)

    # Recompute streak post-completion. Cheap for single-user; precise
    # because it goes through the same code path KRONOS uses.
    post_streak = _streak_for_category(supabase, cat_raw)

    # Workout daily-task → spawn a PROMETHEUS session by copying exercises
    # from the most recent strength session sharing this label. Best-effort:
    # any failure is swallowed so the task still ends up as `done`.
    if updated.get("task_type") == "workout":
        label = updated.get("workout_template_label") or row.get("title") or ""
        try:
            await _auto_create_session_from_label(
                supabase,
                label=str(label),
                session_date=str(updated.get("date") or row.get("date") or ""),
                duration_min=workout_meta.duration_min if workout_meta else None,
                avg_hr=workout_meta.avg_hr if workout_meta else None,
            )
        except Exception:
            # Silent — completion already committed.
            pass

    return TaskCompletionResult(
        task=task,
        xp_earned=xp_earned,
        streak_updated=post_streak > pre_streak,
        new_streak=post_streak,
        bonus_reasons=bonus_reasons,
    )


async def _auto_create_session_from_label(
    supabase: Client,
    *,
    label: str,
    session_date: str,
    duration_min: int | None,
    avg_hr: int | None,
) -> None:
    """Create a `prometheus_session` from the most recent matching session.

    Resolution: look up the latest `prometheus_session` for this user with
    the same `label`, copy its exercises (and their last-recorded sets),
    and insert as a new session — with the user-supplied `duration_min` /
    `avg_hr` so the kcal analyser runs.

    If no historical session matches, we still create an empty session
    (label + duration + HR) so the user gets kcal numbers; PROMETHEUS will
    just have nothing to copy from.
    """
    from datetime import date as _DateType

    # Local imports to keep `task_service` side of the dependency graph
    # lazy — avoids circular import via prometheus_service → cardio.
    from models.schemas import (
        ExerciseSet,
        SessionCreate,
        SessionExerciseCreate,
    )
    from services import prometheus_service

    if not label:
        return

    user_id = get_user_id(supabase)
    sess_res = (
        supabase.table(config.TABLE_PROMETHEUS_SESSIONS)
        .select("id, created_at")
        .eq("user_id", user_id)
        .eq("label", label)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    exercises: list[SessionExerciseCreate] = []
    template_session = (sess_res.data or [None])[0]
    if template_session:
        ex_res = (
            supabase.table(config.TABLE_PROMETHEUS_SESSION_EXES)
            .select("exercise_name, sets, muscle_load, order_index")
            .eq("session_id", template_session["id"])
            .order("order_index")
            .execute()
        )
        for ex in ex_res.data or []:
            sets: list[ExerciseSet] = []
            for s in ex.get("sets") or []:
                try:
                    sets.append(
                        ExerciseSet(
                            reps=int(s.get("reps", 0) or 0),
                            kg=float(s.get("kg", 0.0) or 0.0),
                        )
                    )
                except (TypeError, ValueError):
                    continue
            exercises.append(
                SessionExerciseCreate(
                    exercise_name=ex.get("exercise_name") or "Ćwiczenie",
                    sets=sets,
                    muscle_load=ex.get("muscle_load") or {},
                )
            )

    try:
        target_date = _DateType.fromisoformat(session_date)
    except (TypeError, ValueError):
        target_date = _DateType.today()

    payload = SessionCreate(
        date=target_date,
        label=label,
        exercises=exercises,
        duration_min=duration_min,
        avg_hr=avg_hr,
    )
    await prometheus_service.create_session(supabase, payload)


def uncomplete_task(supabase: Client, task_id: str) -> Task:
    """Revert a done task back to todo. Idempotent on already-todo rows."""
    user_id = get_user_id(supabase)
    row = _fetch_owned_row(supabase, task_id, user_id)
    if not row:
        raise TaskNotFound(task_id)
    update = {
        "status": TaskStatus.TODO.value,
        "completed": False,
        "completed_at": None,
    }
    res = (
        supabase.table(config.TABLE_DAILY_TASKS)
        .update(update)
        .eq("id", task_id)
        .execute()
    )
    return _row_to_task(res.data[0] if res.data else {**row, **update})


def skip_task(supabase: Client, task_id: str) -> Task:
    user_id = get_user_id(supabase)
    row = _fetch_owned_row(supabase, task_id, user_id)
    if not row:
        raise TaskNotFound(task_id)
    res = (
        supabase.table(config.TABLE_DAILY_TASKS)
        .update({"status": TaskStatus.SKIPPED.value})
        .eq("id", task_id)
        .execute()
    )
    return _row_to_task(res.data[0] if res.data else {**row, "status": TaskStatus.SKIPPED.value})


def soft_delete_task(supabase: Client, task_id: str) -> None:
    """Soft delete: set status=skipped. Never hard-delete (KRONOS data integrity)."""
    user_id = get_user_id(supabase)
    row = _fetch_owned_row(supabase, task_id, user_id)
    if not row:
        raise TaskNotFound(task_id)
    supabase.table(config.TABLE_DAILY_TASKS).update(
        {"status": TaskStatus.SKIPPED.value}
    ).eq("id", task_id).execute()


# ─── Aggregation ─────────────────────────────────────────────────────────────


def _summary_for_day(date_value: DateType, tasks: list[Task]) -> DailyTaskList:
    by_cat: dict[str, CategoryDaySummary] = {}
    for t in tasks:
        if t.category is None:
            continue
        key = t.category.value
        summary = by_cat.get(key) or CategoryDaySummary(
            category=t.category, planned=0, completed=0, xp_earned=0
        )
        if t.status != TaskStatus.SKIPPED:
            summary.planned += 1
        if t.status == TaskStatus.DONE:
            summary.completed += 1
            # Retrospective XP: streak at original completion time is not
            # stored on the row, so we pass 0. Documented in xp_engine.
            xp, _ = compute_xp(t, streak=0)
            summary.xp_earned += xp
        by_cat[key] = summary

    total_planned = sum(1 for t in tasks if t.status != TaskStatus.SKIPPED)
    total_completed = sum(1 for t in tasks if t.status == TaskStatus.DONE)
    completion_rate = total_completed / total_planned if total_planned > 0 else 0.0

    return DailyTaskList(
        date=date_value,
        tasks=tasks,
        by_category=by_cat,
        total_planned=total_planned,
        total_completed=total_completed,
        completion_rate=completion_rate,
    )


def get_daily_tasks(supabase: Client, target_date: DateType) -> DailyTaskList:
    user_id = get_user_id(supabase)
    res = (
        supabase.table(config.TABLE_DAILY_TASKS)
        .select("*")
        .eq("user_id", user_id)
        .eq("date", str(target_date))
        .order("priority")
        .order("created_at")
        .execute()
    )
    tasks = [_row_to_task(r) for r in (res.data or [])]
    return _summary_for_day(target_date, tasks)


def get_weekly_tasks(supabase: Client, week_start: DateType) -> WeeklyTaskList:
    """Build 7-day breakdown. Normalizes `week_start` to that ISO week's Monday."""
    week_start = week_start - timedelta(days=week_start.weekday())
    week_end = week_start + timedelta(days=6)
    user_id = get_user_id(supabase)

    res = (
        supabase.table(config.TABLE_DAILY_TASKS)
        .select("*")
        .eq("user_id", user_id)
        .gte("date", str(week_start))
        .lte("date", str(week_end))
        .order("date")
        .order("priority")
        .order("created_at")
        .execute()
    )

    by_date: dict[DateType, list[Task]] = {}
    for r in res.data or []:
        t = _row_to_task(r)
        if t.scheduled_date is not None:
            by_date.setdefault(t.scheduled_date, []).append(t)

    days: list[DailyTaskList] = []
    total_xp = 0
    best_day: DateType | None = None
    best_xp = 0
    worst_day: DateType | None = None
    worst_rate: float | None = None

    for offset in range(7):
        d = week_start + timedelta(days=offset)
        summary = _summary_for_day(d, by_date.get(d, []))
        days.append(summary)
        day_xp = sum(c.xp_earned for c in summary.by_category.values())
        total_xp += day_xp
        if day_xp > best_xp:
            best_xp = day_xp
            best_day = d
        if summary.total_planned > 0 and (
            worst_rate is None or summary.completion_rate < worst_rate
        ):
            worst_rate = summary.completion_rate
            worst_day = d

    return WeeklyTaskList(
        week_start=week_start,
        week_end=week_end,
        days=days,
        total_xp=total_xp,
        best_day=best_day if best_xp > 0 else None,
        worst_day=worst_day if worst_rate is not None and worst_rate < 1.0 else None,
    )


def query_tasks(
    supabase: Client,
    *,
    target_date: DateType | None = None,
    category: TaskCategory | None = None,
    status: TaskStatus | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[Task]:
    """General filter query backing `GET /api/tasks`.

    All filters are optional. Results are ordered by date, then priority
    (1 = highest first). `limit`/`offset` are passed through as a single
    `range()` call to Supabase.
    """
    user_id = get_user_id(supabase)
    q = supabase.table(config.TABLE_DAILY_TASKS).select("*").eq("user_id", user_id)
    if target_date is not None:
        q = q.eq("date", str(target_date))
    if category is not None:
        q = q.eq("category", category.value)
    if status is not None:
        q = q.eq("status", status.value)
    res = (
        q.order("date").order("priority").range(offset, offset + limit - 1).execute()
    )
    return [_row_to_task(r) for r in (res.data or [])]


def get_backlog_tasks(supabase: Client) -> list[Task]:
    """Tasks with no scheduled date, sorted by priority then newest first.

    Currently `daily_tasks.date` is NOT NULL (migration 003), so this
    returns an empty list until a future migration relaxes the constraint.
    PROMPT forbids new migrations in this phase.
    """
    user_id = get_user_id(supabase)
    res = (
        supabase.table(config.TABLE_DAILY_TASKS)
        .select("*")
        .eq("user_id", user_id)
        .is_("date", "null")
        .order("priority")
        .order("created_at", desc=True)
        .execute()
    )
    return [_row_to_task(r) for r in (res.data or [])]


# ─── Internal helpers ────────────────────────────────────────────────────────


def _streak_for_category(supabase: Client, category_value: str | None) -> int:
    """Return current streak length for the given category, or 0."""
    if not category_value:
        return 0
    try:
        category = TaskCategory(category_value)
    except ValueError:
        return 0
    for sd in calculate_streaks(supabase):
        if sd.category == category:
            return sd.current_streak
    return 0
