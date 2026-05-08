"""PROMETHEUS Cardio agent — kcal & fat-burn analysis.

All numeric kcal math is done in Python; the AI is only used for two things:

1. MET fallback when no HR + no profile → ask the model for a MET value
   for the chosen activity. We parse the first float we find, and fall back
   to a hard-coded table if the model misbehaves.
2. The Polish `analysis_note` shown to the user — short, motivational, in
   PROMETHEUS voice.

Provider resolution reuses `agent._resolve_provider` so settings (model,
temperature) stay shared with the strength coach.
"""

from __future__ import annotations

import re

from supabase import Client

from models.schemas import CardioProfile, CardioSessionCreate
from services.ai_provider import AIMessage, AIProviderConfig

from .agent import SYSTEM_PROMPT, _resolve_provider

# ─── HR zones ────────────────────────────────────────────────────────────────

ZONE_FAT_PCT: dict[str, int] = {
    "warm_up": 80,
    "fat_burn": 70,
    "aerobic": 50,
    "anaerobic": 30,
    "peak": 10,
}


def _hr_zone(avg_hr: int, age: int) -> str:
    hr_max = max(120, 220 - age)
    pct = avg_hr / hr_max
    if pct < 0.60:
        return "warm_up"
    if pct < 0.70:
        return "fat_burn"
    if pct < 0.80:
        return "aerobic"
    if pct < 0.90:
        return "anaerobic"
    return "peak"


# ─── Keytel et al. 2005 formula ──────────────────────────────────────────────


def _keytel_kcal(
    *, hr: int, weight: float, age: int, gender: str, duration_min: int
) -> float:
    """Keytel et al. 2005 — energy expenditure from heart rate.

    The original formula returns kJ/min; dividing by 4.184 yields kcal/min,
    which we multiply by duration_min for the total kcal of the session.
    Calibrated for moderate-to-vigorous activity (HR ~90–180); at low HR the
    raw value can go negative, hence the floor at 0.
    """
    if gender == "male":
        kj_per_min = -55.0969 + 0.6309 * hr + 0.1988 * weight + 0.2017 * age
    else:
        kj_per_min = -20.4022 + 0.4472 * hr - 0.1263 * weight + 0.074 * age
    kcal_per_min = kj_per_min / 4.184
    return max(0.0, kcal_per_min * duration_min)


# ─── MET fallback (no HR / no profile) ───────────────────────────────────────

FALLBACK_MET: dict[str, float] = {
    "treadmill": 4.5,
    "running": 8.0,
    "bike": 6.0,
    "elliptical": 5.5,
    "swimming": 6.0,
    "rowing": 7.0,
    "hiit": 8.5,
    "other": 5.0,
}


async def _ask_ai_for_met(
    activity_type: str, params: dict, supabase: Client
) -> float:
    """Ask the configured model for a MET value. Falls back to the static
    table if the response can't be parsed.
    """
    fallback = FALLBACK_MET.get(activity_type, 5.0)
    try:
        provider, cfg = await _resolve_provider(supabase, max_tokens=40)
        runtime_cfg = AIProviderConfig(
            provider=cfg.provider,
            model_name=cfg.model_name,
            temperature=0.0,
            max_tokens=40,
            system_prompt="Reply with ONLY a single number (MET value).",
        )
        prompt = (
            f"What is the typical MET value for: activity={activity_type}, "
            f"params={params or 'none'}? Reply with ONLY a number."
        )
        raw = await provider.complete(
            [AIMessage(role="user", content=prompt)], runtime_cfg
        )
        match = re.search(r"-?\d+(?:\.\d+)?", raw)
        if not match:
            return fallback
        value = float(match.group(0))
        if not 1.0 <= value <= 20.0:
            return fallback
        return value
    except Exception:
        return fallback


# ─── analysis_note (PROMETHEUS voice) ────────────────────────────────────────


