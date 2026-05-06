"""AI Provider abstraction.

Unified async interface for Claude, Gemini, DeepSeek and Ollama.
Agents call `AIProviderFactory.get_provider_for_agent(agent_id, user_id, supabase)`
and never branch on provider type themselves.
"""

from .base import (
    AIMessage,
    AIProvider,
    AIProviderConfig,
    AIProviderError,
    BaseAIProvider,
    ModelInfo,
    ProviderHealthStatus,
)
from .factory import AIProviderFactory
from .preferences_service import (
    AVAILABLE_MODELS,
    DEFAULT_MODEL_PER_PROVIDER,
    GLOBAL_AGENT_ID,
    AIModelPreference,
    check_all_health,
    check_provider_health,
    get_available_models,
    get_default_config,
    get_preference,
    list_preferences,
    set_preference,
)

__all__ = [
    "AIMessage",
    "AIProvider",
    "AIProviderConfig",
    "AIProviderError",
    "AIProviderFactory",
    "AVAILABLE_MODELS",
    "AIModelPreference",
    "BaseAIProvider",
    "DEFAULT_MODEL_PER_PROVIDER",
    "GLOBAL_AGENT_ID",
    "ModelInfo",
    "ProviderHealthStatus",
    "check_all_health",
    "check_provider_health",
    "get_available_models",
    "get_default_config",
    "get_preference",
    "list_preferences",
    "set_preference",
]
