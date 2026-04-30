import json
import logging
from datetime import date as DateType
from datetime import timedelta

import anthropic
from supabase import Client

from core import config
from core.supabase_client import get_user_id
from models.goals import AccountabilityAlert, AgentTaskSuggestion, DailyPlanResponse
from services import goals_service

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = """You are a strategic life-planning agent for a single user.
Your job is to generate an optimal daily task plan that balances the user's most
important projects, addresses stalled work, and respects their energy level.

Rules:
- Suggest 3-6 tasks maximum (quality over quantity).
- Order by: (1) stalled high-priority projects first, (2) P1 active projects,
  (3) P2 projects, (4) carry-overs from yesterday.
- If the energy_score is below 50, suggest lighter tasks and no more than 3.
- For each task: provide a specific, concrete one-sentence "how_to_start" tip.
- The "justification" must explain WHY this task at this position (connect to
  the underlying life goal or motivation).
- Write a "plan_summary" of 2-3 sentences as if speaking to the user about
  what today is about.
- Set priority as integer 1, 2, or 3 (1 highest).
- Use the project_id and life_area_id values exactly as given when relevant;
  use null when no project/area applies.

Return ONLY valid JSON, no markdown, no preamble:
{
  "plan_summary": "Today is about ...",
  "energy_context": "Based on your X/100 energy score ...",
  "tasks": [
    {
      "title": "...",
      "project_id": "<uuid or null>",
      "life_area_id": "<uuid or null>",
      "priority": 1,
      "estimated_minutes": 45,
      "justification": "This is first because ...",
      "how_to_start": "Open ... and ..."
    }
  ]
}"""


def _fallback_plan(
    plan_date: DateType, projects: list[dict], stalled: list[dict], energy_score: int
) -> dict:
    """Used when Claude fails or no API key — produce a sensible plan from active projects."""
    suggestions: list[dict] = []

    pool = stalled + [p for p in projects if p not in stalled]
    pool.sort(key=lambda p: (p.get("priority") or 3, 0 if p.get("stalled_flag") else 1))
    for p in pool[:3]:
        is_stalled = p.get("stalled_flag")
        suggestions.append(
            {
                "title": f"Make progress on {p['title']}",
                "project_id": p["id"],
                "life_area_id": p.get("life_area_id"),
                "priority": int(p.get("priority") or 2),
                "estimated_minutes": 45 if not is_stalled else 30,
                "justification": (
                    "This project has stalled — re-engage with one small win to break the freeze."
                    if is_stalled
                    else "Top priority project; a focused session here moves the needle most."
                ),
                "how_to_start": "Open the project notes and pick the smallest concrete next action.",
            }
        )

    if not suggestions:
        suggestions.append(
            {
                "title": "Choose a top priority for today and do one focused 25-minute session",
                "project_id": None,
                "life_area_id": None,
                "priority": 2,
                "estimated_minutes": 25,
                "justification": "No active projects yet — start by picking one direction and acting on it.",
                "how_to_start": "Open Life OS, create one project, and write the first task you can complete in 25 minutes.",
            }
        )

    return {
        "plan_summary": (
            "Today the focus is your top-priority projects — especially anything that has stalled. "
            "Move with intent and finish at least one P1 task."
        ),
        "energy_context": (
            f"Energy score {energy_score}/100. "
            + ("Low energy — keep tasks light and short." if energy_score < 50 else "Energy is solid — use it.")
        ),
        "tasks": suggestions,
    }


def _gather_context(supabase: Client, plan_date: DateType) -> dict:
    user_id = get_user_id(supabase)

    projects = goals_service.get_projects(supabase, status="active")
    stalled = goals_service.check_stalled_projects(supabase)

    sleep_today = (
        supabase.table(config.TABLE_SLEEP)
        .select("*")
        .eq("user_id", user_id)
        .eq("date", str(DateType.today()))
        .limit(1)
        .execute()
    )
    energy_score = 65
    if sleep_today.data and sleep_today.data[0].get("energy_score") is not None:
        energy_score = int(sleep_today.data[0]["energy_score"])

    incomplete_today = (
        supabase.table(config.TABLE_DAILY_TASKS)
        .select("*")
        .eq("user_id", user_id)
        .eq("date", str(DateType.today()))
        .eq("completed", False)
        .execute()
    )

    return {
        "projects": projects,
        "stalled": stalled,
        "energy_score": energy_score,
        "incomplete_today": incomplete_today.data or [],
        "plan_date": str(plan_date),
    }


def _slim_projects(projects: list[dict]) -> list[dict]:
    return [
        {
            "id": p["id"],
            "title": p["title"],
            "priority": p.get("priority"),
            "status": p.get("status"),
            "life_area_id": p.get("life_area_id"),
            "stalled_flag": p.get("stalled_flag", False),
            "last_task_date": p.get("last_task_date"),
            "progress_pct": p.get("progress_pct"),
            "why": p.get("why"),
        }
        for p in projects
    ]


def _slim_tasks(tasks: list[dict]) -> list[dict]:
    return [
        {
            "id": t["id"],
            "title": t["title"],
            "priority": t.get("priority"),
            "project_id": t.get("project_id"),
            "life_area_id": t.get("life_area_id"),
            "postponed_count": t.get("postponed_count", 0),
        }
        for t in tasks
    ]


def _call_claude(context: dict) -> dict:
    client = anthropic.Anthropic(api_key=config.settings.anthropic_api_key)
    user_message = (
        "USER CONTEXT:\n"
        f"Active projects: {json.dumps(_slim_projects(context['projects']))}\n"
        f"Stalled projects (>7 days no progress): {json.dumps(_slim_projects(context['stalled']))}\n"
        f"Tonight's sleep energy score: {context['energy_score']}/100\n"
        f"Incomplete tasks from today: {json.dumps(_slim_tasks(context['incomplete_today']))}\n"
        f"Planning for date: {context['plan_date']}\n"
    )
    response = client.messages.create(
        model=config.CLAUDE_MODEL,
        max_tokens=2000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )
    text = next((b.text for b in response.content if getattr(b, "type", None) == "text"), "")
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    return json.loads(text)


