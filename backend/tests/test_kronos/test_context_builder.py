"""Context builder semantics: deterministic prompt + global score gating."""

from datetime import UTC, date, datetime

from agents.kronos.context_builder import _global_score
from models.kronos import (
    DailyPvE,
    KronosContext,
    PatternData,
    PvEScore,
    StreakData,
    TaskCategory,
)


def _sample_context() -> KronosContext:
    return KronosContext(
        user_id="00000000-0000-0000-0000-000000000001",
        generated_at=datetime(2026, 4, 29, 8, 0, tzinfo=UTC),
        streaks=[
            StreakData(
                category=TaskCategory.HEALTH,
                current_streak=3,
                longest_streak=5,
                last_active_date=date(2026, 4, 29),
                trend="up",
            ),
            StreakData(
                category=TaskCategory.KNOWLEDGE,
                current_streak=0,
                longest_streak=4,
                last_active_date=date(2026, 4, 26),
                trend="down",
            ),
        ],
        patterns=[
            PatternData(
                category=TaskCategory.HEALTH,
                by_day_of_week={"monday": 0.8, "tuesday": 0.6},
                by_hour_of_day={7: 0.5, 8: 0.5},
                peak_zones=["monday_morning"],
                dead_zones=[],
                sample_size=20,
            ),
        ],
        pve_scores=[
            PvEScore(
                category=TaskCategory.HEALTH,
                overall_ratio=0.75,
                daily_breakdown=[
                    DailyPvE(date=date(2026, 4, 28), planned=4, completed=3, ratio=0.75)
                ],
                best_day=date(2026, 4, 28),
                worst_day=date(2026, 4, 28),
            ),
        ],
        global_consistency_score=72.5,
        alerts=[],
    )


def test_to_prompt_string_is_deterministic():
    a = _sample_context().to_prompt_string()
    b = _sample_context().to_prompt_string()
    assert a == b
    # Must include the major sections so the determinism check is meaningful.
    assert "## Streaks" in a
    assert "## Patterns" in a
    assert "## Plan vs Execution (30d)" in a


def test_global_score_is_none_when_fewer_than_three_categories_have_data():
    pves = [
        PvEScore(
            category=TaskCategory.HEALTH,
            overall_ratio=0.8,
            daily_breakdown=[
                DailyPvE(date=date(2026, 4, 28), planned=2, completed=2, ratio=1.0)
            ],
        ),
        PvEScore(
            category=TaskCategory.KNOWLEDGE,
            overall_ratio=0.5,
            daily_breakdown=[
                DailyPvE(date=date(2026, 4, 28), planned=2, completed=1, ratio=0.5)
            ],
        ),
        # 4 other categories with no daily breakdown
        PvEScore(category=TaskCategory.OTHER, overall_ratio=0.0),
        PvEScore(category=TaskCategory.WORK, overall_ratio=0.0),
        PvEScore(category=TaskCategory.RELATIONSHIPS, overall_ratio=0.0),
        PvEScore(category=TaskCategory.OTHER, overall_ratio=0.0),
    ]

    assert _global_score(pves) is None


def test_global_score_returns_value_with_three_or_more_categories():
    pves = [
        PvEScore(
            category=cat,
            overall_ratio=0.6,
            daily_breakdown=[DailyPvE(date=date(2026, 4, 28), planned=1, completed=1, ratio=0.6)],
        )
        for cat in (TaskCategory.HEALTH, TaskCategory.KNOWLEDGE, TaskCategory.OTHER)
    ]
    score = _global_score(pves)
    assert score is not None
    assert 0.0 <= score <= 100.0
