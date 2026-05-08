from datetime import date as DateType
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

# ─── Base ─────────────────────────────────────────────────────────────────────


class BaseResponse(BaseModel):
    success: bool = True
    error: str | None = None


# ─── User ─────────────────────────────────────────────────────────────────────


class UserProfile(BaseModel):
    id: str
    name: str
    avatar_url: str | None = None
    system_start_date: DateType
    current_streak_days: int
    longest_streak_days: int


class StreakRange(BaseModel):
    start_date: DateType
    end_date: DateType | None
    length_days: int


class StreakInfo(BaseModel):
    current_streak_days: int
    longest_streak_days: int
    history: list[StreakRange]


# ─── Dashboard / module summaries ────────────────────────────────────────────


class ScoreBreakdown(BaseModel):
    goals: int = 0
    sleep: int = 0
    workout: int = 0
    cognitive: int = 0
    mental_health: int = 0
    deep_work: int = 0
    nutrition: int = 0
    learning: int = 0
    body: int = 0
    supplements: int = 0


class GoalsSummary(BaseModel):
    total: int = 0
    completed: int = 0


class SleepSummary(BaseModel):
    duration_minutes: int | None = None
    energy_score: int | None = None
    quality_score: int | None = None


class SupplementsSummary(BaseModel):
    total: int = 0
    taken: int = 0


class WorkoutSummary(BaseModel):
    completed: bool = False
    label: str | None = None
    muscle_groups: list[str] = Field(default_factory=list)


class CognitiveSummary(BaseModel):
    completed: bool = False
    title: str | None = None
    difficulty: Literal["easy", "medium", "hard"] | None = None
    ai_help_used: bool = False


class MentalHealthSummary(BaseModel):
    mood_score: int | None = None
    logged: bool = False


class BodySummary(BaseModel):
    weight_kg: float | None = None
    logged: bool = False


class NutritionSummary(BaseModel):
    meals_logged: int = 0


class DeepWorkSummary(BaseModel):
    total_minutes: int = 0


class LearningSummary(BaseModel):
    items_logged: int = 0
    avg_quiz_score: float | None = None


class IntelligenceSummary(BaseModel):
    loaded: bool = False


class ReviewSummary(BaseModel):
    last_review_date: DateType | None = None
    type: Literal["weekly", "monthly"] | None = None


class ModuleSummaries(BaseModel):
    goals: GoalsSummary
    sleep: SleepSummary
    supplements: SupplementsSummary
    workout: WorkoutSummary
    cognitive: CognitiveSummary
    mental_health: MentalHealthSummary
    body: BodySummary
    nutrition: NutritionSummary
    deep_work: DeepWorkSummary
    learning: LearningSummary
    intelligence: IntelligenceSummary
    review: ReviewSummary


class DailySummary(BaseModel):
    date: DateType
    potential_score: int = 0
    score_breakdown: ScoreBreakdown | None = None
    modules: ModuleSummaries


# ─── Sleep ────────────────────────────────────────────────────────────────────


class SleepLogRequest(BaseModel):
    date: DateType
    duration_minutes: int = Field(ge=0, le=1440)
    quality_score: int = Field(ge=1, le=5)
    energy_score: int = Field(ge=0, le=100)
    morning_mood: int = Field(ge=1, le=10)


class SleepEntry(BaseModel):
    date: DateType
    duration_minutes: int | None
    quality_score: int | None
    energy_score: int | None
    morning_mood: int | None


# ─── Cognitive ────────────────────────────────────────────────────────────────


class CognitiveChallenge(BaseModel):
    date: DateType
    type: str
    title: str | None
    external_url: str | None
    difficulty: Literal["easy", "medium", "hard"] | None
    timer_seconds: int | None
    completed: bool
    ai_help_used: bool
    time_spent_seconds: int | None = None


class CognitiveCompleteRequest(BaseModel):
    date: DateType
    time_spent_seconds: int = Field(ge=0)
    ai_help_used: bool = False


