from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    supabase_url: str
    supabase_key: str
    anthropic_api_key: str

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()


# Table name constants — never hardcode strings elsewhere.
TABLE_USERS = "users"
TABLE_DAILY_SUMMARIES = "daily_summaries"
TABLE_GOALS = "goals"
TABLE_SLEEP = "sleep_entries"
TABLE_SUPPLEMENT_ITEMS = "supplement_items"
TABLE_SUPPLEMENT_LOGS = "supplement_logs"
TABLE_WORKOUTS = "workout_sessions"
TABLE_COGNITIVE = "cognitive_challenges"
TABLE_MENTAL_HEALTH = "mental_health_logs"
TABLE_BODY = "body_metrics"
TABLE_NUTRITION = "nutrition_logs"
TABLE_DEEP_WORK = "deep_work_sessions"
TABLE_LEARNING = "learning_logs"
TABLE_INTELLIGENCE = "daily_intelligence"
TABLE_REVIEWS = "periodic_reviews"
TABLE_AGENT_MEMORIES = "agent_memories"
TABLE_STREAKS = "streak_history"
TABLE_LIFE_AREAS = "life_areas"
TABLE_PROJECTS = "projects"
TABLE_DAILY_TASKS = "daily_tasks"
TABLE_DAILY_PLANS = "daily_plans"
TABLE_KRONOS_STREAKS = "kronos_streaks"
TABLE_KRONOS_PATTERNS = "kronos_patterns"
TABLE_KRONOS_SNAPSHOTS = "kronos_snapshots"
TABLE_KRONOS_ANALYSES = "kronos_analyses"

CLAUDE_MODEL = "claude-sonnet-4-20250514"
