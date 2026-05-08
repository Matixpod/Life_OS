from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    supabase_url: str
    supabase_key: str
    anthropic_api_key: str
    gemini_api_key: str = ""
    deepseek_api_key: str = ""
    ollama_base_url: str = "http://localhost:11434"

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

# AI provider abstraction
TABLE_AI_MODEL_PREFERENCES = "ai_model_preferences"
TABLE_ARES_SCORES = "ares_scores"
TABLE_ARES_ANALYSES = "ares_analyses"

DEFAULT_OLLAMA_MODEL = "qwen2.5:7b-instruct-q4_K_M"

# Daily System (migration 009)
TABLE_DAILY_LOGS = "daily_logs"
TABLE_STAMINA_BOOSTS = "stamina_boosts"

# PROMETHEUS gym module (migration 020)
TABLE_PROMETHEUS_EXERCISES = "prometheus_exercises"
TABLE_PROMETHEUS_SESSIONS = "prometheus_sessions"
TABLE_PROMETHEUS_SESSION_EXES = "prometheus_session_exercises"
TABLE_PROMETHEUS_REPORTS = "prometheus_reports"