def _persist_plan(
    supabase: Client, plan_date: DateType, plan: dict, force_regenerate: bool
) -> dict:
    user_id = get_user_id(supabase)
    existing = goals_service.get_plan_for_date(supabase, plan_date)

    if existing and force_regenerate:
        # Wipe agent-sourced tasks for this date so we don't double up
        supabase.table(config.TABLE_DAILY_TASKS).delete().eq(
            "user_id", user_id
        ).eq("date", str(plan_date)).eq("source", "agent").eq(
            "completed", False
        ).execute()
        supabase.table(config.TABLE_DAILY_PLANS).delete().eq(
            "id", existing["id"]
        ).execute()
        existing = None

    tasks = plan.get("tasks", []) or []
    record = {
        "user_id": user_id,
        "date": str(plan_date),
        "tasks_suggested": tasks,
        "plan_summary": plan.get("plan_summary", ""),
        "energy_context": plan.get("energy_context", ""),
    }

    if existing:
        saved = (
            supabase.table(config.TABLE_DAILY_PLANS)
            .update(record)
            .eq("id", existing["id"])
            .execute()
        )
    else:
        saved = (
            supabase.table(config.TABLE_DAILY_PLANS)
            .insert(record)
            .execute()
        )
    plan_row = saved.data[0] if saved.data else {**record, "id": ""}

    # Materialize each suggestion as a daily_task row (only when none already)
    if not existing:
        for task in tasks:
            task_record = {
                "user_id": user_id,
                "date": str(plan_date),
                "title": task.get("title", "Untitled task"),
                "project_id": task.get("project_id"),
                "life_area_id": task.get("life_area_id"),
                "priority": int(task.get("priority") or 2),
                "estimated_minutes": int(task.get("estimated_minutes") or 30),
                "source": "agent",
                "agent_justification": task.get("justification", ""),
                "notes": task.get("how_to_start", ""),
            }
            try:
                supabase.table(config.TABLE_DAILY_TASKS).insert(task_record).execute()
            except Exception:
                logger.exception("failed to insert agent-generated task")

    return plan_row


def generate_daily_plan(
    supabase: Client, plan_date: DateType, force_regenerate: bool = False
) -> DailyPlanResponse:
    existing = goals_service.get_plan_for_date(supabase, plan_date)
    if existing and not force_regenerate:
        return DailyPlanResponse(
            id=existing["id"],
            date=plan_date,
            generated_at=existing.get("generated_at"),
            tasks_suggested=[
                AgentTaskSuggestion(**t) for t in (existing.get("tasks_suggested") or [])
            ],
            plan_summary=existing.get("plan_summary", "") or "",
            energy_context=existing.get("energy_context", "") or "",
            accepted=bool(existing.get("accepted")),
            modified=bool(existing.get("modified")),
        )

    context = _gather_context(supabase, plan_date)
    try:
        plan = _call_claude(context)
    except Exception as e:
        logger.warning("Goals agent generation failed; using fallback: %s", e)
        plan = _fallback_plan(
            plan_date, context["projects"], context["stalled"], context["energy_score"]
        )

    saved = _persist_plan(supabase, plan_date, plan, force_regenerate=force_regenerate)

    return DailyPlanResponse(
        id=saved.get("id", ""),
        date=plan_date,
        generated_at=saved.get("generated_at"),
        tasks_suggested=[
            AgentTaskSuggestion(**t) for t in (saved.get("tasks_suggested") or plan.get("tasks", []))
        ],
        plan_summary=saved.get("plan_summary", "") or plan.get("plan_summary", ""),
        energy_context=saved.get("energy_context", "") or plan.get("energy_context", ""),
        accepted=bool(saved.get("accepted")),
        modified=bool(saved.get("modified")),
    )


# ─── Accountability ───────────────────────────────────────────────────────────


def check_accountability_flags(supabase: Client) -> list[AccountabilityAlert]:
    user_id = get_user_id(supabase)
    alerts: list[AccountabilityAlert] = []

    repeated = (
        supabase.table(config.TABLE_DAILY_TASKS)
        .select("id,title,postponed_count")
        .eq("user_id", user_id)
        .gte("postponed_count", 3)
        .eq("completed", False)
        .execute()
    )
    for task in repeated.data or []:
        alerts.append(
            AccountabilityAlert(
                type="repeated_postpone",
                task_id=task["id"],
                message=(
                    f"'{task['title']}' has been postponed {task['postponed_count']} times. "
                    "Time to decide: break it down, drop it, or commit."
                ),
                actions=["break_down", "drop", "commit_today"],
            )
        )

    cutoff = str(DateType.today() - timedelta(days=7))
    stalled = (
        supabase.table(config.TABLE_PROJECTS)
        .select("id,title,last_task_date")
        .eq("user_id", user_id)
        .eq("status", "active")
        .or_(f"last_task_date.lt.{cutoff},last_task_date.is.null")
        .execute()
    )
    for project in stalled.data or []:
        supabase.table(config.TABLE_PROJECTS).update({"stalled_flag": True}).eq(
            "id", project["id"]
        ).execute()
        alerts.append(
            AccountabilityAlert(
                type="stalled_project",
                project_id=project["id"],
                message=f"'{project['title']}' has had no progress in 7+ days.",
                actions=["resume", "pause", "drop"],
            )
        )

    return alerts
