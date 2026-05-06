"""ARES — Vitality & Physical Health agent.

Sub-categories: activity, nutrition, sleep, hydration. ARES reads from
`daily_tasks`, computes a 0–100 health score, and streams an analysis via
the AI Provider abstraction (Claude/Gemini/DeepSeek/Ollama).

Depends on KRONOS for behavioral context (streaks, patterns, PvE).
"""
