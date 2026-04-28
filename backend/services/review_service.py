import json
import logging
from datetime import date as DateType
from datetime import timedelta
from typing import Literal

import anthropic
from supabase import Client

from core import config
from core.supabase_client import get_user_id

logger = logging.getLogger(__name__)


def _fetch_period(supabase: Client, user_id: str, start: DateType, end: DateType) -> dict:
    def q(table: str) -> list[dict]:
        return (
            supabase.table(table)
            .select("*")
            .eq("user_id", user_id)
            .gte("date", str(start))
            .lte("date", str(end))
            .execute()
        ).data or []

    return {
        "daily_summaries": q(config.TABLE_DAILY_SUMMARIES),
        "sleep": q(config.TABLE_SLEEP),
        "workouts": q(config.TABLE_WORKOUTS),
        "cognitive": q(config.TABLE_COGNITIVE),
        "mental_health": q(config.TABLE_MENTAL_HEALTH),
        "nutrition": q(config.TABLE_NUTRITION),
        "deep_work": q(config.TABLE_DEEP_WORK),
        "learning": q(config.TABLE_LEARNING),
    }


def generate(supabase: Client, review_type: Literal["weekly", "monthly"]) -> dict:
    user_id = get_user_id(supabase)
    today = DateType.today()
    if review_type == "weekly":
        period_start = today - timedelta(days=7)
        period_end = today
    else:
        period_start = today.replace(day=1)
        period_end = today

    data = _fetch_period(supabase, user_id, period_start, period_end)
    client = anthropic.Anthropic(api_key=config.settings.anthropic_api_key)

    review_markdown = ""
    context_snapshot = ""

    try:
        review_response = client.messages.create(
            model=config.CLAUDE_MODEL,
            max_tokens=3000,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Generate a {review_type} life review for the period "
                        f"{period_start} to {period_end}.\n\n"
                        f"Data: {json.dumps(data, default=str)}\n\n"
                        "Format as markdown with these sections:\n"
                        "## Overview\n## Achievements\n## Patterns Identified\n"
                        "## Areas of Concern\n## Goals for Next Period\n\n"
                        "Be specific, data-driven, and actionable."
                    ),
                }
            ],
        )
        review_markdown = next(
            (b.text for b in review_response.content if getattr(b, "type", None) == "text"),
            "",
        )

        compress_response = client.messages.create(
            model=config.CLAUDE_MODEL,
            max_tokens=500,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Compress this {review_type} review into a compact agent memory. "
                        "Output ONLY valid JSON, no markdown:\n"
                        '{"key_facts": [], "patterns": [], "concerns": [], '
                        '"achievements": [], "avg_metrics": {"sleep_hrs": 0, "energy": 0, '
                        '"mood": 0, "score": 0, "workout_days": 0}}\n\n'
                        f"Review to compress:\n{review_markdown}"
                    ),
                }
            ],
        )
        context_snapshot = next(
            (b.text for b in compress_response.content if getattr(b, "type", None) == "text"),
            "",
        )
    except Exception as e:
        logger.warning("Review generation via Claude failed; saving stub: %s", e)
        review_markdown = (
            f"## Overview\n\nReview for {period_start} to {period_end}. "
            "AI generation unavailable; data summary follows.\n"
        )
        context_snapshot = "{}"

    summaries = data.get("daily_summaries", [])
    scores = [d.get("potential_score", 0) for d in summaries if d.get("potential_score") is not None]
    avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0

    record = {
        "user_id": user_id,
        "type": review_type,
        "period_start": str(period_start),
        "period_end": str(period_end),
        "avg_potential_score": avg_score,
        "review_markdown": review_markdown,
        "context_snapshot": context_snapshot,
    }
    res = supabase.table(config.TABLE_REVIEWS).insert(record).execute()
    return res.data[0] if res.data else record


def list_reviews(supabase: Client, review_type: Literal["weekly", "monthly"] | None = None) -> list[dict]:
    user_id = get_user_id(supabase)
    q = (
        supabase.table(config.TABLE_REVIEWS)
        .select("*")
        .eq("user_id", user_id)
        .order("period_end", desc=True)
    )
    if review_type:
        q = q.eq("type", review_type)
    return (q.execute()).data or []
