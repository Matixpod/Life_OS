"""Local Ollama provider — talks to a daemon at OLLAMA_BASE_URL."""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

import httpx

from core import config

from .base import (
    AIMessage,
    AIProvider,
    AIProviderConfig,
    AIProviderError,
    BaseAIProvider,
    ProviderHealthStatus,
)


def _to_ollama_messages(
    messages: list[AIMessage], cfg: AIProviderConfig
) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    if cfg.system_prompt:
        out.append({"role": "system", "content": cfg.system_prompt})
    for m in messages:
        out.append({"role": m.role, "content": m.content})
    return out


class OllamaProvider(BaseAIProvider):
    provider = AIProvider.OLLAMA

    def __init__(self, host: str | None = None) -> None:
        self._host = (host or config.settings.ollama_base_url).rstrip("/")

    def _client(self) -> Any:
        try:
            from ollama import AsyncClient
        except ImportError as e:  # pragma: no cover — dependency declared
            raise AIProviderError(
                "ollama package not installed.", status=500
            ) from e
        return AsyncClient(host=self._host)

    async def complete(
        self, messages: list[AIMessage], cfg: AIProviderConfig
    ) -> str:
        client = self._client()
        try:
            res = await client.chat(
                model=cfg.model_name,
                messages=_to_ollama_messages(messages, cfg),
                options={
                    "temperature": cfg.temperature,
                    "num_predict": cfg.max_tokens,
                },
                stream=False,
            )
        except Exception as e:  # noqa: BLE001
            raise self._translate(e) from e
        message = res.get("message") if isinstance(res, dict) else getattr(res, "message", None)
        if isinstance(message, dict):
            return message.get("content", "") or ""
        return getattr(message, "content", "") or ""

    async def stream(
        self, messages: list[AIMessage], cfg: AIProviderConfig
    ) -> AsyncIterator[str]:
        client = self._client()
        try:
            stream = await client.chat(
                model=cfg.model_name,
                messages=_to_ollama_messages(messages, cfg),
                options={
                    "temperature": cfg.temperature,
                    "num_predict": cfg.max_tokens,
                },
                stream=True,
            )
        except Exception as e:  # noqa: BLE001
            raise self._translate(e) from e
        async for chunk in stream:
            msg = chunk.get("message") if isinstance(chunk, dict) else getattr(chunk, "message", None)
            text: str | None = None
            if isinstance(msg, dict):
                text = msg.get("content")
            elif msg is not None:
                text = getattr(msg, "content", None)
            if text:
                yield text

    def _translate(self, e: Exception) -> AIProviderError:
        text = str(e).lower()
        if "connection" in text or "refused" in text or "not found" in text and "host" in text:
            return AIProviderError(
                f"Ollama not running at {self._host}", status=503
            )
        if "model" in text and ("not found" in text or "no such" in text):
            return AIProviderError(
                f"Model not pulled. Run: ollama pull <model>. ({e})",
                status=503,
            )
        return AIProviderError(f"Ollama error: {e}", status=502)

    async def health_check(self) -> ProviderHealthStatus:
        url = f"{self._host}/api/tags"
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.get(url)
        except httpx.RequestError as e:
            return ProviderHealthStatus(
                provider=self.provider,
                online=False,
                error_message=(
                    f"Ollama not running at {self._host} ({e.__class__.__name__})"
                ),
            )
        if res.status_code != 200:
            return ProviderHealthStatus(
                provider=self.provider,
                online=False,
                error_message=f"Ollama responded with {res.status_code}",
            )
        try:
            tags = res.json().get("models") or []
        except ValueError:
            tags = []
        if not tags:
            return ProviderHealthStatus(
                provider=self.provider,
                online=True,
                error_message=(
                    f"Ollama is up but no models pulled. "
                    f"Run: ollama pull {config.DEFAULT_OLLAMA_MODEL}"
                ),
            )
        return ProviderHealthStatus(provider=self.provider, online=True)


__all__ = ["OllamaProvider"]
