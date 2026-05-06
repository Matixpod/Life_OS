"""API surface for the AI Provider Selector.

Endpoints:
    GET  /ai/models                  → static catalogue of all known models
    GET  /ai/preferences             → user's preferences (one per agent)
    POST /ai/preferences/{agent_id}  → upsert preference for an agent
    GET  /ai/health                  → parallel health check on all providers
    GET  /ai/health/{provider}       → single-provider health check

Single-user codebase: `user_id` is resolved via `get_user_id(supabase)`,
matching every other router. There is no `get_current_user` dependency.
"""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from supabase import Client

from core.supabase_client import get_supabase, get_user_id
from services.ai_provider import (
    GLOBAL_AGENT_ID,
    AIModelPreference,
    AIProvider,
    AIProviderError,
    ModelInfo,
    ProviderHealthStatus,
    check_all_health,
    check_provider_health,
    get_available_models,
    list_preferences,
    set_preference,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai", tags=["ai"])


# ─── Request / response models ──────────────────────────────────────────────


class AvailableModelsResponse(BaseModel):
    claude: list[ModelInfo]
    gemini: list[ModelInfo]
    deepseek: list[ModelInfo]
    ollama: list[ModelInfo]


class SetPreferencePayload(BaseModel):
    provider: AIProvider
    model_name: str = Field(min_length=1)
    temperature: float = Field(default=0.7, ge=0.0, le=1.0)


class PreferencesResponse(BaseModel):
    preferences: list[AIModelPreference]


class HealthResponse(BaseModel):
    providers: list[ProviderHealthStatus]


# ─── Routes ─────────────────────────────────────────────────────────────────


@router.get("/models", response_model=AvailableModelsResponse)
async def get_models() -> AvailableModelsResponse:
    catalogue = get_available_models()
    return AvailableModelsResponse(
        claude=catalogue[AIProvider.CLAUDE.value],
        gemini=catalogue[AIProvider.GEMINI.value],
        deepseek=catalogue[AIProvider.DEEPSEEK.value],
        ollama=catalogue[AIProvider.OLLAMA.value],
    )


@router.get("/preferences", response_model=PreferencesResponse)
async def get_preferences(
    supabase: Annotated[Client, Depends(get_supabase)],
) -> PreferencesResponse:
    user_id = get_user_id(supabase)
    return PreferencesResponse(preferences=list_preferences(supabase, user_id))


@router.post(
    "/preferences/{agent_id}", response_model=AIModelPreference, status_code=200
)
async def post_preference(
    agent_id: str,
    payload: SetPreferencePayload,
    supabase: Annotated[Client, Depends(get_supabase)],
) -> AIModelPreference:
    if not agent_id or not agent_id.strip():
        raise HTTPException(status_code=422, detail="agent_id is required")
    user_id = get_user_id(supabase)
    try:
        return set_preference(
            supabase,
            user_id=user_id,
            agent_id=agent_id.strip(),
            provider=payload.provider,
            model_name=payload.model_name.strip(),
            temperature=payload.temperature,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except Exception as e:
        logger.exception("ai.preferences.set error")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/health", response_model=HealthResponse)
async def get_health() -> HealthResponse:
    return HealthResponse(providers=await check_all_health())


@router.get("/health/{provider}", response_model=ProviderHealthStatus)
async def get_provider_health_route(provider: AIProvider) -> ProviderHealthStatus:
    try:
        return await check_provider_health(provider)
    except AIProviderError as e:
        return ProviderHealthStatus(
            provider=provider, online=False, error_message=e.message
        )


# Convenience: the global preference exists at agent_id="global". The frontend
# can target it via POST /ai/preferences/global without any special-casing.
__all__ = ["router", "GLOBAL_AGENT_ID"]
