import json
import logging
from datetime import date as DateType

import anthropic
from supabase import Client

from core import config
from core.supabase_client import get_user_id

logger = logging.getLogger(__name__)

CURATOR_SYSTEM = """You are an intelligence curator for a high-performance individual focused on
health optimization, longevity, cognitive performance, and self-improvement.
Find 3 recent, research-backed insights on these topics.
Also select 1 powerful quote from a great thinker, philosopher, or scientist.
Return ONLY valid JSON, no markdown, no preamble:
{
  "news_items": [
    {"title": "...", "summary": "2 sentence summary", "source_url": "...", "category": "health|science|psychology|tech|productivity"}
  ],
  "quote": "...",
  "quote_author": "..."
}"""


def _fallback_payload() -> dict:
    return {
        "news_items": [
            {
                "title": "Aerobic exercise modestly improves working memory",
                "summary": (
                    "A meta-analysis of randomized controlled trials concluded that ~150 minutes "
                    "per week of moderate aerobic exercise produces small but consistent gains in "
                    "working memory and processing speed in healthy adults."
                ),
                "source_url": "https://www.nature.com/articles/s41562-019-0625-3",
                "category": "health",
            },
            {
                "title": "Sleep consistency predicts mortality independently of duration",
                "summary": (
                    "Cohort data from over 60,000 adults wearing accelerometers for a week showed "
                    "that day-to-day regularity of sleep timing was a stronger predictor of "
                    "all-cause mortality than total sleep duration."
                ),
                "source_url": "https://academic.oup.com/sleep/article/46/1/zsad253",
                "category": "science",
            },
            {
                "title": "Brief mindfulness reduces stress reactivity",
                "summary": (
                    "An 8-week mindfulness intervention reduced cortisol response to acute stress "
                    "tasks. Effects appear within weeks and persist when practice continues."
                ),
                "source_url": "https://psycnet.apa.org/record/2014-25086-001",
                "category": "psychology",
            },
        ],
        "quote": "We are what we repeatedly do. Excellence, then, is not an act, but a habit.",
        "quote_author": "Will Durant",
    }


def get_or_generate(supabase: Client, target_date: DateType) -> dict:
    user_id = get_user_id(supabase)

    res = (
        supabase.table(config.TABLE_INTELLIGENCE)
        .select("*")
        .eq("user_id", user_id)
        .eq("date", str(target_date))
        .limit(1)
        .execute()
    )
    if res.data:
        return res.data[0]

    client = anthropic.Anthropic(api_key=config.settings.anthropic_api_key)
    try:
        response = client.messages.create(
            model=config.CLAUDE_MODEL,
            max_tokens=1500,
            system=CURATOR_SYSTEM,
            messages=[
                {
                    "role": "user",
                    "content": f"Generate today's ({target_date}) intelligence digest.",
                }
            ],
        )
        text = next((b.text for b in response.content if getattr(b, "type", None) == "text"), "")
        text = text.strip()
        if text.startswith("```"):
            text = text.strip("`")
            if text.startswith("json"):
                text = text[4:]
        data = json.loads(text)
    except Exception as e:
        logger.warning("Intelligence generation failed; using fallback: %s", e)
        data = _fallback_payload()

    record = {
        "user_id": user_id,
        "date": str(target_date),
        "news_items": data.get("news_items", []),
        "quote": data.get("quote", ""),
        "quote_author": data.get("quote_author", ""),
    }
    saved = (
        supabase.table(config.TABLE_INTELLIGENCE)
        .upsert(record, on_conflict="date")
        .execute()
    )
    return saved.data[0] if saved.data else record
