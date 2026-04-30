from datetime import UTC, datetime, timedelta
from datetime import date as DateType

from supabase import Client

from core import config
from core.supabase_client import get_user_id
from models.goals import (
    DailyTaskCreate,
    DailyTaskUpdate,
    GoalsSummaryResponse,
    LifeAreaCreate,
    LifeAreaUpdate,
    ProjectCreate,
    ProjectUpdate,
)

# ─── Life Areas ───────────────────────────────────────────────────────────────


def get_life_areas(supabase: Client, *, include_inactive: bool = False) -> list[dict]:
    user_id = get_user_id(supabase)
    q = (
        supabase.table(config.TABLE_LIFE_AREAS)
        .select("*")
        .eq("user_id", user_id)
        .order("sort_order")
    )
    if not include_inactive:
        q = q.eq("active", True)
    res = q.execute()
    return res.data or []


def create_life_area(supabase: Client, payload: LifeAreaCreate) -> dict:
    user_id = get_user_id(supabase)
    record = {
        "user_id": user_id,
        "name": payload.name,
        "icon": payload.icon,
        "color": payload.color,
        "description": payload.description,
        "sort_order": payload.sort_order,
        "active": True,
    }
    res = supabase.table(config.TABLE_LIFE_AREAS).insert(record).execute()
    return res.data[0] if res.data else record


def update_life_area(supabase: Client, area_id: str, payload: LifeAreaUpdate) -> dict:
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update:
        existing = (
            supabase.table(config.TABLE_LIFE_AREAS)
            .select("*")
            .eq("id", area_id)
            .limit(1)
            .execute()
        )
        return existing.data[0] if existing.data else {}
    res = (
        supabase.table(config.TABLE_LIFE_AREAS)
        .update(update)
        .eq("id", area_id)
        .execute()
    )
    return res.data[0] if res.data else {}


def deactivate_life_area(supabase: Client, area_id: str) -> dict:
    res = (
        supabase.table(config.TABLE_LIFE_AREAS)
        .update({"active": False})
        .eq("id", area_id)
        .execute()
    )
    return res.data[0] if res.data else {}


def _life_area_lookup(supabase: Client) -> dict[str, dict]:
    return {a["id"]: a for a in get_life_areas(supabase, include_inactive=True)}


# ─── Projects ─────────────────────────────────────────────────────────────────


def _attach_life_area(project: dict, areas_by_id: dict[str, dict]) -> dict:
    area = areas_by_id.get(project.get("life_area_id"))
    if area:
        project["life_area"] = {
            "id": area["id"],
            "name": area["name"],
            "icon": area["icon"],
            "color": area["color"],
        }
    else:
        project["life_area"] = None
    return project


def get_projects(supabase: Client, *, status: str | None = None) -> list[dict]:
    user_id = get_user_id(supabase)
    q = (
        supabase.table(config.TABLE_PROJECTS)
        .select("*")
        .eq("user_id", user_id)
        .order("priority")
        .order("created_at", desc=True)
    )
    if status:
        q = q.eq("status", status)
    res = q.execute()
    rows = res.data or []
    areas = _life_area_lookup(supabase)
    return [_attach_life_area(p, areas) for p in rows]


def create_project(supabase: Client, payload: ProjectCreate) -> dict:
    user_id = get_user_id(supabase)
    record = {
        "user_id": user_id,
        "title": payload.title,
        "life_area_id": payload.life_area_id,
        "description": payload.description,
        "why": payload.why,
        "status": payload.status,
        "priority": payload.priority,
        "target_date": str(payload.target_date) if payload.target_date else None,
    }
    res = supabase.table(config.TABLE_PROJECTS).insert(record).execute()
    row = res.data[0] if res.data else record
    return _attach_life_area(row, _life_area_lookup(supabase))


