"""Category → agent route mapping.

Used by the Calendar service to embed `agent_route` in every CalendarItem
so the frontend can `navigate(item.agent_route)` with zero branching.
"""

from __future__ import annotations

from models.kronos import TaskCategory

CATEGORY_TO_AGENT_ROUTE: dict[TaskCategory, str] = {
    TaskCategory.HEALTH: "/ares",
    TaskCategory.KNOWLEDGE: "/kronos",
    TaskCategory.OTHER: "/kronos",
    TaskCategory.WORK: "/kronos",
    TaskCategory.RELATIONSHIPS: "/kronos",
}

DEFAULT_ROUTE = "/calendar"


def get_agent_route(category: TaskCategory | None) -> str:
    """Returns the agent route for the given category.

    Falls back to /calendar (a known route) for items with no category.
    The PROMPT mentions /dashboard but that's already a populated tab —
    /calendar is closer in spirit (back to the source view).
    """
    if category is None:
        return DEFAULT_ROUTE
    return CATEGORY_TO_AGENT_ROUTE.get(category, DEFAULT_ROUTE)


__all__ = ["CATEGORY_TO_AGENT_ROUTE", "DEFAULT_ROUTE", "get_agent_route"]
