"""Common types and abstract interface shared by every AI provider."""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field


class AIProvider(StrEnum):
    CLAUDE = "claude"
    GEMINI = "gemini"
    DEEPSEEK = "deepseek"
    OLLAMA = "ollama"


class AIMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class AIProviderConfig(BaseModel):
    provider: AIProvider
    model_name: str
    temperature: float = Field(default=0.7, ge=0.0, le=1.0)
    max_tokens: int = Field(default=2000, ge=1, le=32000)
    system_prompt: str | None = None


class ModelInfo(BaseModel):
    id: str
    name: str
    recommended: bool = False
    vram_gb: float | None = None


class ProviderHealthStatus(BaseModel):
    provider: AIProvider
    online: bool
    error_message: str | None = None


class AIProviderError(RuntimeError):
    """Surface-friendly provider error.

    Carries an HTTP-style status hint so the API layer can map cleanly
    without sniffing exception text.
    """

    def __init__(self, message: str, *, status: int = 502) -> None:
        super().__init__(message)
        self.status = status
        self.message = message


class BaseAIProvider(ABC):
    """Every concrete provider exposes the same async surface.

    Implementations must be stateless / safe to instantiate per request —
    no global mutation, no shared cursors. Health checks must never raise:
    they return a ProviderHealthStatus instead.
    """

    provider: AIProvider

    @abstractmethod
    async def complete(
        self, messages: list[AIMessage], config: AIProviderConfig
    ) -> str:
        """Non-streaming completion — returns the full text response."""

    @abstractmethod
    def stream(
        self, messages: list[AIMessage], config: AIProviderConfig
    ) -> AsyncIterator[str]:
        """Streaming completion — yields raw text chunks."""

    @abstractmethod
    async def health_check(self) -> ProviderHealthStatus:
        """Verify the provider is reachable and configured."""


__all__ = [
    "AIMessage",
    "AIProvider",
    "AIProviderConfig",
    "AIProviderError",
    "BaseAIProvider",
    "ModelInfo",
    "ProviderHealthStatus",
]
