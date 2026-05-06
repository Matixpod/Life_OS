"""DB persistence + static catalogue for AI provider preferences."""

from __future__ import annotations

import asyncio
from datetime import datetime

from pydantic import BaseModel, Field
from supabase import Client

from core import config

from .base import (
    AIProvider,
    AIProviderConfig,
    ModelInfo,
    ProviderHealthStatus,
)
from .claude_provider import ClaudeProvider
from .deepseek_provider import DeepSeekProvider
from .gemini_provider import GeminiProvider
from .ollama_provider import OllamaProvider

GLOBAL_AGENT_ID = "global"


class AIModelPreference(BaseModel):
    user_id: str
    agent_id: str
    provider: AIProvider
    model_name: str
    temperature: float = Field(ge=0.0, le=1.0)
    updated_at: datetime | None = None


# ─── Static model catalogue ─────────────────────────────────────────────────
# Hand-curated; the API surfaces this as `GET /api/v1/ai/models`.

AVAILABLE_MODELS: dict[AIProvider, list[ModelInfo]] = {
    AIProvider.CLAUDE: [
        ModelInfo(
            id="claude-sonnet-4-20250514",
            name="Claude Sonnet 4.6",
            recommended=True,
        ),
        ModelInfo(
            id="claude-haiku-4-5-20251001",
            name="Claude Haiku 4.5",
        ),
        ModelInfo(id="claude-opus-4-6", name="Claude Opus 4.6"),
    ],
    AIProvider.GEMINI: [
        ModelInfo(
            id="gemini-2.0-flash",
            name="Gemini 2.0 Flash",
            recommended=True,
        ),
        ModelInfo(id="gemini-2.5-pro", name="Gemini 2.5 Pro"),
    ],
    AIProvider.DEEPSEEK: [
        ModelInfo(
            id="deepseek-chat",
            name="DeepSeek Chat",
            recommended=True,
        ),
        ModelInfo(id="deepseek-reasoner", name="DeepSeek Reasoner"),
    ],
    AIProvider.OLLAMA: [
        ModelInfo(
            id="qwen2.5:7b-instruct-q4_K_M",
            name="Qwen 2.5 7B (Recommended)",
            recommended=True,
            vram_gb=4.5,
        ),
        ModelInfo(
            id="llama3.1:8b-instruct-q4_K_M",
            name="Llama 3.1 8B",
            vram_gb=5.0,
        ),
        ModelInfo(
            id="gemma2:9b-instruct-q4_K_M",
            name="Gemma 2 9B",
            vram_gb=5.5,
        ),
        ModelInfo(
            id="qwen2.5-coder:7b-q4_K_M",
            name="Qwen 2.5 Coder 7B",
            vram_gb=4.5,
        ),
    ],
}

DEFAULT_MODEL_PER_PROVIDER: dict[AIProvider, str] = {
    AIProvider.CLAUDE: config.CLAUDE_MODEL,
    AIProvider.GEMINI: "gemini-2.0-flash",
    AIProvider.DEEPSEEK: "deepseek-chat",
    AIProvider.OLLAMA: config.DEFAULT_OLLAMA_MODEL,
}


def get_default_config() -> AIProviderConfig:
    """System default — Claude Sonnet, used when no preference is stored."""
    return AIProviderConfig(
        provider=AIProvider.CLAUDE,
        model_name=DEFAULT_MODEL_PER_PROVIDER[AIProvider.CLAUDE],
        temperature=0.7,
    )


def get_available_models() -> dict[str, list[ModelInfo]]:
    """JSON-serialisable mapping for the API."""
    return {p.value: list(models) for p, models in AVAILABLE_MODELS.items()}


# ─── DB helpers ─────────────────────────────────────────────────────────────


def _row_to_pref(row: dict) -> AIModelPreference:
    updated_at_raw = row.get("updated_at")
    updated_at: datetime | None = None
    if updated_at_raw:
        try:
            updated_at = datetime.fromisoformat(
                str(updated_at_raw).replace("Z", "+00:00")
            )
        except ValueError:
            updated_at = None
    return AIModelPreference(
        user_id=row["user_id"],
        agent_id=row["agent_id"],
        provider=AIProvider(row["provider"]),
        model_name=row["model_name"],
        temperature=float(row.get("temperature", 0.7)),
        updated_at=updated_at,
    )


def get_preference(
    supabase: Client, user_id: str, agent_id: str
) -> AIModelPreference | None:
    res = (
        supabase.table(config.TABLE_AI_MODEL_PREFERENCES)
        .select("*")
        .eq("user_id", user_id)
        .eq("agent_id", agent_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        return None
    return _row_to_pref(res.data[0])


def list_preferences(
    supabase: Client, user_id: str
) -> list[AIModelPreference]:
    res = (
        supabase.table(config.TABLE_AI_MODEL_PREFERENCES)
        .select("*")
        .eq("user_id", user_id)
        .execute()
    )
    return [_row_to_pref(r) for r in (res.data or [])]


def set_preference(
    supabase: Client,
    user_id: str,
    agent_id: str,
    provider: AIProvider,
    model_name: str,
    temperature: float = 0.7,
) -> AIModelPreference:
    """Insert or update — UNIQUE(user_id, agent_id) enforces single row."""
    if not 0.0 <= temperature <= 1.0:
        raise ValueError("temperature must be between 0.0 and 1.0")
    record = {
        "user_id": user_id,
        "agent_id": agent_id,
        "provider": provider.value,
        "model_name": model_name,
        "temperature": temperature,
    }
    res = (
        supabase.table(config.TABLE_AI_MODEL_PREFERENCES)
        .upsert(record, on_conflict="user_id,agent_id")
        .execute()
    )
    if not res.data:
        # Some Supabase versions need an explicit re-fetch after upsert.
        existing = get_preference(supabase, user_id, agent_id)
        if existing is None:
            raise RuntimeError("Failed to persist AI model preference")
        return existing
    return _row_to_pref(res.data[0])


# ─── Health checks ──────────────────────────────────────────────────────────


def _provider_for_health(provider: AIProvider):
    match provider:
        case AIProvider.CLAUDE:
            return ClaudeProvider()
        case AIProvider.GEMINI:
            return GeminiProvider()
        case AIProvider.DEEPSEEK:
            return DeepSeekProvider()
        case AIProvider.OLLAMA:
            return OllamaProvider()


async def check_provider_health(
    provider: AIProvider,
) -> ProviderHealthStatus:
    return await _provider_for_health(provider).health_check()


async def check_all_health() -> list[ProviderHealthStatus]:
    coros = [check_provider_health(p) for p in AIProvider]
    return list(await asyncio.gather(*coros))


__all__ = [
    "AIModelPreference",
    "AVAILABLE_MODELS",
    "DEFAULT_MODEL_PER_PROVIDER",
    "GLOBAL_AGENT_ID",
    "check_all_health",
    "check_provider_health",
    "get_available_models",
    "get_default_config",
    "get_preference",
    "list_preferences",
    "set_preference",
]
