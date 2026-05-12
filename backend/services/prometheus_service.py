"""DB persistence for the PROMETHEUS gym module."""

from __future__ import annotations

from collections import defaultdict
from datetime import UTC, date, datetime, timedelta

from supabase import Client

from core import config
from core.supabase_client import get_user_id
from models.schemas import (
    ExerciseCreate,
    ExerciseSet,
    GroupRecoveryResponse,
    RecoveryStateResponse,
    SessionCreate,
    SessionUpdate,
)
from services import prometheus_recovery_engine as engine

# ─── Exercise library ─────────────────────────────────────────────────────────


def get_exercise_library(
    supabase: Client, *, search: str | None = None
) -> list[dict]:
    user_id = get_user_id(supabase)
    query = (
        supabase.table(config.TABLE_PROMETHEUS_EXERCISES)
        .select("*")
        .eq("user_id", user_id)
        .order("name")
    )
    if search:
        query = query.ilike("name", f"%{search}%")
    res = query.execute()
    return res.data or []


def upsert_exercise(supabase: Client, payload: ExerciseCreate) -> dict:
    user_id = get_user_id(supabase)
    record = {
        "user_id": user_id,
        "name": payload.name.strip(),
        "muscle_load": payload.muscle_load or {},
        "updated_at": datetime.now(tz=UTC).isoformat(),
    }
    res = (
        supabase.table(config.TABLE_PROMETHEUS_EXERCISES)
        .upsert(record, on_conflict="user_id,name")
        .execute()
    )
    return res.data[0] if res.data else record


def delete_exercise(supabase: Client, exercise_id: str) -> bool:
    user_id = get_user_id(supabase)
    res = (
        supabase.table(config.TABLE_PROMETHEUS_EXERCISES)
        .delete()
        .eq("id", exercise_id)
        .eq("user_id", user_id)
        .execute()
    )
    return bool(res.data)


