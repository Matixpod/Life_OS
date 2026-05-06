"""Factory and per-agent resolver for AI providers."""

from __future__ import annotations

from supabase import Client

from .base import (
    AIProvider,
    AIProviderConfig,
    BaseAIProvider,
)
from .claude_provider import ClaudeProvider
from .deepseek_provider import DeepSeekProvider
from .gemini_provider import GeminiProvider
from .ollama_provider import OllamaProvider


class AIProviderFactory:
    """Stateless factory.

    Concrete providers are cheap to instantiate (just hold an API key /
    base URL); we create one per call instead of caching to keep the
    module side-effect free.
    """

    @staticmethod
    def get_provider(provider: AIProvider) -> BaseAIProvider:
        match provider:
            case AIProvider.CLAUDE:
                return ClaudeProvider()
            case AIProvider.GEMINI:
                return GeminiProvider()
            case AIProvider.DEEPSEEK:
                return DeepSeekProvider()
            case AIProvider.OLLAMA:
                return OllamaProvider()
        raise ValueError(f"Unknown AI provider: {provider}")

    @staticmethod
    async def get_provider_for_agent(
        agent_id: str,
        user_id: str,
        supabase: Client,
    ) -> tuple[BaseAIProvider, AIProviderConfig]:
        """Resolve preference: agent-specific → global → Claude default."""
        # Local import to avoid a circular import at module load time.
        from . import preferences_service

        pref = preferences_service.get_preference(supabase, user_id, agent_id)
        if pref is None:
            pref = preferences_service.get_preference(
                supabase, user_id, preferences_service.GLOBAL_AGENT_ID
            )
        if pref is None:
            cfg = preferences_service.get_default_config()
        else:
            cfg = AIProviderConfig(
                provider=AIProvider(pref.provider),
                model_name=pref.model_name,
                temperature=float(pref.temperature),
            )
        return AIProviderFactory.get_provider(cfg.provider), cfg


__all__ = ["AIProviderFactory"]
