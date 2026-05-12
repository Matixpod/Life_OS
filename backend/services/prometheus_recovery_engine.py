"""PROMETHEUS recovery engine — pure functions, no DB.

Deterministic scoring of muscle fatigue. All inputs are plain dataclasses /
dicts so the math is fully unit-testable without Supabase. The service
wrapper in ``prometheus_service.py`` builds these inputs from the live DB.

Algorithm (see PROMETHEUS spec):
  session_load     = volume_score · intensity_mul · type_mul
  recovery_mod     = (0.6·sleep + 0.4·energy) / 100        (0..1)
  τ_eff(muscle, s) = τ_base[group(muscle)] · (0.6 + 0.8·mod_avg_post_s)
  fatigue(muscle)  = Σ over exercises in last 7 days:
                       session_load · muscle_load[m] · exp(−Δd / τ_eff)
  recovery_pct(m)  = max(0, 100 − fatigue·100)
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Literal

# ─── Public types ──────────────────────────────────────────────────────────

SessionType = Literal["strength", "hypertrophy", "endurance"]
MuscleGroup = Literal[
    "legs", "back", "chest", "shoulders", "triceps",
    "core", "biceps", "forearms", "rear_delt",
]
RecoveryStatus = Literal["ready", "partial", "fatigued"]
TrainingRecommendation = Literal["rest", "light", "avoid_fatigued", "train"]


# 16 MuscleKey → coarse MuscleGroup. Source of truth for the backend.
GROUP_OF: dict[str, MuscleGroup] = {
    "quads": "legs", "glutes": "legs", "hamstrings": "legs", "calves": "legs",
    "lats": "back", "traps": "back", "rhomboids": "back", "lower_back": "back",
    "chest": "chest",
    "front_delt": "shoulders",
    "triceps": "triceps",
    "abs": "core", "obliques": "core",
    "biceps": "biceps",
    "forearms": "forearms",
    "rear_delt": "rear_delt",
}

GROUP_TAU_BASE: dict[MuscleGroup, float] = {
    "legs": 2.5,
    "back": 2.0,
    "chest": 1.5,
    "shoulders": 1.5,
    "triceps": 1.5,
    "core": 1.5,
    "biceps": 1.0,
    "forearms": 1.0,
    "rear_delt": 1.0,
}


@dataclass(frozen=True)
class SessionExerciseInput:
    exercise_name: str
    sets: list[dict]                  # [{"reps": int, "kg": float}, ...]
    muscle_load: dict[str, float]     # {"chest": 0.7, ...} — values 0..1


@dataclass(frozen=True)
class SessionInput:
    session_date: date
    duration_min: int | None
    avg_hr: int | None                # reserved for v2 intensity refinement
    exercises: list[SessionExerciseInput]


@dataclass
class GroupRecovery:
    group: MuscleGroup
    recovery_pct: int
    status: RecoveryStatus
    days_since_last: int


@dataclass
class RecoveryState:
    recovery_fine: dict[str, int] = field(default_factory=dict)
    recovery_groups: dict[MuscleGroup, GroupRecovery] = field(default_factory=dict)
    training_recommendation: TrainingRecommendation = "train"
    stamina_pool: int = 0
    recovery_modifier_today: float = 0.5
    computed_at: str = ""


# ─── Pure helpers ──────────────────────────────────────────────────────────


def compute_recovery_modifier(*, sleep: int, energy: int) -> float:
    """0.6·sleep + 0.4·energy, normalised to 0..1."""
    return (0.6 * sleep + 0.4 * energy) / 100.0


def compute_tau_effective(tau_base: float, *, modifier_avg: float) -> float:
    """τ_eff = τ_base · (0.6 + 0.8 · modifier_avg). 0 → ×0.6, 0.5 → ×1.0, 1.0 → ×1.4."""
    return tau_base * (0.6 + 0.8 * modifier_avg)


def infer_exercise_type(*, avg_reps: float) -> SessionType:
    """Heuristic: ≤6 reps → strength, 7-15 → hypertrophy, >15 → endurance."""
    if avg_reps <= 6:
        return "strength"
    if avg_reps <= 15:
        return "hypertrophy"
    return "endurance"


def type_multiplier(t: SessionType) -> float:
    return {"strength": 1.3, "hypertrophy": 1.0, "endurance": 0.7}[t]


def compute_volume_score(
    *, tonnage: float, history_count: int, history_max: float
) -> float:
    """Per-exercise 90-day normalisation. Falls back to 0.5 if <3 history sessions
    or if history_max is 0 (degenerate)."""
    if history_count < 3 or history_max <= 0:
        return 0.5
    return min(1.0, tonnage / history_max)


def recovery_status_for_pct(pct: float) -> RecoveryStatus:
    if pct >= 85:
        return "ready"
    if pct >= 60:
        return "partial"
    return "fatigued"


def training_recommendation(
    *, stamina_pool: int, any_fatigued: bool
) -> TrainingRecommendation:
    if stamina_pool < 120:
        return "rest"
    if stamina_pool < 240:
        return "light"
    if any_fatigued:
        return "avoid_fatigued"
    return "train"


# ─── Internal: per-exercise tonnage + avg reps ─────────────────────────────


def _tonnage_and_avg_reps(sets: list[dict]) -> tuple[float, float]:
    total_tonnage = 0.0
    rep_count = 0
    total_reps = 0
    for s in sets or []:
        try:
            reps = int(s.get("reps", 0) or 0)
            kg = float(s.get("kg", 0.0) or 0.0)
        except (TypeError, ValueError):
            continue
        total_tonnage += reps * kg
        total_reps += reps
        rep_count += 1
    avg_reps = total_reps / rep_count if rep_count > 0 else 0.0
    return total_tonnage, avg_reps


# ─── Main entry point ──────────────────────────────────────────────────────


def compute_recovery_state(
    *,
    today: date,
    sessions: list[SessionInput],
    history_tonnage_max_by_name: dict[str, float],
    history_session_count_by_name: dict[str, int],
    daily_logs_sleep_energy: dict[date, tuple[int, int]],
    stamina_pool: int,
) -> RecoveryState:
    """Compute the full recovery state from already-fetched DB inputs.

    Args:
        today: anchor date (UTC date of "now").
        sessions: training sessions inside the 7-day window
                  ``today − 7 ≤ session_date ≤ today``.
        history_tonnage_max_by_name: per-exercise 90-day max tonnage.
        history_session_count_by_name: per-exercise count of sessions in the
                                       last 90 days (used for fallback gate).
        daily_logs_sleep_energy: ``{date: (sleep_score, energy_score)}`` for
                                 the 8-day window today−7..today inclusive.
                                 Missing keys default to (50, 50).
        stamina_pool: today's stamina_pool from ``daily_logs``.
    """
    today_sleep, today_energy = daily_logs_sleep_energy.get(today, (50, 50))
    today_modifier = compute_recovery_modifier(sleep=today_sleep, energy=today_energy)

    fatigue_by_muscle: dict[str, float] = {}
    last_trained_by_muscle: dict[str, date] = {}

    for session in sessions:
        delta_days = (today - session.session_date).days
        if delta_days < 0 or delta_days > 7:
            continue

        # Average modifier of the days *following* the session (inclusive of today).
        # Per spec: "τ_effective is computed using the recovery_modifier of the
        # days *following* the session". For a session today, fall back to today's.
        modifiers: list[float] = []
        for d in range(1, delta_days + 1):
            day = session.session_date + timedelta(days=d)
            sleep, energy = daily_logs_sleep_energy.get(day, (50, 50))
            modifiers.append(compute_recovery_modifier(sleep=sleep, energy=energy))
        modifier_avg = sum(modifiers) / len(modifiers) if modifiers else today_modifier

        for ex in session.exercises:
            tonnage, avg_reps = _tonnage_and_avg_reps(ex.sets)
            exercise_type = infer_exercise_type(avg_reps=avg_reps)
            t_mul = type_multiplier(exercise_type)

            v_score = compute_volume_score(
                tonnage=tonnage,
                history_count=history_session_count_by_name.get(ex.exercise_name, 0),
                history_max=history_tonnage_max_by_name.get(ex.exercise_name, 0.0),
            )

            # v1: intensity_pct unavailable → fixed at 60 (spec fallback).
            intensity_mul = 0.5 + 0.5 * (60 / 100.0)  # = 0.80

            ex_load = v_score * intensity_mul * t_mul

            for muscle, share in (ex.muscle_load or {}).items():
                try:
                    share_f = max(0.0, min(1.0, float(share)))
                except (TypeError, ValueError):
                    continue
                group = GROUP_OF.get(muscle)
                if group is None:
                    continue
                tau_base = GROUP_TAU_BASE[group]
                tau_eff = compute_tau_effective(tau_base, modifier_avg=modifier_avg)
                decay = math.exp(-delta_days / tau_eff)
                contribution = ex_load * share_f * decay

                fatigue_by_muscle[muscle] = (
                    fatigue_by_muscle.get(muscle, 0.0) + contribution
                )
                prev = last_trained_by_muscle.get(muscle)
                if prev is None or session.session_date > prev:
                    last_trained_by_muscle[muscle] = session.session_date

    # Fine map: pct = clamp(0, 100 − fatigue·100). Round to int for stable API.
    recovery_fine: dict[str, int] = {
        muscle: max(0, min(100, int(round(100 - f * 100))))
        for muscle, f in fatigue_by_muscle.items()
    }

    # Coarse groups: min over fine muscles (most-fatigued dominates).
    by_group: dict[MuscleGroup, list[str]] = {}
    for muscle in recovery_fine:
        group = GROUP_OF.get(muscle)
        if group is None:
            continue
        by_group.setdefault(group, []).append(muscle)

    groups: dict[MuscleGroup, GroupRecovery] = {}
    for group, muscles in by_group.items():
        pct = min(recovery_fine[m] for m in muscles)
        last = max(
            last_trained_by_muscle[m]
            for m in muscles
            if m in last_trained_by_muscle
        )
        groups[group] = GroupRecovery(
            group=group,
            recovery_pct=pct,
            status=recovery_status_for_pct(pct),
            days_since_last=(today - last).days,
        )

    any_fatigued = any(g.status == "fatigued" for g in groups.values())

    return RecoveryState(
        recovery_fine=recovery_fine,
        recovery_groups=groups,
        training_recommendation=training_recommendation(
            stamina_pool=stamina_pool, any_fatigued=any_fatigued
        ),
        stamina_pool=stamina_pool,
        recovery_modifier_today=round(today_modifier, 2),
        computed_at="",  # populated by the service layer with isoformat()
    )


__all__ = [
    "GROUP_OF",
    "GROUP_TAU_BASE",
    "GroupRecovery",
    "MuscleGroup",
    "RecoveryState",
    "RecoveryStatus",
    "SessionExerciseInput",
    "SessionInput",
    "SessionType",
    "TrainingRecommendation",
    "compute_recovery_modifier",
    "compute_recovery_state",
    "compute_tau_effective",
    "compute_volume_score",
    "infer_exercise_type",
    "recovery_status_for_pct",
    "training_recommendation",
    "type_multiplier",
]
