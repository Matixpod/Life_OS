from datetime import date as DateType

from supabase import Client

from core import config
from core.supabase_client import get_user_id
from models.schemas import (
    BodySummary,
    CognitiveSummary,
    DailySummary,
    DeepWorkSummary,
    GoalsSummary,
    IntelligenceSummary,
    LearningSummary,
    MentalHealthSummary,
    ModuleSummaries,
    NutritionSummary,
    ReviewSummary,
    ScoreBreakdown,
    SleepSummary,
    SupplementsSummary,
    WorkoutSummary,
)


def _row(supabase: Client, table: str, user_id: str, target_date: DateType) -> dict | None:
    res = (
        supabase.table(table)
        .select("*")
        .eq("user_id", user_id)
        .eq("date", str(target_date))
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def _rows(supabase: Client, table: str, user_id: str, target_date: DateType) -> list[dict]:
    res = (
        supabase.table(table)
        .select("*")
        .eq("user_id", user_id)
        .eq("date", str(target_date))
        .execute()
    )
    return res.data or []


def get_summary(supabase: Client, target_date: DateType) -> DailySummary:
    user_id = get_user_id(supabase)

    # daily_summaries
    summary_row = _row(supabase, config.TABLE_DAILY_SUMMARIES, user_id, target_date)
    potential_score = (summary_row or {}).get("potential_score") or 0
    score_breakdown_data = (summary_row or {}).get("score_breakdown")
    score_breakdown = ScoreBreakdown(**score_breakdown_data) if score_breakdown_data else None

    # goals
    goals = _rows(supabase, config.TABLE_GOALS, user_id, target_date)
    goals_sum = GoalsSummary(total=len(goals), completed=sum(1 for g in goals if g.get("completed")))

    # sleep
    sleep_row = _row(supabase, config.TABLE_SLEEP, user_id, target_date)
    sleep_sum = SleepSummary(
        duration_minutes=(sleep_row or {}).get("duration_minutes"),
        energy_score=(sleep_row or {}).get("energy_score"),
        quality_score=(sleep_row or {}).get("quality_score"),
    )

    # supplements: count active items + how many taken today
    items = (
        supabase.table(config.TABLE_SUPPLEMENT_ITEMS)
        .select("id")
        .eq("user_id", user_id)
        .eq("active", True)
        .execute()
    ).data or []
    logs_today = (
        supabase.table(config.TABLE_SUPPLEMENT_LOGS)
        .select("taken")
        .eq("user_id", user_id)
        .eq("date", str(target_date))
        .execute()
    ).data or []
    supplements_sum = SupplementsSummary(
        total=len(items), taken=sum(1 for log in logs_today if log.get("taken"))
    )

    # workout (single workout per day mental model — pick most recent)
    workout_rows = _rows(supabase, config.TABLE_WORKOUTS, user_id, target_date)
    workout_row = workout_rows[0] if workout_rows else None
    workout_sum = WorkoutSummary(
        completed=workout_row is not None,
        label=(workout_row or {}).get("label"),
        muscle_groups=(workout_row or {}).get("muscle_groups") or [],
    )

    # cognitive
    cog_row = _row(supabase, config.TABLE_COGNITIVE, user_id, target_date)
    cog_sum = CognitiveSummary(
        completed=bool((cog_row or {}).get("completed", False)),
        title=(cog_row or {}).get("title"),
        difficulty=(cog_row or {}).get("difficulty"),
        ai_help_used=bool((cog_row or {}).get("ai_help_used", False)),
    )

    # mental health
    mh_row = _row(supabase, config.TABLE_MENTAL_HEALTH, user_id, target_date)
    mh_sum = MentalHealthSummary(
        mood_score=(mh_row or {}).get("mood_score"), logged=mh_row is not None
    )

    # body (most recent on date)
    body_rows = _rows(supabase, config.TABLE_BODY, user_id, target_date)
    body_row = body_rows[0] if body_rows else None
    body_weight = None
    if body_row and body_row.get("weight_kg") is not None:
        body_weight = float(body_row["weight_kg"])
    body_sum = BodySummary(weight_kg=body_weight, logged=body_row is not None)

    # nutrition
    nutrition_rows = _rows(supabase, config.TABLE_NUTRITION, user_id, target_date)
    nutrition_sum = NutritionSummary(meals_logged=len(nutrition_rows))

    # deep work
    dw_rows = _rows(supabase, config.TABLE_DEEP_WORK, user_id, target_date)
    dw_sum = DeepWorkSummary(total_minutes=sum(r.get("duration_minutes") or 0 for r in dw_rows))

    # learning
    learn_rows = _rows(supabase, config.TABLE_LEARNING, user_id, target_date)
    quiz_scores = [r["quiz_score"] for r in learn_rows if r.get("quiz_score") is not None]
    avg_quiz = sum(quiz_scores) / len(quiz_scores) if quiz_scores else None
    learn_sum = LearningSummary(items_logged=len(learn_rows), avg_quiz_score=avg_quiz)

    # intelligence
    intel_row = _row(supabase, config.TABLE_INTELLIGENCE, user_id, target_date)
    intel_sum = IntelligenceSummary(loaded=intel_row is not None)

    # review (latest)
    review_res = (
        supabase.table(config.TABLE_REVIEWS)
        .select("type,period_end,created_at")
        .eq("user_id", user_id)
        .order("period_end", desc=True)
        .limit(1)
        .execute()
    )
    last_review = review_res.data[0] if review_res.data else None
    review_sum = ReviewSummary(
        last_review_date=(last_review or {}).get("period_end"),
        type=(last_review or {}).get("type"),
    )

    return DailySummary(
        date=target_date,
        potential_score=potential_score,
        score_breakdown=score_breakdown,
        modules=ModuleSummaries(
            goals=goals_sum,
            sleep=sleep_sum,
            supplements=supplements_sum,
            workout=workout_sum,
            cognitive=cog_sum,
            mental_health=mh_sum,
            body=body_sum,
            nutrition=nutrition_sum,
            deep_work=dw_sum,
            learning=learn_sum,
            intelligence=intel_sum,
            review=review_sum,
        ),
    )