async def _build_analysis_note(
    *,
    session: CardioSessionCreate,
    hr_zone: str | None,
    kcal_total: float,
    fat_grams: float,
    kcal_epoc: float,
    supabase: Client,
) -> str:
    """1–2 short Polish sentences, max ~50 words, motivational."""
    try:
        provider, cfg = await _resolve_provider(supabase, max_tokens=140)
        runtime_cfg = AIProviderConfig(
            provider=cfg.provider,
            model_name=cfg.model_name,
            temperature=cfg.temperature,
            max_tokens=140,
            system_prompt=SYSTEM_PROMPT,
        )
        zone_pl = {
            "warm_up": "rozgrzewka",
            "fat_burn": "spalanie tłuszczu",
            "aerobic": "tlenowa",
            "anaerobic": "beztlenowa",
            "peak": "szczyt",
            None: "brak danych o tętnie",
        }.get(hr_zone, "—")
        prompt = (
            f"Sesja: {session.label} ({session.activity_type}), "
            f"{session.duration_min} min, strefa: {zone_pl}, "
            f"spalono {round(kcal_total)} kcal "
            f"(w tym {fat_grams:.1f} g tłuszczu, EPOC +{round(kcal_epoc)} kcal). "
            "Daj 1–2 krótkie, konkretne, motywujące zdania po polsku. "
            "Max 50 słów."
        )
        raw = await provider.complete(
            [AIMessage(role="user", content=prompt)], runtime_cfg
        )
        return raw.strip()
    except Exception:
        return ""


# ─── Public API ──────────────────────────────────────────────────────────────


async def analyze_cardio_session(
    session: CardioSessionCreate,
    profile: CardioProfile | None,
    supabase: Client,
) -> dict:
    """Returns the kcal / split / EPOC / zone / note dict ready for DB insert."""

    duration = session.duration_min
    avg_hr = session.avg_hr

    # ─── Step 1 — HR zone ────────────────────────────────────────────────
    hr_zone: str | None = None
    if avg_hr and profile:
        hr_zone = _hr_zone(avg_hr, profile.age)

    # ─── Step 2 — kcal_total ─────────────────────────────────────────────
    if avg_hr and profile:
        kcal = _keytel_kcal(
            hr=avg_hr,
            weight=profile.weight_kg,
            age=profile.age,
            gender=profile.gender,
            duration_min=duration,
        )
        # VO2max efficiency adjustment — well-trained burns less per HR.
        if profile.vo2max is not None:
            if profile.vo2max >= 50:
                kcal *= 0.95
            elif profile.vo2max >= 40:
                kcal *= 0.97
    else:
        met = await _ask_ai_for_met(
            session.activity_type,
            session.params.model_dump(exclude_none=True),
            supabase,
        )
        weight = profile.weight_kg if profile else 75.0
        kcal = met * weight * (duration / 60.0)

    kcal_total = round(max(0.0, kcal), 1)

    # ─── Step 3 — fat / carb split ───────────────────────────────────────
    base_fat_pct = ZONE_FAT_PCT.get(hr_zone or "", 50)
    fat_pct = float(base_fat_pct)
    if profile:
        if profile.vo2max is not None and profile.vo2max >= 50:
            fat_pct += 5
        if profile.body_fat_pct is not None and profile.body_fat_pct < 15:
            fat_pct -= 5
    fat_pct = max(10.0, min(85.0, fat_pct))
    carb_pct = 100.0 - fat_pct

    fat_kcal = round(kcal_total * fat_pct / 100.0, 1)
    carb_kcal = round(kcal_total * carb_pct / 100.0, 1)
    fat_grams = round(fat_kcal / 9.0, 2)

    # ─── Step 4 — EPOC ───────────────────────────────────────────────────
    if hr_zone in ("anaerobic", "peak"):
        epoc_pct = 0.10
    elif hr_zone == "aerobic":
        epoc_pct = 0.07
    else:
        epoc_pct = 0.04
    kcal_epoc = round(kcal_total * epoc_pct, 1)

    # ─── Step 5 — analysis_note ──────────────────────────────────────────
    note = await _build_analysis_note(
        session=session,
        hr_zone=hr_zone,
        kcal_total=kcal_total,
        fat_grams=fat_grams,
        kcal_epoc=kcal_epoc,
        supabase=supabase,
    )

    return {
        "kcal_total": kcal_total,
        "kcal_epoc": kcal_epoc,
        "fat_pct": round(fat_pct, 1),
        "carb_pct": round(carb_pct, 1),
        "fat_kcal": fat_kcal,
        "carb_kcal": carb_kcal,
        "fat_grams": fat_grams,
        "hr_zone": hr_zone,
        "analysis_note": note,
    }


__all__ = ["analyze_cardio_session", "FALLBACK_MET", "ZONE_FAT_PCT"]
