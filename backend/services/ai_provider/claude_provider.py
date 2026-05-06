"""Claude (Anthropic) provider — wraps the existing async SDK."""

from __future__ import annotations

from collections.abc import AsyncIterator

import anthropic

from core import config

from .base import (
    AIMessage,
    AIProvider,
    AIProviderConfig,
    AIProviderError,
    BaseAIProvider,
    ProviderHealthStatus,
)


def _split_system(messages: list[AIMessage]) -> tuple[str | None, list[AIMessage]]:
    """Anthropic API takes `system` as a top-level field, not as a role."""
    system_parts: list[str] = []
    rest: list[AIMessage] = []
    for m in messages:
        if m.role == "system":
            system_parts.append(m.content)
        else:
            rest.append(m)
    sys = "\n\n".join(s for s in system_parts if s) or None
    return sys, rest


class ClaudeProvider(BaseAIProvider):
    provider = AIProvider.CLAUDE

    def __init__(self, api_key: str | None = None) -> None:
        self._api_key = api_key or config.settings.anthropic_api_key

    def _client(self) -> anthropic.AsyncAnthropic:
        if not self._api_key:
            raise AIProviderError(
                "ANTHROPIC_API_KEY is not configured.", status=503
            )
        return anthropic.AsyncAnthropic(api_key=self._api_key)

    async def complete(
        self, messages: list[AIMessage], cfg: AIProviderConfig
    ) -> str:
        client = self._client()
        sys_msg, rest = _split_system(messages)
        system = cfg.system_prompt or sys_msg
        try:
            res = await client.messages.create(
                model=cfg.model_name,
                max_tokens=cfg.max_tokens,
                temperature=cfg.temperature,
                system=system or anthropic.NOT_GIVEN,
                messages=[{"role": m.role, "content": m.content} for m in rest],
            )
        except anthropic.APIError as e:
            raise AIProviderError(f"Claude API error: {e}", status=502) from e
        return "".join(b.text for b in res.content if b.type == "text")

    async def stream(
        self, messages: list[AIMessage], cfg: AIProviderConfig
    ) -> AsyncIterator[str]:
        client = self._client()
        sys_msg, rest = _split_system(messages)
        system = cfg.system_prompt or sys_msg
        try:
            async with client.messages.stream(
                model=cfg.model_name,
                max_tokens=cfg.max_tokens,
                temperature=cfg.temperature,
                system=system or anthropic.NOT_GIVEN,
                messages=[{"role": m.role, "content": m.content} for m in rest],
            ) as stream:
                async for text in stream.text_stream:
                    yield text
        except anthropic.APIError as e:
            raise AIProviderError(f"Claude API error: {e}", status=502) from e

    async def health_check(self) -> ProviderHealthStatus:
        if not self._api_key:
            return ProviderHealthStatus(
                provider=self.provider,
                online=False,
                error_message="ANTHROPIC_API_KEY not configured",
            )
        try:
            client = self._client()
            await client.messages.create(
                model=config.CLAUDE_MODEL,
                max_tokens=8,
                messages=[{"role": "user", "content": "ping"}],
            )
            return ProviderHealthStatus(provider=self.provider, online=True)
        except Exception as e:  # noqa: BLE001 — health check must not raise
            return ProviderHealthStatus(
                provider=self.provider,
                online=False,
                error_message=str(e)[:200],
            )


__all__ = ["ClaudeProvider"]
