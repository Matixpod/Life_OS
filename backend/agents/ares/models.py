"""Pydantic v2 models for ARES."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field

from models.kronos import KronosContext


class VitalitySubcategory(StrEnum):
    ACTIVITY = "activity"
    NUTRITION = "nutrition"
    SLEEP = "sleep"
    HYDRATION = "hydration"


class ToneMode(StrEnum):
    PEAK = "peak"  # 80–100
    GOOD = "good"  # 60–79
    NEEDS_WORK = "needs_work"  # 40–59
    CRISIS = "crisis"  # 0–39


# Equal weights for activity/nutrition/sleep/hydration. The PROMPT specifies:
#   activity=0.35, nutrition=0.30, sleep=0.20, hydration=0.15
SUBCATEGORY_WEIGHTS: dict[VitalitySubcategory, float] = {
    VitalitySubcategory.ACTIVITY: 0.35,
    VitalitySubcategory.NUTRITION: 0.30,
    VitalitySubcategory.SLEEP: 0.20,
    VitalitySubcategory.HYDRATION: 0.15,
}

AnalysisType = Literal["weekly", "crisis", "progress", "manual"]
AnalysisStatus = Literal["complete", "incomplete"]


class SubcategoryScore(BaseModel):
    subcategory: VitalitySubcategory
    score: float = Field(ge=0.0, le=100.0)
    tasks_detected: int = Field(ge=0)
    days_active: int = Field(ge=0)
    days_analyzed: int = Field(ge=0)
    weight: float = Field(ge=0.0, le=1.0)


class AresScoreResult(BaseModel):
    user_id: str
    health_score: float = Field(ge=0.0, le=100.0)
    subcategory_scores: list[SubcategoryScore]
    score_delta: float | None = None
    tone_mode: ToneMode
    computed_at: datetime


class AresScoreHistoryPoint(BaseModel):
    date: str
    score: float | None = None


class AresAnalysis(BaseModel):
    id: str
    analysis_text: str
    health_score: float = Field(ge=0.0, le=100.0)
    score_delta: float | None = None
    analysis_type: AnalysisType
    status: AnalysisStatus
    created_at: datetime


class AresContext(BaseModel):
    """Aggregated ARES + KRONOS context — input to the AI provider."""

    user_id: str
    generated_at: datetime
    score: AresScoreResult
    kronos_context: KronosContext | None = None

    def to_prompt_string(self) -> str:
        """Deterministic, Polish-keyword text for the AI provider prompt."""
        s = self.score
        date_str = self.generated_at.date().isoformat()

        lines: list[str] = [
            f"ARES DATA SNAPSHOT — {date_str}",
            f"Health Score: {s.health_score:.1f} ({s.tone_mode.value})",
        ]
        if s.score_delta is None:
            lines.append("Score Delta: brak (pierwsza analiza)")
        else:
            sign = "+" if s.score_delta >= 0 else ""
            lines.append(f"Score Delta: {sign}{s.score_delta:.1f} vs poprzedni wynik")

        lines.append("")
        lines.append("=== SUB-CATEGORIES ===")
        ordered = sorted(s.subcategory_scores, key=lambda x: x.subcategory.value)
        labels = {
            VitalitySubcategory.ACTIVITY: "Activity ",
            VitalitySubcategory.NUTRITION: "Nutrition",
            VitalitySubcategory.SLEEP: "Sleep    ",
            VitalitySubcategory.HYDRATION: "Hydration",
        }
        for sub in ordered:
            label = labels[sub.subcategory]
            lines.append(
                f"{label}: {sub.score:.0f}% "
                f"({sub.days_active}/{sub.days_analyzed} days, "
                f"{sub.tasks_detected} tasks)"
            )

        lines.append("")
        lines.append("=== KRONOS BEHAVIORAL CONTEXT ===")
        kc = self.kronos_context
        if kc is None:
            lines.append("Brak danych KRONOS")
            return "\n".join(lines)

        vitality_streak = next(
            (st for st in kc.streaks if st.category.value == "health"), None
        )
        vitality_pve = next(
            (p for p in kc.pve_scores if p.category.value == "health"), None
        )
        vitality_pattern = next(
            (p for p in kc.patterns if p.category.value == "health"), None
        )

        if vitality_streak is not None:
            lines.append(
                f"Vitality streak: {vitality_streak.current_streak} days "
                f"(trend: {vitality_streak.trend})"
            )
        else:
            lines.append("Vitality streak: brak danych")

        if vitality_pve is not None:
            lines.append(
                f"Vitality PvE:    {vitality_pve.overall_ratio * 100:.0f}% execution"
            )
        else:
            lines.append("Vitality PvE:    brak danych")

        if vitality_pattern is not None and vitality_pattern.dead_zones:
            zones = ", ".join(sorted(vitality_pattern.dead_zones))
            lines.append(f"Dead zones:      {zones}")
        else:
            lines.append("Dead zones:      brak")

        if kc.global_consistency_score is not None:
            lines.append(
                f"Global consistency: {kc.global_consistency_score:.0f}/100"
            )

        return "\n".join(lines)


class AresDashboard(BaseModel):
    current_score: AresScoreResult
    score_history: list[AresScoreHistoryPoint] = Field(default_factory=list)
    last_analysis: AresAnalysis | None = None
    last_analysis_at: datetime | None = None


class AresAnalysisRequest(BaseModel):
    analysis_type: AnalysisType = "weekly"


class AresContextResponse(BaseModel):
    """Slimmer-than-AresContext payload for cross-agent / debugging consumers."""

    user_id: str
    generated_at: datetime
    score: AresScoreResult
    kronos_available: bool
    prompt_text: str


__all__ = [
    "AnalysisStatus",
    "AnalysisType",
    "AresAnalysis",
    "AresAnalysisRequest",
    "AresContext",
    "AresContextResponse",
    "AresDashboard",
    "AresScoreHistoryPoint",
    "AresScoreResult",
    "SUBCATEGORY_WEIGHTS",
    "SubcategoryScore",
    "ToneMode",
    "VitalitySubcategory",
]
