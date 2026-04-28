from collections.abc import AsyncGenerator
from datetime import date as DateType

import anthropic
from supabase import Client

from core import config
from core.supabase_client import get_user_id
from models.schemas import CognitiveChallenge, CognitiveCompleteRequest

SYSTEM_PROMPT = (
    "You are a patient CS and math tutor. The user attempted a coding/algorithm "
    "challenge and their timer expired. Guide them toward understanding using the "
    "Socratic method. Ask questions that lead to insights. Reveal one concept at a "
    "time. Never provide the complete solution directly. Foster genuine understanding."
)


def get_today(supabase: Client, target_date: DateType) -> CognitiveChallenge | None:
    user_id = get_user_id(supabase)
    res = (
        supabase.table(config.TABLE_COGNITIVE)
        .select("*")
        .eq("user_id", user_id)
        .eq("date", str(target_date))
        .limit(1)
        .execute()
    )
    if not res.data:
        return None
    row = res.data[0]
    return CognitiveChallenge(
        date=row["date"],
        type=row["type"],
        title=row.get("title"),
        external_url=row.get("external_url"),
        difficulty=row.get("difficulty"),
        timer_seconds=row.get("timer_seconds"),
        completed=bool(row.get("completed", False)),
        ai_help_used=bool(row.get("ai_help_used", False)),
        time_spent_seconds=row.get("time_spent_seconds"),
    )


def complete(supabase: Client, payload: CognitiveCompleteRequest) -> dict:
    user_id = get_user_id(supabase)
    update = {
        "completed": True,
        "time_spent_seconds": payload.time_spent_seconds,
        "ai_help_used": payload.ai_help_used,
    }
    res = (
        supabase.table(config.TABLE_COGNITIVE)
        .update(update)
        .eq("user_id", user_id)
        .eq("date", str(payload.date))
        .execute()
    )
    return res.data[0] if res.data else update


async def stream_explanation(challenge_title: str, user_question: str) -> AsyncGenerator[str, None]:
    client = anthropic.Anthropic(api_key=config.settings.anthropic_api_key)
    user_msg = f"Challenge: {challenge_title}\n\nQuestion: {user_question}"
    with client.messages.stream(
        model=config.CLAUDE_MODEL,
        max_tokens=1000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_msg}],
    ) as stream:
        for text in stream.text_stream:
            yield text
