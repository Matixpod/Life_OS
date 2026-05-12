"""Reusable workout templates for the PROMETHEUS module.

A template stores exercise order + target set count only. Per-exercise
kg/reps are loaded at runtime from the user's last performance of that
exercise via ``prometheus_service.get_last_sets_for_exercise``, so
progressive overload is automatic.

Public entry points used by the router and by ``prometheus_service``:
    - list_templates(supabase)
    - get_template(supabase, template_id) — eager-loads last_sets per exercise
    - upsert_template(supabase, name, exercises) — used by the save-workout flow
    - update_template(supabase, template_id, payload)
    - delete_template(supabase, template_id)
    - schedule_template(supabase, template_id, dates)
    - start_today(supabase, template_id)
"""

from __future__ import annotations

from datetime import UTC, datetime
from datetime import date as DateType

from supabase import Client

from core.supabase_client import get_user_id
from models.schemas import (
    ExerciseSet,
    WorkoutTemplate,
    WorkoutTemplateExerciseInput,
)

TABLE_TEMPLATES = "workout_templates"
TABLE_TEMPLATE_EXERCISES = "workout_template_exercises"
TABLE_DAILY_TASKS = "daily_tasks"


def _now_iso() -> str:
    return datetime.now(tz=UTC).isoformat()


def _row_to_template(
    row: dict,
    exercises: list[dict] | None = None,
) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "created_at": row.get("created_at") or _now_iso(),
        "updated_at": row.get("updated_at") or _now_iso(),
        "exercises": exercises or [],
    }


def _ex_row_to_dict(row: dict, last_sets: list[ExerciseSet] | None = None) -> dict:
    return {
        "id": row["id"],
        "template_id": row["template_id"],
        "exercise_name": row["exercise_name"],
        "order_index": int(row.get("order_index") or 0),
        "target_sets": int(row.get("target_sets") or 3),
        "muscle_load": row.get("muscle_load") or {},
        "last_sets": [s.model_dump() for s in (last_sets or [])],
    }


