"""PROMETHEUS — Polish strength coach AI agent.

All AI calls go through the AIProvider abstraction so the user can switch
between Claude / Gemini / DeepSeek / Ollama from settings.
"""

from __future__ import annotations

import json
import re
from collections.abc import AsyncIterator

from supabase import Client

from core.supabase_client import get_user_id
from models.schemas import ExerciseSet, ParseExerciseResponse
from services.ai_provider import (
    AIMessage,
    AIProviderConfig,
    AIProviderFactory,
)

_AGENT_ID = "prometheus"

SYSTEM_PROMPT = (
    "Jesteś PROMETHEUS — tytaniczny trener siłowy, bóg ognia i kuźni. "
    "Mówisz po polsku z pewnością i precyzją boga. Jesteś merytoryczny, "
    "konkretny i inspirujący. Nigdy nie przekraczasz 200 słów w odpowiedzi."
)

_MUSCLE_KEYS = [
    "chest", "front_delt", "rear_delt", "biceps", "triceps", "forearms",
    "abs", "obliques", "traps", "lats", "rhomboids", "lower_back",
    "glutes", "quads", "hamstrings", "calves",
]

_PARSE_PROMPT = (
    "Otrzymujesz opis ćwiczenia siłowego po polsku w surowej formie. "
    "Zwróć WYŁĄCZNIE poprawny JSON (bez ``` i bez komentarzy) o strukturze:\n"
    "{\n"
    '  "name": "kanoniczna nazwa ćwiczenia po polsku",\n'
    '  "sets": [{"reps": int, "kg": float}, ...],\n'
    '  "muscle_load": {"<muscle_key>": 0.0-1.0, ...},\n'
    '  "comment": "jedno zdanie po polsku w stylu PROMETHEUS"\n'
    "}\n\n"
    f"Dozwolone muscle_key (i tylko te): {', '.join(_MUSCLE_KEYS)}.\n"
    "Wartości muscle_load to względne obciążenie 0.0–1.0 — główne mięśnie 0.6–1.0, "
    "pomocnicze 0.1–0.3. Suma nie musi się sumować do 1.\n"
    "Jeśli waga nie podana, ustaw kg na 0. Jeśli powtórzeń nie podano, ustaw reps na 0.\n"
    "Komentarz: krótki, konkretny, motywujący — maksymalnie 20 słów."
)