def get_last_sets_for_exercise(
    supabase: Client, exercise_id: str
) -> list[ExerciseSet]:
    """Resolve exercise name from id, then find the most recent session
    containing that name and return its sets.
    """
    user_id = get_user_id(supabase)
    ex_res = (
        supabase.table(config.TABLE_PROMETHEUS_EXERCISES)
        .select("name")
        .eq("id", exercise_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not ex_res.data:
        return []
    name = ex_res.data[0]["name"]

    sess_res = (
        supabase.table(config.TABLE_PROMETHEUS_SESSIONS)
        .select("id, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    sessions = sess_res.data or []
    if not sessions:
        return []
    session_ids = [s["id"] for s in sessions]
    rank = {sid: i for i, sid in enumerate(session_ids)}

    ex_rows = (
        supabase.table(config.TABLE_PROMETHEUS_SESSION_EXES)
        .select("session_id, sets")
        .in_("session_id", session_ids)
        .eq("exercise_name", name)
        .execute()
    )
    matches = ex_rows.data or []
    if not matches:
        return []
    matches.sort(key=lambda r: rank.get(r["session_id"], 1_000_000))
    raw_sets = matches[0].get("sets") or []
    out: list[ExerciseSet] = []
    for s in raw_sets:
        try:
            out.append(
                ExerciseSet(
                    reps=int(s.get("reps", 0) or 0),
                    kg=float(s.get("kg", 0.0) or 0.0),
                )
            )
        except (TypeError, ValueError):
            continue
    return out


# ─── Sessions ─────────────────────────────────────────────────────────────────


async def create_session(supabase: Client, payload: SessionCreate) -> dict:
    user_id = get_user_id(supabase)
    session_record = {
        "user_id": user_id,
        "date": str(payload.date),
        "label": payload.label or "",
        "notes": payload.notes,
        "duration_min": payload.duration_min,
        "avg_hr": payload.avg_hr,
    }
    session_res = (
        supabase.table(config.TABLE_PROMETHEUS_SESSIONS)
        .insert(session_record)
        .execute()
    )
    if not session_res.data:
        raise RuntimeError("Failed to create prometheus_session")
    session = session_res.data[0]
    session_id = session["id"]

    aggregated_muscles: dict[str, float] = {}
    inserted_exercises: list[dict] = []
    if payload.exercises:
        ex_rows = []
        for idx, ex in enumerate(payload.exercises):
            ex_rows.append(
                {
                    "session_id": session_id,
                    "exercise_name": ex.exercise_name,
                    "sets": [s.model_dump() for s in ex.sets],
                    "muscle_load": ex.muscle_load or {},
                    "order_index": idx,
                }
            )
            for muscle, load in (ex.muscle_load or {}).items():
                current = aggregated_muscles.get(muscle, 0.0)
                aggregated_muscles[muscle] = max(current, float(load))
            try:
                upsert_exercise(
                    supabase,
                    ExerciseCreate(
                        name=ex.exercise_name,
                        muscle_load=ex.muscle_load or {},
                    ),
                )
            except Exception:
                pass

        ex_res = (
            supabase.table(config.TABLE_PROMETHEUS_SESSION_EXES)
            .insert(ex_rows)
            .execute()
        )
        inserted_exercises = ex_res.data or []
        session["exercises"] = inserted_exercises
    else:
        session["exercises"] = []

    # Upsert reusable workout template by name. Best-effort: any failure
    # here must not break session creation.
    save_as_template = getattr(payload, "save_as_template", True)
    label_clean = (payload.label or "").strip()
    if save_as_template and label_clean and payload.exercises:
        try:
            from models.schemas import WorkoutTemplateExerciseInput
            from services import workout_template_service

            template_exercises = [
                WorkoutTemplateExerciseInput(
                    exercise_name=ex.exercise_name,
                    order_index=idx,
                    target_sets=max(1, len(ex.sets) or 3),
                    muscle_load=ex.muscle_load or {},
                )
                for idx, ex in enumerate(payload.exercises)
            ]
            workout_template_service.upsert_template(
                supabase, name=label_clean, exercises=template_exercises
            )
        except Exception:
            pass

    # Dashboard compatibility — also write a basic workout_sessions row
    try:
        supabase.table(config.TABLE_WORKOUTS).insert(
            {
                "user_id": user_id,
                "date": str(payload.date),
                "type": "strength",
                "label": payload.label or "Trening",
                "muscle_groups": list(aggregated_muscles.keys()),
                "duration_minutes": payload.duration_min,
            }
        ).execute()
    except Exception:
        pass

    # ── Strength kcal analysis ─────────────────────────────────────────
    # Runs whenever the session has exercises or a logged duration. The
    # agent's tonnage-only branch handles the no-duration case so fat_grams
    # always lands in the jar. AI-written `analysis_note` is skipped when no
    # duration was supplied — keeps quick text-input saves cheap.
    has_exercises = bool(payload.exercises)
    if payload.duration_min is not None or has_exercises:
        try:
            from agents.prometheus import agent as prometheus_agent
            from models.schemas import CardioProfile
            from services import cardio_service

            profile_row = cardio_service.get_profile(supabase)
            profile = CardioProfile(**profile_row) if profile_row else None
            kcal_result = await prometheus_agent.analyze_strength_kcal(
                duration_min=payload.duration_min,
                avg_hr=payload.avg_hr,
                label=payload.label or "Trening",
                exercises=[
                    {
                        "name": ex.exercise_name,
                        "sets": [s.model_dump() for s in ex.sets],
                    }
                    for ex in (payload.exercises or [])
                ],
                profile=profile,
                supabase=supabase,
                skip_note=payload.duration_min is None,
            )
            update = {
                "kcal_total": kcal_result["kcal_total"],
                "kcal_epoc": kcal_result["kcal_epoc"],
                "fat_pct": kcal_result["fat_pct"],
                "carb_pct": kcal_result["carb_pct"],
                "fat_grams": kcal_result["fat_grams"],
                "analysis_note": kcal_result["analysis_note"],
            }
            (
                supabase.table(config.TABLE_PROMETHEUS_SESSIONS)
                .update(update)
                .eq("id", session_id)
                .eq("user_id", user_id)
                .execute()
            )
            session.update(update)
        except Exception:
            # Non-fatal: the session is already saved; kcal stays null.
            pass

    return session


def get_sessions(supabase: Client, *, days_back: int = 30) -> list[dict]:
    user_id = get_user_id(supabase)
    cutoff = (date.today() - timedelta(days=days_back)).isoformat()
    sess_res = (
        supabase.table(config.TABLE_PROMETHEUS_SESSIONS)
        .select("*")
        .eq("user_id", user_id)
        .gte("date", cutoff)
        .order("date", desc=True)
        .order("created_at", desc=True)
        .execute()
    )
    sessions = sess_res.data or []
    if not sessions:
        return []
    session_ids = [s["id"] for s in sessions]
    ex_res = (
        supabase.table(config.TABLE_PROMETHEUS_SESSION_EXES)
        .select("*")
        .in_("session_id", session_ids)
        .order("order_index")
        .execute()
    )
    by_session: dict[str, list[dict]] = {}
    for ex in ex_res.data or []:
        by_session.setdefault(ex["session_id"], []).append(ex)
    for s in sessions:
        s["exercises"] = by_session.get(s["id"], [])
    return sessions


def delete_session(supabase: Client, session_id: str) -> bool:
    """Delete a PROMETHEUS session (cascades to its exercises) and the
    matching dashboard `workout_sessions` row by (user_id, date, label).
    """
    user_id = get_user_id(supabase)
    sess_res = (
        supabase.table(config.TABLE_PROMETHEUS_SESSIONS)
        .select("id, date, label")
        .eq("id", session_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not sess_res.data:
        return False
    session = sess_res.data[0]

    del_res = (
        supabase.table(config.TABLE_PROMETHEUS_SESSIONS)
        .delete()
        .eq("id", session_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not del_res.data:
        return False

    # Mirror delete in workout_sessions: matches the label fallback used at insert.
    workout_label = session.get("label") or "Trening"
    try:
        supabase.table(config.TABLE_WORKOUTS).delete().eq(
            "user_id", user_id
        ).eq("date", session.get("date")).eq("label", workout_label).execute()
    except Exception:
        pass
    return True


def update_session(
    supabase: Client, session_id: str, payload: SessionUpdate
) -> dict:
    user_id = get_user_id(supabase)

    sess_res = (
        supabase.table(config.TABLE_PROMETHEUS_SESSIONS)
        .select("*")
        .eq("id", session_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not sess_res.data:
        return {}

    updates: dict = {}
    if payload.label is not None:
        updates["label"] = payload.label
    if payload.notes is not None:
        updates["notes"] = payload.notes
    if updates:
        supabase.table(config.TABLE_PROMETHEUS_SESSIONS).update(updates).eq(
            "id", session_id
        ).eq("user_id", user_id).execute()

    if payload.exercises is not None:
        supabase.table(config.TABLE_PROMETHEUS_SESSION_EXES).delete().eq(
            "session_id", session_id
        ).execute()
        if payload.exercises:
            ex_rows = []
            for idx, ex in enumerate(payload.exercises):
                ex_rows.append(
                    {
                        "session_id": session_id,
                        "exercise_name": ex.exercise_name,
                        "sets": [s.model_dump() for s in ex.sets],
                        "muscle_load": ex.muscle_load or {},
                        "order_index": idx,
                    }
                )
            supabase.table(config.TABLE_PROMETHEUS_SESSION_EXES).insert(
                ex_rows
            ).execute()

    return get_session_with_exercises(supabase, session_id)


def get_session_with_exercises(supabase: Client, session_id: str) -> dict:
    user_id = get_user_id(supabase)
    sess_res = (
        supabase.table(config.TABLE_PROMETHEUS_SESSIONS)
        .select("*")
        .eq("id", session_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not sess_res.data:
        return {}
    session = sess_res.data[0]
    ex_res = (
        supabase.table(config.TABLE_PROMETHEUS_SESSION_EXES)
        .select("*")
        .eq("session_id", session_id)
        .order("order_index")
        .execute()
    )
    session["exercises"] = ex_res.data or []
    return session


# ─── Recovery ─────────────────────────────────────────────────────────────────


def get_recovery_state(supabase: Client) -> RecoveryStateResponse:
    """Fetch the 7-day session window + 90-day per-exercise stats + daily_logs
    and pass the structured inputs to the pure recovery engine."""
    user_id = get_user_id(supabase)
    today = date.today()
    window_start = today - timedelta(days=7)
    history_start = today - timedelta(days=90)

    # 1. Today's stamina pool + 8-day sleep/energy window.
    log_res = (
        supabase.table(config.TABLE_DAILY_LOGS)
        .select("date, sleep_score, energy_score, stamina_pool")
        .eq("user_id", user_id)
        .gte("date", str(window_start))
        .lte("date", str(today))
        .execute()
    )
    daily_logs_sleep_energy: dict[date, tuple[int, int]] = {}
    stamina_pool = 0
    for row in log_res.data or []:
        try:
            d = date.fromisoformat(str(row["date"]))
        except (TypeError, ValueError):
            continue
        sleep = int(row.get("sleep_score") or 50)
        energy = int(row.get("energy_score") or 50)
        daily_logs_sleep_energy[d] = (sleep, energy)
        if d == today:
            stamina_pool = int(row.get("stamina_pool") or 0)

    # 2. Sessions in the 7-day fatigue window.
    sess_res = (
        supabase.table(config.TABLE_PROMETHEUS_SESSIONS)
        .select("id, date, duration_min, avg_hr")
        .eq("user_id", user_id)
        .gte("date", str(window_start))
        .lte("date", str(today))
        .execute()
    )
    sess_rows = sess_res.data or []
    if not sess_rows:
        state = engine.compute_recovery_state(
            today=today,
            sessions=[],
            history_tonnage_max_by_name={},
            history_session_count_by_name={},
            daily_logs_sleep_energy=daily_logs_sleep_energy,
            stamina_pool=stamina_pool,
        )
        return _state_to_response(state, today)

    session_dates: dict[str, date] = {}
    session_durations: dict[str, int | None] = {}
    session_avg_hr: dict[str, int | None] = {}
    for row in sess_rows:
        try:
            sd = date.fromisoformat(str(row["date"]))
        except (TypeError, ValueError):
            continue
        session_dates[row["id"]] = sd
        session_durations[row["id"]] = row.get("duration_min")
        session_avg_hr[row["id"]] = row.get("avg_hr")

    # 3. All exercises for those sessions.
    ex_res = (
        supabase.table(config.TABLE_PROMETHEUS_SESSION_EXES)
        .select("session_id, exercise_name, sets, muscle_load, order_index")
        .in_("session_id", list(session_dates.keys()))
        .order("order_index")
        .execute()
    )
    ex_by_session: dict[str, list[engine.SessionExerciseInput]] = defaultdict(list)
    for row in ex_res.data or []:
        ex_by_session[row["session_id"]].append(
            engine.SessionExerciseInput(
                exercise_name=row.get("exercise_name") or "Ćwiczenie",
                sets=row.get("sets") or [],
                muscle_load=row.get("muscle_load") or {},
            )
        )

    sessions = [
        engine.SessionInput(
            session_date=session_dates[sid],
            duration_min=session_durations[sid],
            avg_hr=session_avg_hr[sid],
            exercises=ex_by_session.get(sid, []),
        )
        for sid in session_dates
    ]

    # 4. 90-day per-exercise tonnage stats for volume_score normalisation.
    hist_sess_res = (
        supabase.table(config.TABLE_PROMETHEUS_SESSIONS)
        .select("id")
        .eq("user_id", user_id)
        .gte("date", str(history_start))
        .lte("date", str(today))
        .execute()
    )
    hist_ids = [r["id"] for r in (hist_sess_res.data or [])]
    history_max: dict[str, float] = {}
    history_count: dict[str, int] = defaultdict(int)
    if hist_ids:
        hist_ex_res = (
            supabase.table(config.TABLE_PROMETHEUS_SESSION_EXES)
            .select("exercise_name, sets")
            .in_("session_id", hist_ids)
            .execute()
        )
        for row in hist_ex_res.data or []:
            name = row.get("exercise_name") or ""
            if not name:
                continue
            tonnage = 0.0
            for s in row.get("sets") or []:
                try:
                    tonnage += float(s.get("reps", 0) or 0) * float(s.get("kg", 0.0) or 0.0)
                except (TypeError, ValueError):
                    continue
            history_count[name] += 1
            if tonnage > history_max.get(name, 0.0):
                history_max[name] = tonnage

    state = engine.compute_recovery_state(
        today=today,
        sessions=sessions,
        history_tonnage_max_by_name=history_max,
        history_session_count_by_name=dict(history_count),
        daily_logs_sleep_energy=daily_logs_sleep_energy,
        stamina_pool=stamina_pool,
    )
    return _state_to_response(state, today)


def _state_to_response(
    state: engine.RecoveryState, today: date
) -> RecoveryStateResponse:
    groups = {
        g: GroupRecoveryResponse(
            group=gr.group,
            recovery_pct=gr.recovery_pct,
            status=gr.status,
            days_since_last=gr.days_since_last,
        )
        for g, gr in state.recovery_groups.items()
    }
    return RecoveryStateResponse(
        date=today,
        recovery_fine=state.recovery_fine,
        recovery_groups=groups,
        training_recommendation=state.training_recommendation,
        stamina_pool=state.stamina_pool,
        recovery_modifier_today=state.recovery_modifier_today,
        computed_at=datetime.now(tz=UTC).isoformat(),
    )


# ─── Weekly reports ───────────────────────────────────────────────────────────


def save_weekly_report(
    supabase: Client, week_start: date, report_json: dict
) -> dict:
    user_id = get_user_id(supabase)
    record = {
        "user_id": user_id,
        "week_start": str(week_start),
        "report_json": report_json,
    }
    res = (
        supabase.table(config.TABLE_PROMETHEUS_REPORTS)
        .upsert(record, on_conflict="user_id,week_start")
        .execute()
    )
    return res.data[0] if res.data else record


def get_latest_weekly_report(
    supabase: Client, week_start: date
) -> dict | None:
    user_id = get_user_id(supabase)
    res = (
        supabase.table(config.TABLE_PROMETHEUS_REPORTS)
        .select("*")
        .eq("user_id", user_id)
        .eq("week_start", str(week_start))
        .limit(1)
        .execute()
    )
    if not res.data:
        return None
    return res.data[0]


__all__ = [
    "create_session",
    "delete_exercise",
    "delete_session",
    "get_exercise_library",
    "get_last_sets_for_exercise",
    "get_latest_weekly_report",
    "get_recovery_state",
    "get_session_with_exercises",
    "get_sessions",
    "save_weekly_report",
    "update_session",
    "upsert_exercise",
]
