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
    duration_min: int | None = None
    avg_hr: int | None = None
    # When true (default), saving the session also upserts a reusable
    # workout template under `label`. The UI uses this to honour the
    # "Save workout requires a name" UX.
    save_as_template: bool = True


# ─── Workout templates ────────────────────────────────────────────────────────


class WorkoutTemplateExerciseInput(BaseModel):
    exercise_name: str
    order_index: int = 0
    target_sets: int = Field(ge=1, le=50, default=3)
    muscle_load: dict[str, float] = Field(default_factory=dict)


class WorkoutTemplateCreate(BaseModel):
    name: str
    exercises: list[WorkoutTemplateExerciseInput] = Field(default_factory=list)


class WorkoutTemplateUpdate(BaseModel):
    name: str | None = None
    exercises: list[WorkoutTemplateExerciseInput] | None = None


class WorkoutTemplateExercise(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    template_id: str
    exercise_name: str
    order_index: int = 0
    target_sets: int = 3
    muscle_load: dict[str, float] = Field(default_factory=dict)
    last_sets: list[ExerciseSet] = Field(default_factory=list)


class WorkoutTemplate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    created_at: str
    updated_at: str
    exercises: list[WorkoutTemplateExercise] = Field(default_factory=list)


class WorkoutTemplateScheduleRequest(BaseModel):
    dates: list[DateType] = Field(default_factory=list)


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


# ─── PROMETHEUS Cardio System ─────────────────────────────────────────────────

ACTIVITY_TYPES = (
    "treadmill", "running", "bike", "elliptical",
    "swimming", "rowing", "hiit", "other",
)


class CardioProfile(BaseModel):
    """User biometrics for cardio kcal formulas. Loaded from the DB row —
    extra fields (`id`, `user_id`, `updated_at`) are ignored."""

    model_config = ConfigDict(extra="ignore")
    gender: Literal["male", "female"]
    weight_kg: float
    age: int
    vo2max: float | None = None
    body_fat_pct: float | None = None


class CardioSessionParams(BaseModel):
    incline_pct: float | None = None
    speed_kmh: float | None = None
    distance_km: float | None = None
    resistance: int | None = None
    rpm: int | None = None
    pool_length_m: int | None = None
    laps: int | None = None
    notes: str | None = None


class CardioSessionCreate(BaseModel):
    date: DateType
    activity_type: str
    label: str
    duration_min: int = Field(ge=1, le=600)
    avg_hr: int | None = Field(default=None, ge=30, le=240)
    params: CardioSessionParams = Field(default_factory=CardioSessionParams)


class CardioSessionResult(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    date: str
    activity_type: str
    label: str
    duration_min: int
    avg_hr: int | None = None
    params: dict = Field(default_factory=dict)
    kcal_total: float | None = None
    kcal_epoc: float | None = None
    fat_pct: float | None = None
    carb_pct: float | None = None
    fat_kcal: float | None = None
    carb_kcal: float | None = None
    fat_grams: float | None = None
    hr_zone: str | None = None
    analysis_note: str | None = None
    created_at: str


class FatSummary(BaseModel):
    today_fat_grams: float
    week_fat_grams: float
    month_fat_grams: float
    total_fat_grams: float
    sessions_this_week: int
    # Per-source split for the current week — lets the UI show "🏃 cardio
    # X g · 🏋️ siłowo Y g" so the user can see strength is contributing.
    week_cardio_grams: float = 0.0
    week_strength_grams: float = 0.0


# ─── PROMETHEUS Recovery Engine ───────────────────────────────────────────


MuscleGroup = Literal[
    "legs", "back", "chest", "shoulders", "triceps",
    "core", "biceps", "forearms", "rear_delt",
]
MuscleRecoveryStatus = Literal["ready", "partial", "fatigued"]
TrainingRecommendation = Literal["rest", "light", "avoid_fatigued", "train"]


class GroupRecoveryResponse(BaseModel):
    group: MuscleGroup
    recovery_pct: int = Field(ge=0, le=100)
    status: MuscleRecoveryStatus
    days_since_last: int = Field(ge=0)


class RecoveryStateResponse(BaseModel):
    date: DateType
    recovery_fine: dict[str, int] = Field(default_factory=dict)
    recovery_groups: dict[MuscleGroup, GroupRecoveryResponse] = Field(default_factory=dict)
    training_recommendation: TrainingRecommendation = "train"
    stamina_pool: int = 0
    recovery_modifier_today: float = 0.5
    computed_at: str
