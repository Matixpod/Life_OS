"""Unified Calendar — daily_tasks ∪ project_tasks (due) + proposals.

The calendar is the single source-of-truth view across task types. On every
request it ensures `habit_entries` exist for the queried date(s) — calling
this multiple times on the same date is idempotent.
"""

from __future__ import annotations

import logging
from datetime import date as DateType
from datetime import timedelta

from supabase import Client

from core import config
from core.agent_routing import get_agent_route
from models.calendar_models import CalendarDay, CalendarItem
from models.kronos import TaskCategory, TaskStatus
from models.task_models import INT_TO_PRIORITY, TaskPriority

from . import habits_service, projects_service, proposals_service

logger = logging.getLogger(__name__)

MAX_RANGE_DAYS = 90


class CalendarRangeTooLarge(ValueError):
    pass


def _row_to_calendar_item(row: dict) -> CalendarItem:
    cat_raw = row.get("category")
    pri_int = row.get("priority") or 2
    status_raw = row.get("status") or "todo"
    type_raw = row.get("task_type") or "task"
    category = TaskCategory(cat_raw) if cat_raw else None
    return CalendarItem(
        id=row["id"],
        type=type_raw,
        title=row.get("title") or "",
        category=category,
        status=TaskStatus(status_raw),
        priority=INT_TO_PRIORITY.get(pri_int, TaskPriority.MEDIUM),
        scheduled_date=DateType.fromisoformat(str(row["date"])[:10]),
        habit_id=row.get("habit_id"),
        project_id=None,
        project_task_id=row.get("project_task_id"),
        agent_route=get_agent_route(category),
        is_main_quest=bool(row.get("is_main_quest")),
    )


def _project_task_to_calendar_item(row: dict, force_date: DateType | None = None) -> CalendarItem | None:
    """Project tasks get a category from the parent project at fetch time.

    Pure mapper — caller is responsible for providing `category` via the
    `_category` attribute (we attach it before calling).
    """
    due = row.get("due_date")
    if not due and not force_date:
        return None
    final_date = force_date if force_date else DateType.fromisoformat(str(due)[:10])

    cat = row.get("_category")
    category = TaskCategory(cat) if cat else None
    pri_raw = row.get("priority") or "medium"
    try:
        priority = TaskPriority(pri_raw)
    except ValueError:
        priority = TaskPriority.MEDIUM
    return CalendarItem(
        id=row["id"],
        type="project_task",
        title=row.get("title") or "",
        category=category,
        status=TaskStatus(row.get("status") or "todo"),
        priority=priority,
        scheduled_date=final_date,
        habit_id=None,
        project_id=row["project_id"],
        project_title=row.get("_project_title"),
        project_task_id=row["id"],
        agent_route=get_agent_route(category),
        is_main_quest=bool(row.get("is_main_quest")),
    )


def _fetch_daily_tasks(
    supabase: Client, user_id: str, start: DateType, end: DateType
) -> list[dict]:
    res = (
        supabase.table(config.TABLE_DAILY_TASKS)
        .select("*")
        .eq("user_id", user_id)
        .gte("date", start.isoformat())
        .lte("date", end.isoformat())
        .order("date")
        .execute()
    )
    return list(res.data or [])


