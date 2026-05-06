"""Streams KRONOS analyses through the AI Provider abstraction.

Stateless: accepts a fully-built KronosContext and yields raw text chunks.
The router is responsible for SSE framing and persistence.

The provider (Claude / Gemini / DeepSeek / Ollama) is resolved per-user from
`ai_model_preferences`. Agent logic — the system prompt and message
construction — is unchanged from the original Claude-only implementation.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Literal

from supabase import Client

from core.supabase_client import get_user_id
from models.kronos import AnalysisType, KronosContext, TaskCategory
from services.ai_provider import (
    AIMessage,
    AIProviderConfig,
    AIProviderFactory,
)

SYSTEM_PROMPT = """You are KRONOS, a cold and precise discipline analyst. You speak in data, not opinions.
You have access to the user's complete behavioral history across all life domains.
Your job: identify patterns, name what's working, call out what isn't — with evidence.

Rules:
- Always cite specific numbers from the data
- Never say "you should" — say "the data shows" or "the pattern indicates"
- Structure every analysis: STRENGTHS → CRITICAL PATTERNS → DEAD ZONES → THIS WEEK'S DIRECTIVE
- Keep each section to 3–5 bullet points
- End with exactly 3 specific, measurable actions for the next 7 days
- Tone: respectful, direct, no filler phrases"""

_MAX_TOKENS = 2000
_AGENT_ID = "kronos"


def _user_message(
    context: KronosContext,
    analysis_type: AnalysisType,
    focus_category: TaskCategory | None,
) -> str:
    parts: list[str] = [f"Analysis type: {analysis_type}"]
    if focus_category:
        parts.append(f"Focus category: {focus_category.value}")
    parts.append("")
    parts.append(context.to_prompt_string())
    return "\n".join(parts)


async def stream_analysis(
    context: KronosContext,
    analysis_type: AnalysisType = "weekly",
    focus_category: TaskCategory | None = None,
    *,
    supabase: Client,
) -> AsyncIterator[str]:
    """Yield the configured provider's KRONOS analysis as raw text chunks."""
    user_id = get_user_id(supabase)
    provider, cfg = await AIProviderFactory.get_provider_for_agent(
        agent_id=_AGENT_ID, user_id=user_id, supabase=supabase
    )
    runtime_cfg = AIProviderConfig(
        provider=cfg.provider,
        model_name=cfg.model_name,
        temperature=cfg.temperature,
        max_tokens=_MAX_TOKENS,
        system_prompt=SYSTEM_PROMPT,
    )
    user_msg = _user_message(context, analysis_type, focus_category)
    messages = [AIMessage(role="user", content=user_msg)]
    async for chunk in provider.stream(messages, runtime_cfg):
        yield chunk


__all__ = ["SYSTEM_PROMPT", "stream_analysis"]


# Re-export for callers that prefer importing the literal alias.
AnalysisTypeLiteral = Literal["weekly", "category_deep_dive", "crisis_intervention"]
