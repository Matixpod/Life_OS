"""Pydantic v2 models for the KRONOS discipline & consistency agent."""

from datetime import date as DateType
from datetime import datetime
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field, field_validator

# ─── Enums ────────────────────────────────────────────────────────────────────


class TaskCategory(StrEnum):
    VITALITY = "vitality"
    INTELLECT = "intellect"
    DISCIPLINE = "discipline"
    WEALTH = "wealth"
    CHARISMA = "charisma"
    WILLPOWER = "willpower"


class TaskStatus(StrEnum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    SKIPPED = "skipped"


AnalysisType = Literal["weekly", "category_deep_dive", "crisis_intervention"]
AnalysisStatus = Literal["complete", "incomplete"]
TrendDirection = Literal["up", "down", "stable"]


# ─── Streak ───────────────────────────────────────────────────────────────────


class StreakData(BaseModel):
    """Per-category streak state derived from daily_tasks."""

    category: TaskCategory
    current_streak: int = Field(ge=0)
    longest_streak: int = Field(ge=0)
    last_active_date: DateType | None = None
    streak_broken_on: list[DateType] = Field(default_factory=list)
    trend: TrendDirection = "stable"


# ─── Patterns ─────────────────────────────────────────────────────────────────


class PatternData(BaseModel):
    """Day-of-week and hour-of-day completion rates for a single category.

    `peak_zones` and `dead_zones` are human-readable labels such as
    `"monday_morning"` or `"friday_night"` for prompt construction.
    """

    category: TaskCategory
    by_day_of_week: dict[str, float] = Field(default_factory=dict)
    by_hour_of_day: dict[int, float] = Field(default_factory=dict)
    peak_zones: list[str] = Field(default_factory=list)
    dead_zones: list[str] = Field(default_factory=list)
    sample_size: int = Field(default=0, ge=0)
    insufficient_data: bool = False


# ─── Plan vs Execution ────────────────────────────────────────────────────────


class DailyPvE(BaseModel):
    """Per-day plan-vs-execution ratio, capped at 1.0 by definition."""

    date: DateType
    planned: int = Field(ge=0)
    completed: int = Field(ge=0)
    ratio: float = Field(ge=0.0, le=1.0)

    @field_validator("ratio")
    @classmethod
    def _cap_ratio(cls, v: float) -> float:
        if v < 0.0:
            return 0.0
        if v > 1.0:
            return 1.0
        return v


class PvEScore(BaseModel):
    """30-day execution score for a single category."""

    category: TaskCategory
    overall_ratio: float = Field(ge=0.0, le=1.0)
    daily_breakdown: list[DailyPvE] = Field(default_factory=list)
    zero_execution_days: list[DateType] = Field(default_factory=list)
    best_day: DateType | None = None
    worst_day: DateType | None = None


# ─── Aggregate context (shared with other agents) ─────────────────────────────


class KronosAlert(BaseModel):
    type: Literal["dead_zone", "streak_at_risk", "zero_execution"]
    category: TaskCategory | None = None
    message: str


class KronosContext(BaseModel):
    """Aggregated KRONOS data — the canonical interface other agents query."""

    user_id: str
    generated_at: datetime
    streaks: list[StreakData] = Field(default_factory=list)
    patterns: list[PatternData] = Field(default_factory=list)
    pve_scores: list[PvEScore] = Field(default_factory=list)
    global_consistency_score: float | None = None
    alerts: list[KronosAlert] = Field(default_factory=list)

    def to_prompt_string(self) -> str:
        """Deterministic, human-readable rendering for Claude prompts.

        Categories, days, and hours are sorted so identical input data always
        produces an identical string — this enables meaningful comparison
        between analyses generated at different times.
        """

        lines: list[str] = ["# KRONOS Context", f"generated_at: {self.generated_at.isoformat()}"]
        if self.global_consistency_score is not None:
            lines.append(f"global_consistency_score: {self.global_consistency_score:.1f}/100")
        else:
            lines.append("global_consistency_score: insufficient_data")

        # Streaks ──
        lines.append("\n## Streaks")
        for s in sorted(self.streaks, key=lambda x: x.category.value):
            last = s.last_active_date.isoformat() if s.last_active_date else "never"
            lines.append(
                f"- {s.category.value}: current={s.current_streak}d "
                f"longest={s.longest_streak}d trend={s.trend} last_active={last}"
            )
            if s.streak_broken_on:
                broken = ", ".join(d.isoformat() for d in sorted(s.streak_broken_on))
                lines.append(f"  broken_on: {broken}")

        # Patterns ──
        lines.append("\n## Patterns")
        for p in sorted(self.patterns, key=lambda x: x.category.value):
            if p.insufficient_data:
                lines.append(f"- {p.category.value}: insufficient_data (n={p.sample_size})")
                continue
            dow_parts = ", ".join(
                f"{day}={rate:.2f}"
                for day, rate in sorted(p.by_day_of_week.items())
            )
            hod_parts = ", ".join(
                f"{hour:02d}={rate:.2f}"
                for hour, rate in sorted(p.by_hour_of_day.items())
            )
            lines.append(f"- {p.category.value} (n={p.sample_size}):")
            if dow_parts:
                lines.append(f"  by_day: {dow_parts}")
            if hod_parts:
                lines.append(f"  by_hour: {hod_parts}")
            if p.peak_zones:
                lines.append(f"  peak_zones: {', '.join(sorted(p.peak_zones))}")
            if p.dead_zones:
                lines.append(f"  dead_zones: {', '.join(sorted(p.dead_zones))}")

        # PvE ──
        lines.append("\n## Plan vs Execution (30d)")
        for pve in sorted(self.pve_scores, key=lambda x: x.category.value):
            best = pve.best_day.isoformat() if pve.best_day else "—"
            worst = pve.worst_day.isoformat() if pve.worst_day else "—"
            zeros = len(pve.zero_execution_days)
            lines.append(
                f"- {pve.category.value}: overall={pve.overall_ratio:.2f} "
                f"best={best} worst={worst} zero_days={zeros}"
            )

        # Alerts ──
        if self.alerts:
            lines.append("\n## Active Alerts")
            for a in self.alerts:
                cat = f"[{a.category.value}] " if a.category else ""
                lines.append(f"- {a.type}: {cat}{a.message}")

        return "\n".join(lines)


# ─── API surfaces ─────────────────────────────────────────────────────────────


class KronosDashboard(BaseModel):
    """Combined payload returned by GET /api/v1/kronos/dashboard."""

    global_consistency_score: float | None
    streaks: list[StreakData]
    patterns: list[PatternData]
    pve_scores: list[PvEScore]
    last_analysis_at: datetime | None = None
    alerts: list[KronosAlert] = Field(default_factory=list)


class KronosAnalysis(BaseModel):
    """A single Claude-generated KRONOS report (markdown body + metadata)."""

    id: str
    analysis_text: str
    triggered_by: Literal["weekly", "category_deep_dive", "crisis_intervention", "manual"]
    focus_category: TaskCategory | None = None
    status: AnalysisStatus = "complete"
    created_at: datetime


class KronosAnalysisRequest(BaseModel):
    analysis_type: AnalysisType = "weekly"
    focus_category: TaskCategory | None = None