class CognitiveExplainRequest(BaseModel):
    challenge_title: str
    user_question: str


# ─── Workout ──────────────────────────────────────────────────────────────────


class WorkoutLogRequest(BaseModel):
    date: DateType
    type: Literal["strength", "cardio", "flexibility", "sport"]
    label: str
    muscle_groups: list[str] = Field(default_factory=list)
    duration_minutes: int = Field(ge=0, le=600)


# ─── Mental health ────────────────────────────────────────────────────────────


class MentalHealthLogRequest(BaseModel):
    date: DateType
    mood_score: int = Field(ge=1, le=10)
    energy_score: int = Field(ge=1, le=10)
    stress_score: int = Field(ge=1, le=10)
    journal_text: str = ""


# ─── Intelligence ─────────────────────────────────────────────────────────────


class NewsItem(BaseModel):
    title: str
    summary: str
    source_url: str
    category: Literal["health", "science", "psychology", "tech", "productivity"]


class DailyIntelligence(BaseModel):
    date: DateType
    news_items: list[NewsItem]
    quote: str
    quote_author: str
    generated_at: str | None = None


# ─── Review ───────────────────────────────────────────────────────────────────


class ReviewGenerateRequest(BaseModel):
    type: Literal["weekly", "monthly"] = "weekly"


class PeriodicReview(BaseModel):
    id: str
    type: Literal["weekly", "monthly"]
    period_start: DateType
    period_end: DateType
    avg_potential_score: float | None
    review_markdown: str
    context_snapshot: str | None
    highlights: dict[str, Any] | None = None
    created_at: str


# ─── PROMETHEUS gym module ────────────────────────────────────────────────────


class ExerciseSet(BaseModel):
    reps: int = Field(ge=0, le=200)
    kg: float = Field(ge=0.0, le=1000.0)


class ExerciseCreate(BaseModel):
    name: str
    muscle_load: dict[str, float] = Field(default_factory=dict)


class SessionExerciseCreate(BaseModel):
    exercise_name: str
    sets: list[ExerciseSet] = Field(default_factory=list)
    muscle_load: dict[str, float] = Field(default_factory=dict)


class SessionCreate(BaseModel):
    date: DateType
    label: str
    notes: str | None = None
    exercises: list[SessionExerciseCreate] = Field(default_factory=list)


class ParseExerciseRequest(BaseModel):
    text: str


class ParseExerciseResponse(BaseModel):
    exercise_name: str
    sets: list[ExerciseSet] = Field(default_factory=list)
    muscle_load: dict[str, float] = Field(default_factory=dict)
    comment: str = ""


class WeeklyReportRequest(BaseModel):
    week_start: DateType


class PrometheusMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class PrometheusChatRequest(BaseModel):
    messages: list[PrometheusMessage] = Field(default_factory=list)


class PrometheusSessionExercise(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    session_id: str
    exercise_name: str
    sets: list[ExerciseSet] = Field(default_factory=list)
    muscle_load: dict[str, float] = Field(default_factory=dict)
    order_index: int = 0


class PrometheusSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    date: DateType
    label: str
    notes: str | None = None
    created_at: str
    exercises: list[PrometheusSessionExercise] = Field(default_factory=list)


class PrometheusExercise(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    muscle_load: dict[str, float] = Field(default_factory=dict)
    created_at: str


class WeeklyReportDay(BaseModel):
    day: str
    focus: str
    exercises: list[str] = Field(default_factory=list)


class WeeklyReportPayload(BaseModel):
    summary: str = ""
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    missed_muscles: list[str] = Field(default_factory=list)
    next_week_plan: list[WeeklyReportDay] = Field(default_factory=list)
    prometheus_words: str = ""


class WeeklyReportResponse(WeeklyReportPayload):
    week_start: DateType


class SessionUpdate(BaseModel):
    label: str | None = None
    notes: str | None = None
    exercises: list[SessionExerciseCreate] | None = None


class LastSetsResponse(BaseModel):
    sets: list[ExerciseSet] = Field(default_factory=list)
