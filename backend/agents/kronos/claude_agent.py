"""Streams KRONOS analyses from Claude.

Stateless: accepts a fully-built KronosContext and yields raw text chunks.
The router is responsible for SSE framing and persistence.
"""

from collections.abc import AsyncIterator
from typing import Literal

import anthropic

from core import config
from models.kronos import AnalysisType, KronosContext, TaskCategory

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
    model: str = config.CLAUDE_MODEL,
) -> AsyncIterator[str]:
    """Yield Claude's KRONOS analysis as raw text chunks."""
    client = anthropic.AsyncAnthropic(api_key=config.settings.anthropic_api_key)
    user_msg = _user_message(context, analysis_type, focus_category)

    async with client.messages.stream(
        model=model,
        max_tokens=_MAX_TOKENS,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_msg}],
    ) as stream:
        async for text in stream.text_stream:
            yield text


__all__ = ["SYSTEM_PROMPT", "stream_analysis"]


# Re-export for callers that prefer importing the literal alias.
AnalysisTypeLiteral = Literal["weekly", "category_deep_dive", "crisis_intervention"]