def update_project(
    supabase: Client, project_id: str, payload: ProjectUpdate
) -> dict:
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if "target_date" in update and update["target_date"]:
        update["target_date"] = str(update["target_date"])
    if update.get("status") in ("active",):
        update["stalled_flag"] = False
    update["updated_at"] = datetime.now(tz=UTC).isoformat()
    res = (
        supabase.table(config.TABLE_PROJECTS)
        .update(update)
        .eq("id", project_id)
        .execute()
    )
    row = res.data[0] if res.data else {}
    if row:
        row = _attach_life_area(row, _life_area_lookup(supabase))
    return row


def check_stalled_projects(supabase: Client) -> list[dict]:
    """Mark projects with no task in 7+ days as stalled and return them."""
    user_id = get_user_id(supabase)
    cutoff = str(DateType.today() - timedelta(days=7))
    res = (
        supabase.table(config.TABLE_PROJECTS)
        .select("*")
        .eq("user_id", user_id)
        .eq("status", "active")
        .or_(f"last_task_date.lt.{cutoff},last_task_date.is.null")
        .execute()
    )
    stalled = res.data or []
    for project in stalled:
        if not project.get("stalled_flag"):
            supabase.table(config.TABLE_PROJECTS).update(
                {"stalled_flag": True}
            ).eq("id", project["id"]).execute()
            project["stalled_flag"] = True
    areas = _life_area_lookup(supabase)
    return [_attach_life_area(p, areas) for p in stalled]


# ─── Daily Tasks ──────────────────────────────────────────────────────────────


def _attach_task_relations(
    task: dict, areas_by_id: dict[str, dict], projects_by_id: dict[str, dict]
) -> dict:
    area = areas_by_id.get(task.get("life_area_id"))
    task["life_area"] = (
        {"id": area["id"], "name": area["name"], "icon": area["icon"], "color": area["color"]}
        if area
        else None
    )
    project = projects_by_id.get(task.get("project_id"))
    task["project"] = (
        {"id": project["id"], "title": project["title"], "life_area_id": project.get("life_area_id")}
        if project
        else None
    )
    return task


def _projects_lookup(supabase: Client) -> dict[str, dict]:
    user_id = get_user_id(supabase)
    res = (
        supabase.table(config.TABLE_PROJECTS)
        .select("id,title,life_area_id")
        .eq("user_id", user_id)
        .execute()
    )
    return {p["id"]: p for p in (res.data or [])}


def get_tasks_for_date(supabase: Client, target_date: DateType) -> list[dict]:
    user_id = get_user_id(supabase)
    res = (
        supabase.table(config.TABLE_DAILY_TASKS)
        .select("*")
        .eq("user_id", user_id)
        .eq("date", str(target_date))
        .order("priority")
        .order("created_at")
        .execute()
    )
    rows = res.data or []
    areas = _life_area_lookup(supabase)
    projects = _projects_lookup(supabase)
    return [_attach_task_relations(t, areas, projects) for t in rows]


def create_task(supabase: Client, payload: DailyTaskCreate) -> dict:
    user_id = get_user_id(supabase)
    # If a project is given but no life area, inherit from project
    life_area_id = payload.life_area_id
    if payload.project_id and not life_area_id:
        proj_row = (
            supabase.table(config.TABLE_PROJECTS)
            .select("life_area_id")
            .eq("id", payload.project_id)
            .limit(1)
            .execute()
        )
        if proj_row.data:
            life_area_id = proj_row.data[0].get("life_area_id")

    record = {
        "user_id": user_id,
        "title": payload.title,
        "date": str(payload.date),
        "project_id": payload.project_id,
        "life_area_id": life_area_id,
        "notes": payload.notes,
        "priority": payload.priority,
        "estimated_minutes": payload.estimated_minutes,
        "source": payload.source,
    }
    res = supabase.table(config.TABLE_DAILY_TASKS).insert(record).execute()
    row = res.data[0] if res.data else record
    return _attach_task_relations(row, _life_area_lookup(supabase), _projects_lookup(supabase))


def update_task(supabase: Client, task_id: str, payload: DailyTaskUpdate) -> dict:
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update:
        existing = (
            supabase.table(config.TABLE_DAILY_TASKS)
            .select("*")
            .eq("id", task_id)
            .limit(1)
            .execute()
        )
        return existing.data[0] if existing.data else {}
    res = (
        supabase.table(config.TABLE_DAILY_TASKS)
        .update(update)
        .eq("id", task_id)
        .execute()
    )
    row = res.data[0] if res.data else {}
    if row:
        row = _attach_task_relations(row, _life_area_lookup(supabase), _projects_lookup(supabase))
    return row