def _last_sets_by_exercise_name(
    supabase: Client, names: list[str]
) -> dict[str, list[ExerciseSet]]:
    """Resolve last-performed sets for each exercise name by scanning the
    user's recent sessions. One pass over recent session exercises rather
    than N round-trips through ``get_last_sets_for_exercise`` (which expects
    an exercise *id*, not name)."""
    if not names:
        return {}
    user_id = get_user_id(supabase)
    sess_res = (
        supabase.table("prometheus_sessions")
        .select("id, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(60)
        .execute()
    )
    sessions = sess_res.data or []
    if not sessions:
        return {}
    session_ids = [s["id"] for s in sessions]
    rank = {sid: i for i, sid in enumerate(session_ids)}

    ex_res = (
        supabase.table("prometheus_session_exercises")
        .select("session_id, exercise_name, sets")
        .in_("session_id", session_ids)
        .in_("exercise_name", names)
        .execute()
    )
    matches = ex_res.data or []
    matches.sort(key=lambda r: rank.get(r["session_id"], 10**9))

    out: dict[str, list[ExerciseSet]] = {}
    for row in matches:
        name = row.get("exercise_name")
        if not name or name in out:
            continue
        sets: list[ExerciseSet] = []
        for s in row.get("sets") or []:
            try:
                sets.append(
                    ExerciseSet(
                        reps=int(s.get("reps", 0) or 0),
                        kg=float(s.get("kg", 0.0) or 0.0),
                    )
                )
            except (TypeError, ValueError):
                continue
        out[name] = sets
    return out


# ─── Read ─────────────────────────────────────────────────────────────────────


def list_templates(supabase: Client) -> list[dict]:
    user_id = get_user_id(supabase)
    res = (
        supabase.table(TABLE_TEMPLATES)
        .select("*")
        .eq("user_id", user_id)
        .order("updated_at", desc=True)
        .execute()
    )
    templates = res.data or []
    if not templates:
        return []
    ids = [t["id"] for t in templates]
    ex_res = (
        supabase.table(TABLE_TEMPLATE_EXERCISES)
        .select("*")
        .in_("template_id", ids)
        .order("order_index")
        .execute()
    )
    by_template: dict[str, list[dict]] = {}
    for ex in ex_res.data or []:
        by_template.setdefault(ex["template_id"], []).append(_ex_row_to_dict(ex))
    return [_row_to_template(t, by_template.get(t["id"], [])) for t in templates]


def get_template(supabase: Client, template_id: str) -> dict | None:
    user_id = get_user_id(supabase)
    res = (
        supabase.table(TABLE_TEMPLATES)
        .select("*")
        .eq("id", template_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        return None
    template = res.data[0]

    ex_res = (
        supabase.table(TABLE_TEMPLATE_EXERCISES)
        .select("*")
        .eq("template_id", template_id)
        .order("order_index")
        .execute()
    )
    ex_rows = ex_res.data or []
    names = [r["exercise_name"] for r in ex_rows]
    last_by_name = _last_sets_by_exercise_name(supabase, names)
    exercises = [
        _ex_row_to_dict(ex, last_by_name.get(ex["exercise_name"], []))
        for ex in ex_rows
    ]
    return _row_to_template(template, exercises)


# ─── Write ────────────────────────────────────────────────────────────────────


def _find_by_name(
    supabase: Client, user_id: str, name: str
) -> dict | None:
    res = (
        supabase.table(TABLE_TEMPLATES)
        .select("*")
        .eq("user_id", user_id)
        .ilike("name", name)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def _replace_exercises(
    supabase: Client,
    template_id: str,
    exercises: list[WorkoutTemplateExerciseInput],
) -> None:
    supabase.table(TABLE_TEMPLATE_EXERCISES).delete().eq(
        "template_id", template_id
    ).execute()
    if not exercises:
        return
    rows = [
        {
            "template_id": template_id,
            "exercise_name": ex.exercise_name,
            "order_index": ex.order_index if ex.order_index is not None else idx,
            "target_sets": ex.target_sets,
            "muscle_load": ex.muscle_load or {},
        }
        for idx, ex in enumerate(exercises)
    ]
    supabase.table(TABLE_TEMPLATE_EXERCISES).insert(rows).execute()


def upsert_template(
    supabase: Client,
    *,
    name: str,
    exercises: list[WorkoutTemplateExerciseInput],
) -> dict:
    user_id = get_user_id(supabase)
    clean = name.strip()
    if not clean:
        raise ValueError("Template name is required")

    existing = _find_by_name(supabase, user_id, clean)
    if existing:
        template_id = existing["id"]
        supabase.table(TABLE_TEMPLATES).update(
            {"name": clean, "updated_at": _now_iso()}
        ).eq("id", template_id).execute()
    else:
        insert_res = (
            supabase.table(TABLE_TEMPLATES)
            .insert({"user_id": user_id, "name": clean})
            .execute()
        )
        if not insert_res.data:
            raise RuntimeError("Failed to insert workout_templates row")
        template_id = insert_res.data[0]["id"]

    _replace_exercises(supabase, template_id, exercises)
    return get_template(supabase, template_id) or {}


def update_template(
    supabase: Client,
    template_id: str,
    *,
    name: str | None = None,
    exercises: list[WorkoutTemplateExerciseInput] | None = None,
) -> dict | None:
    user_id = get_user_id(supabase)
    owned = (
        supabase.table(TABLE_TEMPLATES)
        .select("id")
        .eq("id", template_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not owned.data:
        return None

    update_row: dict = {"updated_at": _now_iso()}
    if name is not None:
        clean = name.strip()
        if not clean:
            raise ValueError("Template name cannot be blank")
        update_row["name"] = clean
    supabase.table(TABLE_TEMPLATES).update(update_row).eq(
        "id", template_id
    ).execute()

    if exercises is not None:
        _replace_exercises(supabase, template_id, exercises)

    return get_template(supabase, template_id)


def delete_template(supabase: Client, template_id: str) -> bool:
    user_id = get_user_id(supabase)
    res = (
        supabase.table(TABLE_TEMPLATES)
        .delete()
        .eq("id", template_id)
        .eq("user_id", user_id)
        .execute()
    )
    return bool(res.data)


# ─── Scheduling ───────────────────────────────────────────────────────────────


def schedule_template(
    supabase: Client,
    template_id: str,
    dates: list[DateType],
) -> list[dict]:
    """Create a workout daily_task for each date pointing at the template.

    Skips dates that already have a workout daily_task for this template.
    Returns the created/existing daily_tasks rows.
    """
    template = get_template(supabase, template_id)
    if not template:
        return []
    user_id = get_user_id(supabase)
    name = template["name"]
    out: list[dict] = []

    for d in dates:
        date_str = str(d)
        existing = (
            supabase.table(TABLE_DAILY_TASKS)
            .select("*")
            .eq("user_id", user_id)
            .eq("date", date_str)
            .eq("task_type", "workout")
            .eq("workout_template_id", template_id)
            .limit(1)
            .execute()
        )
        if existing.data:
            out.append(existing.data[0])
            continue

        record = {
            "user_id": user_id,
            "date": date_str,
            "title": name,
            "task_type": "workout",
            "workout_template_id": template_id,
            "workout_template_label": name,
            "category": "vitality",
            "status": "todo",
            "priority": 2,
            "estimated_minutes": 60,
            "source": "manual",
        }
        ins = supabase.table(TABLE_DAILY_TASKS).insert(record).execute()
        if ins.data:
            out.append(ins.data[0])
    return out


def start_today(supabase: Client, template_id: str) -> dict | None:
    today = DateType.today()
    rows = schedule_template(supabase, template_id, [today])
    return rows[0] if rows else None


__all__ = [
    "WorkoutTemplate",
    "delete_template",
    "get_template",
    "list_templates",
    "schedule_template",
    "start_today",
    "update_template",
    "upsert_template",
]