def _strip_fences(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```[a-zA-Z]*\n?", "", cleaned)
        cleaned = re.sub(r"\n?```$", "", cleaned)
    match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
    if match:
        cleaned = match.group(0)
    return cleaned.strip()


async def _resolve_provider(supabase: Client, *, max_tokens: int = 800):
    user_id = get_user_id(supabase)
    provider, cfg = await AIProviderFactory.get_provider_for_agent(
        agent_id=_AGENT_ID, user_id=user_id, supabase=supabase
    )
    runtime_cfg = AIProviderConfig(
        provider=cfg.provider,
        model_name=cfg.model_name,
        temperature=cfg.temperature,
        max_tokens=max_tokens,
        system_prompt=SYSTEM_PROMPT,
    )
    return provider, runtime_cfg


# ─── parse_exercise ───────────────────────────────────────────────────────────


async def parse_exercise(
    text: str, supabase: Client
) -> ParseExerciseResponse:
    provider, cfg = await _resolve_provider(supabase, max_tokens=600)
    user_msg = f"{_PARSE_PROMPT}\n\nOpis:\n{text.strip()}"
    messages = [AIMessage(role="user", content=user_msg)]
    raw = await provider.complete(messages, cfg)
    parsed = _coerce_parse_response(raw)
    return parsed


def _coerce_parse_response(raw: str) -> ParseExerciseResponse:
    cleaned = _strip_fences(raw)
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        return ParseExerciseResponse(
            exercise_name=cleaned[:80] or "Ćwiczenie",
            sets=[],
            muscle_load={},
            comment="Nie udało się odczytać odpowiedzi modelu — uzupełnij ręcznie.",
        )

    sets_raw = data.get("sets") or []
    sets: list[ExerciseSet] = []
    for s in sets_raw:
        try:
            sets.append(
                ExerciseSet(
                    reps=int(s.get("reps", 0) or 0),
                    kg=float(s.get("kg", 0.0) or 0.0),
                )
            )
        except (TypeError, ValueError):
            continue

    muscle_load_raw = data.get("muscle_load") or {}
    muscle_load: dict[str, float] = {}
    for key, value in muscle_load_raw.items():
        if key not in _MUSCLE_KEYS:
            continue
        try:
            muscle_load[key] = max(0.0, min(1.0, float(value)))
        except (TypeError, ValueError):
            continue

    return ParseExerciseResponse(
        exercise_name=str(data.get("name") or "Ćwiczenie").strip(),
        sets=sets,
        muscle_load=muscle_load,
        comment=str(data.get("comment") or "").strip(),
    )


# ─── chat ─────────────────────────────────────────────────────────────────────


def _summarise_sessions_for_context(sessions: list[dict]) -> str:
    if not sessions:
        return "(Brak treningów w ostatnich 14 dniach.)"
    lines: list[str] = []
    for s in sessions[:14]:
        ex_names = [
            e.get("exercise_name", "?")
            for e in (s.get("exercises") or [])
        ]
        lines.append(
            f"- {s.get('date', '?')} · {s.get('label') or 'trening'}"
            f" · {len(ex_names)} ćw: {', '.join(ex_names) or '—'}"
        )
    return "\n".join(lines)


async def chat_stream(
    messages: list[dict],
    session_history: list[dict],
    supabase: Client,
) -> AsyncIterator[str]:
    provider, cfg = await _resolve_provider(supabase, max_tokens=600)

    history_block = _summarise_sessions_for_context(session_history)
    system_with_context = (
        f"{SYSTEM_PROMPT}\n\n"
        "Dane treningowe użytkownika z ostatnich dni:\n"
        f"{history_block}\n\n"
        "Odpowiadaj zwięźle, opieraj się na tych danych jeśli pasują do pytania."
    )
    cfg = AIProviderConfig(
        provider=cfg.provider,
        model_name=cfg.model_name,
        temperature=cfg.temperature,
        max_tokens=cfg.max_tokens,
        system_prompt=system_with_context,
    )

    ai_messages = [
        AIMessage(role=m["role"], content=str(m.get("content", "")))
        for m in messages
        if m.get("role") in ("user", "assistant")
    ]
    if not ai_messages:
        return

    async for chunk in provider.stream(ai_messages, cfg):
        yield chunk


# ─── weekly report ────────────────────────────────────────────────────────────


_REPORT_PROMPT = (
    "Przeanalizuj treningi użytkownika z ostatnich 7 dni i zwróć WYŁĄCZNIE poprawny JSON "
    "(bez ``` i bez komentarzy) o strukturze:\n"
    "{\n"
    '  "summary": "2-3 zdania podsumowania tygodnia",\n'
    '  "strengths": ["punkt", "punkt", ...],\n'
    '  "weaknesses": ["punkt", ...],\n'
    '  "missed_muscles": ["muscle_key", ...],\n'
    '  "next_week_plan": [\n'
    '     {"day": "Poniedziałek", "focus": "Klatka + Triceps", "exercises": ["..."]}\n'
    "  ],\n"
    '  "prometheus_words": "ognisty cytat / komenda od PROMETHEUS"\n'
    "}\n\n"
    f"missed_muscles MUSI używać tylko kluczy: {', '.join(_MUSCLE_KEYS)}.\n"
    "Plan na następny tydzień: 3-5 dni, każdy z fokusem i 3-5 ćwiczeniami.\n"
)


async def generate_weekly_report(
    sessions: list[dict], supabase: Client
) -> AsyncIterator[str]:
    """Stream raw text chunks (model emits JSON). Caller assembles + persists."""
    provider, cfg = await _resolve_provider(supabase, max_tokens=1500)
    history_block = _summarise_sessions_for_context(sessions)
    user_msg = (
        f"{_REPORT_PROMPT}\n\nTreningi:\n{history_block}"
    )
    messages = [AIMessage(role="user", content=user_msg)]
    async for chunk in provider.stream(messages, cfg):
        yield chunk


def parse_report_json(raw: str) -> dict:
    cleaned = _strip_fences(raw)
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        return {
            "summary": cleaned[:400],
            "strengths": [],
            "weaknesses": [],
            "missed_muscles": [],
            "next_week_plan": [],
            "prometheus_words": "",
        }
    missed = [m for m in data.get("missed_muscles", []) if m in _MUSCLE_KEYS]
    plan = []
    for d in data.get("next_week_plan", []) or []:
        if not isinstance(d, dict):
            continue
        plan.append(
            {
                "day": str(d.get("day", "")).strip(),
                "focus": str(d.get("focus", "")).strip(),
                "exercises": [
                    str(e).strip() for e in (d.get("exercises") or []) if str(e).strip()
                ],
            }
        )
    return {
        "summary": str(data.get("summary", "")).strip(),
        "strengths": [str(x).strip() for x in (data.get("strengths") or []) if str(x).strip()],
        "weaknesses": [str(x).strip() for x in (data.get("weaknesses") or []) if str(x).strip()],
        "missed_muscles": missed,
        "next_week_plan": plan,
        "prometheus_words": str(data.get("prometheus_words", "")).strip(),
    }


__all__ = [
    "SYSTEM_PROMPT",
    "chat_stream",
    "generate_weekly_report",
    "parse_exercise",
    "parse_report_json",
]