def complete_task(supabase: Client, task_id: str) -> dict:
    now = datetime.now(tz=UTC).isoformat()
    res = (
        supabase.table(config.TABLE_DAILY_TASKS)
        .update({"completed": True, "completed_at": now})
        .eq("id", task_id)
        .execute()
    )
    row = res.data[0] if res.data else {}
    if not row:
        return {}

    # Update project.last_task_date and clear stalled flag if applicable
    project_id = row.get("project_id")
    if project_id:
        supabase.table(config.TABLE_PROJECTS).update(
            {
                "last_task_date": str(DateType.today()),
                "stalled_flag": False,
                "updated_at": now,
            }
        ).eq("id", project_id).execute()

    return _attach_task_relations(row, _life_area_lookup(supabase), _projects_lookup(supabase))


def postpone_task(
    supabase: Client, task_id: str, reason: str, new_date: DateType | None
) -> dict:
    existing = (
        supabase.table(config.TABLE_DAILY_TASKS)
        .select("*")
        .eq("id", task_id)
        .limit(1)
        .execute()
    )
    if not existing.data:
        return {}
    task = existing.data[0]
    target_date = new_date or (DateType.today() + timedelta(days=1))
    new_count = (task.get("postponed_count") or 0) + 1

    update = {
        "date": str(target_date),
        "postponed_count": new_count,
        "postponed_reason": reason,
    }
    res = (
        supabase.table(config.TABLE_DAILY_TASKS)
        .update(update)
        .eq("id", task_id)
        .execute()
    )
    row = res.data[0] if res.data else {}
    if row:
        row = _attach_task_relations(row, _life_area_lookup(supabase), _projects_lookup(supabase))
    return row


def delete_task(supabase: Client, task_id: str) -> bool:
    res = (
        supabase.table(config.TABLE_DAILY_TASKS)
        .delete()
        .eq("id", task_id)
        .execute()
    )
    return bool(res.data)


# ─── Daily Plan ───────────────────────────────────────────────────────────────


def get_plan_for_date(supabase: Client, target_date: DateType) -> dict | None:
    user_id = get_user_id(supabase)
    res = (
        supabase.table(config.TABLE_DAILY_PLANS)
        .select("*")
        .eq("user_id", user_id)
        .eq("date", str(target_date))
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def accept_plan(supabase: Client, plan_id: str, modified: bool = False) -> dict:
    res = (
        supabase.table(config.TABLE_DAILY_PLANS)
        .update({"accepted": True, "modified": modified})
        .eq("id", plan_id)
        .execute()
    )
    return res.data[0] if res.data else {}


# ─── Summary (dashboard card) ─────────────────────────────────────────────────


def get_goals_summary(supabase: Client, target_date: DateType) -> GoalsSummaryResponse:
    user_id = get_user_id(supabase)
    tasks_res = (
        supabase.table(config.TABLE_DAILY_TASKS)
        .select("priority,completed")
        .eq("user_id", user_id)
        .eq("date", str(target_date))
        .execute()
    )
    tasks = tasks_res.data or []
    total = len(tasks)
    completed = sum(1 for t in tasks if t.get("completed"))
    p1_total = sum(1 for t in tasks if t.get("priority") == 1)
    p1_completed = sum(1 for t in tasks if t.get("priority") == 1 and t.get("completed"))

    plan_res = (
        supabase.table(config.TABLE_DAILY_PLANS)
        .select("id")
        .eq("user_id", user_id)
        .eq("date", str(target_date))
        .limit(1)
        .execute()
    )
    has_plan = bool(plan_res.data)

    return GoalsSummaryResponse(
        total=total,
        completed=completed,
        p1_completed=p1_completed,
        p1_total=p1_total,
        has_agent_plan=has_plan,
    )
