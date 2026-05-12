from datetime import date, timedelta

import pytest

from services.prometheus_recovery_engine import (
    GROUP_OF,
    GROUP_TAU_BASE,
    SessionExerciseInput,
    SessionInput,
    compute_recovery_modifier,
    compute_recovery_state,
    compute_tau_effective,
    compute_volume_score,
    infer_exercise_type,
    recovery_status_for_pct,
    training_recommendation,
    type_multiplier,
)

TODAY = date(2026, 5, 12)


def _ex(name, sets, muscles):
    return SessionExerciseInput(exercise_name=name, sets=sets, muscle_load=muscles)


def test_recovery_modifier_weights_sleep_more_than_energy():
    # 100/0 → 0.60. 0/100 → 0.40. Confirms the 0.6/0.4 split.
    assert compute_recovery_modifier(sleep=100, energy=0) == pytest.approx(0.6)
    assert compute_recovery_modifier(sleep=0, energy=100) == pytest.approx(0.4)
    assert compute_recovery_modifier(sleep=50, energy=50) == pytest.approx(0.5)


def test_tau_effective_stretch_compress_range():
    base = 2.0
    assert compute_tau_effective(base, modifier_avg=0.0) == pytest.approx(1.2)
    assert compute_tau_effective(base, modifier_avg=0.5) == pytest.approx(2.0)
    assert compute_tau_effective(base, modifier_avg=1.0) == pytest.approx(2.8)


def test_infer_exercise_type_by_reps():
    assert infer_exercise_type(avg_reps=5) == "strength"
    assert infer_exercise_type(avg_reps=10) == "hypertrophy"
    assert infer_exercise_type(avg_reps=20) == "endurance"
    assert infer_exercise_type(avg_reps=6) == "strength"
    assert infer_exercise_type(avg_reps=7) == "hypertrophy"
    assert infer_exercise_type(avg_reps=15) == "hypertrophy"
    assert infer_exercise_type(avg_reps=16) == "endurance"


def test_type_multiplier_values():
    assert type_multiplier("strength") == 1.3
    assert type_multiplier("hypertrophy") == 1.0
    assert type_multiplier("endurance") == 0.7


def test_volume_score_normalises_against_per_exercise_90d_max():
    # First 3 sessions of an exercise → fallback 0.5 (per spec edge case)
    score = compute_volume_score(tonnage=400.0, history_count=2, history_max=400.0)
    assert score == 0.5
    # After 3+ sessions: ratio against max, clamped to 1.0
    score = compute_volume_score(tonnage=400.0, history_count=10, history_max=800.0)
    assert score == pytest.approx(0.5)
    score = compute_volume_score(tonnage=1200.0, history_count=10, history_max=800.0)
    assert score == 1.0
    # max == 0 (degenerate) → fallback 0.5
    assert compute_volume_score(tonnage=400.0, history_count=10, history_max=0.0) == 0.5


def test_recovery_status_thresholds():
    assert recovery_status_for_pct(90) == "ready"
    assert recovery_status_for_pct(85) == "ready"
    assert recovery_status_for_pct(84) == "partial"
    assert recovery_status_for_pct(60) == "partial"
    assert recovery_status_for_pct(59) == "fatigued"
    assert recovery_status_for_pct(0) == "fatigued"


def test_training_recommendation_priority():
    assert training_recommendation(stamina_pool=119, any_fatigued=False) == "rest"
    assert training_recommendation(stamina_pool=120, any_fatigued=True) == "light"
    assert training_recommendation(stamina_pool=239, any_fatigued=True) == "light"
    assert training_recommendation(stamina_pool=240, any_fatigued=True) == "avoid_fatigued"
    assert training_recommendation(stamina_pool=600, any_fatigued=False) == "train"


def test_group_mapping_covers_all_16_keys():
    keys = {
        "chest", "front_delt", "rear_delt", "biceps", "triceps", "forearms",
        "abs", "obliques", "traps", "lats", "rhomboids", "lower_back",
        "glutes", "quads", "hamstrings", "calves",
    }
    assert keys == set(GROUP_OF.keys())
    for group in set(GROUP_OF.values()):
        assert group in GROUP_TAU_BASE


def test_full_pipeline_with_single_session_today_legs():
    """Heavy legs today; biceps untrained should not appear; legs should be fatigued."""
    sessions = [
        SessionInput(
            session_date=TODAY,
            duration_min=60,
            avg_hr=None,
            exercises=[
                _ex(
                    "Przysiad ze sztangą",
                    sets=[{"reps": 10, "kg": 100.0}] * 3,
                    muscles={"quads": 0.7, "glutes": 0.4, "hamstrings": 0.3},
                ),
            ],
        ),
    ]
    history_max = {"Przysiad ze sztangą": 3000.0}
    history_count = {"Przysiad ze sztangą": 10}
    daily_logs = {TODAY: (70, 70)}
    stamina_pool = 360

    state = compute_recovery_state(
        today=TODAY,
        sessions=sessions,
        history_tonnage_max_by_name=history_max,
        history_session_count_by_name=history_count,
        daily_logs_sleep_energy=daily_logs,
        stamina_pool=stamina_pool,
    )

    assert "quads" in state.recovery_fine
    assert "biceps" not in state.recovery_fine

    legs = state.recovery_groups["legs"]
    assert legs.status == "fatigued"
    assert legs.days_since_last == 0

    assert state.training_recommendation == "avoid_fatigued"
    # recovery_modifier_today = (0.6×70 + 0.4×70)/100 = 0.70
    assert state.recovery_modifier_today == pytest.approx(0.70)


def test_missing_daily_log_defaults_to_50_50():
    sessions = [
        SessionInput(
            session_date=TODAY,
            duration_min=45,
            avg_hr=None,
            exercises=[_ex("Curl", [{"reps": 12, "kg": 15}], {"biceps": 0.8})],
        ),
    ]
    state = compute_recovery_state(
        today=TODAY,
        sessions=sessions,
        history_tonnage_max_by_name={"Curl": 200.0},
        history_session_count_by_name={"Curl": 10},
        daily_logs_sleep_energy={},
        stamina_pool=300,
    )
    assert state.recovery_modifier_today == pytest.approx(0.5)


def test_no_sessions_returns_empty_with_train_recommendation():
    state = compute_recovery_state(
        today=TODAY,
        sessions=[],
        history_tonnage_max_by_name={},
        history_session_count_by_name={},
        daily_logs_sleep_energy={TODAY: (60, 60)},
        stamina_pool=400,
    )
    assert state.recovery_fine == {}
    assert state.recovery_groups == {}
    assert state.training_recommendation == "train"


def test_decay_makes_old_session_negligible():
    """Heavy legs 7 days ago → quads should be back to ready."""
    sessions = [
        SessionInput(
            session_date=TODAY - timedelta(days=7),
            duration_min=60,
            avg_hr=None,
            exercises=[
                _ex(
                    "Przysiad",
                    sets=[{"reps": 10, "kg": 100.0}] * 3,
                    muscles={"quads": 0.7},
                ),
            ],
        ),
    ]
    daily_logs = {
        TODAY - timedelta(days=d): (60, 60) for d in range(8)
    }
    state = compute_recovery_state(
        today=TODAY,
        sessions=sessions,
        history_tonnage_max_by_name={"Przysiad": 3000.0},
        history_session_count_by_name={"Przysiad": 10},
        daily_logs_sleep_energy=daily_logs,
        stamina_pool=500,
    )
    assert state.recovery_fine["quads"] >= 95
    assert state.recovery_groups["legs"].status == "ready"
    assert state.recovery_groups["legs"].days_since_last == 7
