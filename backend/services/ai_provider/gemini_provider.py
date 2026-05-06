"""Google Gemini provider via google-generativeai."""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

from core import config

from .base import (
    AIMessage,
    AIProvider,
    AIProviderConfig,
    AIProviderError,
    BaseAIProvider,
    ProviderHealthStatus,
)


def _to_gemini_history(messages: list[AIMessage]) -> tuple[str | None, list[dict]]:
    """Returns (system_instruction, [{role, parts:[content]}, ...])."""
    system_parts: list[str] = []
    history: list[dict] = []
    for m in messages:
        if m.role == "system":
            system_parts.append(m.content)
            continue
        role = "user" if m.role == "user" else "model"
        history.append({"role": role, "parts": [m.content]})
    sys = "\n\n".join(s for s in system_parts if s) or None
    return sys, history


class GeminiProvider(BaseAIProvider):
    provider = AIProvider.GEMINI

    def __init__(self, api_key: str | None = None) -> None:
        self._api_key = api_key or config.settings.gemini_api_key

    def _import(self) -> Any:
        if not self._api_key:
            raise AIProviderError(
                "GEMINI_API_KEY is not configured.", status=503
            )
        try:
            import google.generativeai as genai
        except ImportError as e:  # pragma: no cover — dependency declared in requirements
            raise AIProviderError(
                "google-generativeai package not installed.", status=500
            ) from e
        genai.configure(api_key=self._api_key)
        return genai

    def _model(self, cfg: AIProviderConfig, system: str | None) -> Any:
        genai = self._import()
        return genai.GenerativeModel(
            model_name=cfg.model_name,
            system_instruction=cfg.system_prompt or system,
            generation_config={
                "temperature": cfg.temperature,
                "max_output_tokens": cfg.max_tokens,
            },
        )

    async def complete(
        self, messages: list[AIMessage], cfg: AIProviderConfig
    ) -> str:
        sys_msg, history = _to_gemini_history(messages)
        model = self._model(cfg, sys_msg)
        try:
            res = await model.generate_content_async(history)
        except Exception as e:  # noqa: BLE001 — provider exception surface is wide
            raise self._translate(e) from e
        text = getattr(res, "text", None)
        return text or ""

    async def stream(
        self, messages: list[AIMessage], cfg: AIProviderConfig
    ) -> AsyncIterator[str]:
        sys_msg, history = _to_gemini_history(messages)
        model = self._model(cfg, sys_msg)
        try:
            stream = await model.generate_content_async(history, stream=True)
            async for chunk in stream:
                text = getattr(chunk, "text", None)
                if text:
                    yield text
        except Exception as e:  # noqa: BLE001
            raise self._translate(e) from e

    @staticmethod
    def _translate(e: Exception) -> AIProviderError:
        name = type(e).__name__
        if "Blocked" in name or "Safety" in name:
            return AIProviderError(
                "Response blocked by Gemini safety filter.", status=400
            )
        return AIProviderError(f"Gemini error: {e}", status=502)

    async def health_check(self) -> ProviderHealthStatus:
        if not self._api_key:
            return ProviderHealthStatus(
                provider=self.provider,
                online=False,
                error_message="GEMINI_API_KEY not configured",
            )
        try:
            self._import()
            return ProviderHealthStatus(provider=self.provider, online=True)
        except Exception as e:  # noqa: BLE001
            return ProviderHealthStatus(
                provider=self.provider,
                online=False,
                error_message=str(e)[:200],
            )


__all__ = ["GeminiProvider"]
