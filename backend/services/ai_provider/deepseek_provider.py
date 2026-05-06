"""DeepSeek provider — OpenAI-compatible REST API via httpx."""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator

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

_BASE_URL = "https://api.deepseek.com/v1"
_RETRY_DELAY_SECONDS = 2.0


def _build_messages(
    messages: list[AIMessage], cfg: AIProviderConfig
) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    if cfg.system_prompt:
        out.append({"role": "system", "content": cfg.system_prompt})
    for m in messages:
        out.append({"role": m.role, "content": m.content})
    return out


class DeepSeekProvider(BaseAIProvider):
    provider = AIProvider.DEEPSEEK

    def __init__(self, api_key: str | None = None) -> None:
        self._api_key = api_key or config.settings.deepseek_api_key

    def _headers(self) -> dict[str, str]:
        if not self._api_key:
            raise AIProviderError(
                "DEEPSEEK_API_KEY is not configured.", status=503
            )
        return {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

    async def complete(
        self, messages: list[AIMessage], cfg: AIProviderConfig
    ) -> str:
        body = {
            "model": cfg.model_name,
            "messages": _build_messages(messages, cfg),
            "temperature": cfg.temperature,
            "max_tokens": cfg.max_tokens,
            "stream": False,
        }
        headers = self._headers()
        async with httpx.AsyncClient(timeout=60.0) as client:
            for attempt in range(2):
                try:
                    res = await client.post(
                        f"{_BASE_URL}/chat/completions",
                        headers=headers,
                        json=body,
                    )
                except httpx.RequestError as e:
                    raise AIProviderError(
                        f"DeepSeek transport error: {e}", status=502
                    ) from e
                if res.status_code == 429 and attempt == 0:
                    await asyncio.sleep(_RETRY_DELAY_SECONDS)
                    continue
                if res.status_code >= 400:
                    raise AIProviderError(
                        f"DeepSeek {res.status_code}: {res.text[:200]}",
                        status=502,
                    )
                data = res.json()
                choices = data.get("choices") or []
                if not choices:
                    return ""
                return choices[0].get("message", {}).get("content", "") or ""
        return ""

    async def stream(
        self, messages: list[AIMessage], cfg: AIProviderConfig
    ) -> AsyncIterator[str]:
        body = {
            "model": cfg.model_name,
            "messages": _build_messages(messages, cfg),
            "temperature": cfg.temperature,
            "max_tokens": cfg.max_tokens,
            "stream": True,
        }
        headers = self._headers()
        async with httpx.AsyncClient(timeout=None) as client:
            for attempt in range(2):
                try:
                    async with client.stream(
                        "POST",
                        f"{_BASE_URL}/chat/completions",
                        headers=headers,
                        json=body,
                    ) as response:
                        if response.status_code == 429 and attempt == 0:
                            await response.aread()
                            await asyncio.sleep(_RETRY_DELAY_SECONDS)
                            continue  # retry outer for-loop
                        if response.status_code >= 400:
                            text = (await response.aread()).decode(
                                errors="replace"
                            )
                            raise AIProviderError(
                                f"DeepSeek {response.status_code}: {text[:200]}",
                                status=502,
                            )
                        async for line in response.aiter_lines():
                            if not line or not line.startswith("data:"):
                                continue
                            payload = line[len("data:") :].strip()
                            if payload == "[DONE]":
                                return
                            try:
                                chunk = json.loads(payload)
                            except json.JSONDecodeError:
                                continue
                            delta = (
                                (chunk.get("choices") or [{}])[0]
                                .get("delta", {})
                                .get("content")
                            )
                            if delta:
                                yield delta
                        return
                except httpx.RequestError as e:
                    raise AIProviderError(
                        f"DeepSeek transport error: {e}", status=502
                    ) from e

    async def health_check(self) -> ProviderHealthStatus:
        if not self._api_key:
            return ProviderHealthStatus(
                provider=self.provider,
                online=False,
                error_message="DEEPSEEK_API_KEY not configured",
            )
        return ProviderHealthStatus(provider=self.provider, online=True)


__all__ = ["DeepSeekProvider"]
