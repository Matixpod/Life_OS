#!/usr/bin/env python3
"""Life OS MCP server — exposes Life OS data and actions to Claude Code."""
import json
import os
from datetime import date, timedelta
from pathlib import Path

env_path = Path(__file__).parent.parent / "backend" / ".env"
if env_path.exists():
    from dotenv import load_dotenv
    load_dotenv(env_path)

import httpx
from fastmcp import FastMCP

BASE_URL = os.getenv("LIFEOS_API_URL", "http://localhost:8000")
mcp = FastMCP("Life OS")


def api_get(path: str) -> dict:
    try:
        r = httpx.get(f"{BASE_URL}{path}", timeout=10)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        return {"error": str(e)}


def api_post(path: str, data: dict) -> dict:
    try:
        r = httpx.post(f"{BASE_URL}{path}", json=data, timeout=30)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        return {"error": str(e)}


def api_put(path: str, data: dict | None = None) -> dict:
    try:
        r = httpx.put(f"{BASE_URL}{path}", json=data or {}, timeout=15)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        return {"error": str(e)}


@mcp.tool()
def get_health() -> dict:
    """Check if the Life OS backend is running."""
    return api_get("/health")


@mcp.tool()
def get_user_profile() -> dict:
    """Get the user's profile: name, streak, system start date."""
    return api_get("/api/v1/user/profile")


@mcp.tool()
def get_today_summary() -> dict:
    """Get today's full dashboard summary across all 12 modules. Returns potential_score and status of each module."""
    today = str(date.today())
    return api_get(f"/api/v1/dashboard/daily-summary?date={today}")


@mcp.tool()
def get_summary_for_date(target_date: str) -> dict:
    """Get dashboard summary for a specific date (YYYY-MM-DD). Use to retrieve historical data."""
    return api_get(f"/api/v1/dashboard/daily-summary?date={target_date}")


@mcp.tool()
def get_last_n_days(n: int = 7) -> list:
    """Get daily summaries for the last N days. Default 7. Use for trend analysis and review generation."""
    results = []
    for i in range(n):
        d = str(date.today() - timedelta(days=i))
        results.append({"date": d, "data": api_get(f"/api/v1/dashboard/daily-summary?date={d}")})
    return results


@mcp.tool()
def log_sleep(duration_minutes: int, quality_score: int, energy_score: int, morning_mood: int) -> dict:
    """Log sleep for today. duration_minutes: total sleep. quality_score: 1-5. energy_score: 0-100. morning_mood: 2|4|5|7|10."""
    return api_post("/api/v1/sleep/log", {
        "date": str(date.today()),
        "duration_minutes": duration_minutes,
        "quality_score": quality_score,
        "energy_score": energy_score,
        "morning_mood": morning_mood,
    })


@mcp.tool()
def log_workout(workout_type: str, label: str, muscle_groups: list, duration_minutes: int) -> dict:
    """Log a workout. workout_type: strength|cardio|flexibility|sport. label: e.g. 'Push Day'. muscle_groups: list."""
    return api_post("/api/v1/workout/log", {
        "date": str(date.today()),
        "type": workout_type,
        "label": label,
        "muscle_groups": muscle_groups,
        "duration_minutes": duration_minutes,
    })


@mcp.tool()
def log_mood(mood_score: int, energy_score: int, stress_score: int, journal_text: str = "") -> dict:
    """Log mental health check-in. All scores 1-10. stress_score: 10 = max stress. journal_text optional."""
    return api_post("/api/v1/mental-health/log", {
        "date": str(date.today()),
        "mood_score": mood_score,
        "energy_score": energy_score,
        "stress_score": stress_score,
        "journal_text": journal_text,
    })


@mcp.tool()
def get_cognitive_challenge() -> dict:
    """Get today's cognitive challenge: title, difficulty, URL, timer duration, status."""
    return api_get("/api/v1/cognitive/today")


@mcp.tool()
def complete_cognitive_challenge(time_spent_seconds: int, ai_help_used: bool = False) -> dict:
    """Mark today's cognitive challenge as completed."""
    return api_post("/api/v1/cognitive/complete", {
        "date": str(date.today()),
        "time_spent_seconds": time_spent_seconds,
        "ai_help_used": ai_help_used,
    })


@mcp.tool()
def get_daily_intelligence() -> dict:
    """Get today's curated news items (3) and quote of the day. Generates fresh if not yet done."""
    return api_get("/api/v1/intelligence/today")


@mcp.tool()
def generate_weekly_review() -> dict:
    """Trigger AI generation of a weekly review. May take 15-30 seconds."""
    return api_post("/api/v1/review/generate", {"type": "weekly"})


@mcp.tool()
def get_streak_info() -> dict:
    """Get current streak count, longest streak, and recent streak history."""
    return api_get("/api/v1/user/streak")


# ─── Goals module ────────────────────────────────────────────────────────────


@mcp.tool()
def get_today_goals() -> dict:
    """Get today's task list with completion status, priorities, and life-area context."""
    return {"tasks": api_get(f"/api/v1/goals/tasks?date={date.today()}")}


@mcp.tool()
def get_active_projects() -> list:
    """Get all active projects (with life area nested). Use for planning context."""
    result = api_get("/api/v1/goals/projects?status=active")
    return result if isinstance(result, list) else []


@mcp.tool()
def generate_tomorrow_plan() -> dict:
    """Trigger the agent to generate tomorrow's task plan with justifications and how-to-start tips."""
    plan_date = str(date.today() + timedelta(days=1))
    return api_post("/api/v1/goals/plan/generate", {"date": plan_date})


@mcp.tool()
def complete_task(task_id: str) -> dict:
    """Mark a daily task as completed."""
    return api_put(f"/api/v1/goals/tasks/{task_id}/complete")


@mcp.tool()
def get_stalled_projects() -> list:
    """Get projects with no progress in 7+ days. Use for accountability/escalation."""
    result = api_get("/api/v1/goals/projects/stalled")
    return result if isinstance(result, list) else []


@mcp.resource("lifeos://today")
def today_resource() -> str:
    """Full today's dashboard — context for analyzing the user's day."""
    data = api_get(f"/api/v1/dashboard/daily-summary?date={date.today()}")
    return json.dumps(data, indent=2)


@mcp.resource("lifeos://user")
def user_resource() -> str:
    """User profile — context for personalized responses."""
    data = api_get("/api/v1/user/profile")
    return json.dumps(data, indent=2)


if __name__ == "__main__":
    mcp.run()