def _fetch_project_task_items(
    supabase: Client, user_id: str, start: DateType, end: DateType
) -> list[CalendarItem]:
    today = DateType.today()
    # We only show project tasks on the "Today" column
    if today < start or today > end:
        return []

    # 1. Fetch active projects
    proj_res = (
        supabase.table(projects_service.TABLE_PROJECTS)
        .select("id,title,category")
        .eq("user_id", user_id)
        .eq("status", "active")
        .execute()
    )
    active_projs = list(proj_res.data or [])
    if not active_projs:
        return []

    proj_by_id = {p["id"]: p for p in active_projs}

    # 2. Fetch all incomplete tasks for these projects
    task_res = (
        supabase.table(projects_service.TABLE_TASKS)
        .select("*")
        .eq("user_id", user_id)
        .in_("project_id", list(proj_by_id.keys()))
        .neq("status", "done")
        .execute()
    )
    tasks = list(task_res.data or [])
    if not tasks:
        return []

    # 3. Fetch all sections for these projects to establish ordering
    sec_res = (
        supabase.table(projects_service.TABLE_SECTIONS)
        .select("id,position")
        .eq("user_id", user_id)
        .in_("project_id", list(proj_by_id.keys()))
        .execute()
    )
    sec_pos = {s["id"]: int(s.get("position", 0)) for s in (sec_res.data or [])}

    # 4. Group tasks by project and sort to find "Next Action"
    tasks_by_project: dict[str, list[dict]] = {}
    for t in tasks:
        tasks_by_project.setdefault(t["project_id"], []).append(t)

    items: list[CalendarItem] = []
    for pid, ptasks in tasks_by_project.items():
        # Sort by section_position, then task_position
        def _sort_key(t: dict) -> tuple[int, int]:
            s_id = t.get("section_id")
            s_pos = sec_pos.get(s_id, 0) if s_id else 0
            t_pos = int(t.get("position", 0))
            return (s_pos, t_pos)

        ptasks.sort(key=_sort_key)
        next_action = ptasks[0]

        proj = proj_by_id[pid]
        next_action["_category"] = proj.get("category")
        next_action["_project_title"] = proj.get("title")

        item = _project_task_to_calendar_item(next_action, force_date=today)
        if item is not None:
            items.append(item)

    return items


def get_calendar_day(
    supabase: Client, user_id: str, target: DateType
) -> CalendarDay:
    # Idempotent — generate any missing habit entries for this date first.
    try:
        habits_service.generate_habit_entries(supabase, user_id, target)
    except Exception:  # noqa: BLE001 — calendar must still render
        logger.exception("habit entry generation failed for %s", target)

    rows = _fetch_daily_tasks(supabase, user_id, target, target)
    items: list[CalendarItem] = [_row_to_calendar_item(r) for r in rows]
    items.extend(_fetch_project_task_items(supabase, user_id, target, target))

    pending_by_date = proposals_service.list_pending_for_dates(
        supabase, user_id, [target]
    )
    proposals = pending_by_date.get(target, [])

    completion_rate = _completion_rate(items)
    return CalendarDay(
        date=target,
        items=items,
        proposals=proposals,
        completion_rate=completion_rate,
    )


def get_calendar_range(
    supabase: Client, user_id: str, start: DateType, end: DateType
) -> list[CalendarDay]:
    if end < start:
        raise ValueError("end must be ≥ start")
    span = (end - start).days + 1
    if span > MAX_RANGE_DAYS:
        raise CalendarRangeTooLarge(
            f"Range {span} days exceeds limit of {MAX_RANGE_DAYS}"
        )

    cursor = start
    while cursor <= end:
        try:
            habits_service.generate_habit_entries(supabase, user_id, cursor)
        except Exception:  # noqa: BLE001
            logger.exception("habit entry generation failed for %s", cursor)
        cursor += timedelta(days=1)

    daily_rows = _fetch_daily_tasks(supabase, user_id, start, end)
    proj_items = _fetch_project_task_items(supabase, user_id, start, end)

    by_day: dict[DateType, list[CalendarItem]] = {}
    cursor = start
    while cursor <= end:
        by_day[cursor] = []
        cursor += timedelta(days=1)

    for row in daily_rows:
        item = _row_to_calendar_item(row)
        by_day.setdefault(item.scheduled_date, []).append(item)
    for item in proj_items:
        by_day.setdefault(item.scheduled_date, []).append(item)

    proposals_by_day = proposals_service.list_pending_for_dates(
        supabase, user_id, list(by_day.keys())
    )

    days: list[CalendarDay] = []
    for d in sorted(by_day.keys()):
        items = by_day[d]
        days.append(
            CalendarDay(
                date=d,
                items=items,
                proposals=proposals_by_day.get(d, []),
                completion_rate=_completion_rate(items),
            )
        )
    return days


def _completion_rate(items: list[CalendarItem]) -> float:
    if not items:
        return 0.0
    done = sum(1 for it in items if it.status == TaskStatus.DONE)
    return round(done / len(items), 3)


__all__ = [
    "CalendarRangeTooLarge",
    "MAX_RANGE_DAYS",
    "get_calendar_day",
    "get_calendar_range",
]
