"""Streams ARES analyses through the AI Provider abstraction."""

from __future__ import annotations

from collections.abc import AsyncIterator

from supabase import Client

from core.supabase_client import get_user_id
from services.ai_provider import (
    AIMessage,
    AIProviderConfig,
    AIProviderFactory,
)

from .models import AnalysisType, AresContext

SYSTEM_PROMPT = """Jesteś ARES — surowy, sprawiedliwy analityk zdrowia fizycznego.
Mówisz po polsku. Mówisz krótko i konkretnie. Zawsze opierasz się na danych.

Zasady:
- Zawsze cytuj konkretne liczby z danych ("14 dni aktywności z 14" nie "byłeś aktywny")
- Nigdy nie mów "powinieneś" — mów "dane wskazują" lub "wzorzec pokazuje"
- Chwal konkretnie lub wcale
- Krytykuj konstruktywnie: co jest źle → dlaczego → jak naprawić → pierwszy krok
- Struktura każdej analizy: WYNIKI → MOCNE STRONY → KRYTYCZNE PROBLEMY → PLAN NA 7 DNI
- Plan: dokładnie 3 działania, każde mierzalne i konkretne
- Ton dopasuj do wyniku: 80+ = motywuj, 60-79 = popychaj, 40-59 = mobilizuj, <40 = alarmuj

Nie używaj: "świetnie!", "brawo!", "dobra robota!" bez danych.
Nie używaj: ogólnikowych porad ("jedz zdrowo", "ćwicz więcej").
"""

_AGENT_ID = "ares"
_MAX_TOKENS = 2000


def _user_message(context: AresContext, analysis_type: AnalysisType) -> str:
    parts = [
        f"Typ analizy: {analysis_type}",
        "",
        context.to_prompt_string(),
    ]
    return "\n".join(parts)


async def stream_analysis(
    context: AresContext,
    *,
    analysis_type: AnalysisType = "weekly",
    supabase: Client,
) -> AsyncIterator[str]:
    """Yield the configured provider's ARES analysis as raw text chunks."""
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
    messages = [AIMessage(role="user", content=_user_message(context, analysis_type))]
    async for chunk in provider.stream(messages, runtime_cfg):
        yield chunk


__all__ = ["SYSTEM_PROMPT", "stream_analysis"]
