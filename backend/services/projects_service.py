"""Projects → Sections → Tasks for the redesign.

Operates on the existing `projects` table (extended by migration 008 with
`category`, `color`, `due_date`) and on the new `project_sections` /
`project_tasks` tables. The legacy goals_service code keeps working — both
read/write the same `projects` row.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from datetime import date as DateType

from supabase import Client

from models.kronos import TaskCategory, TaskStatus
from models.project_models import (
    Project,
    ProjectCreate,
    ProjectFull,
    ProjectProgress,
    ProjectSection,
    ProjectSectionCreate,
    ProjectSectionUpdate,
    ProjectSectionWithTasks,
    ProjectTask,
    ProjectTaskCreate,
    ProjectTaskUpdate,
    ProjectUpdate,
)
from models.task_models import INT_TO_PRIORITY, PRIORITY_TO_INT, TaskPriority

logger = logging.getLogger(__name__)

TABLE_PROJECTS = "projects"
TABLE_SECTIONS = "project_sections"
TABLE_TASKS = "project_tasks"
DEFAULT_SECTION_TITLE = "Sekcja domyślna"


class ProjectNotFound(LookupError):
    pass


class ProjectTaskNotFound(LookupError):
    pass


# ─── Mappers ───────────────────────────────────────────────────────────────


def _parse_iso(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except ValueError:
        return None


def _parse_date(raw: str | None) -> DateType | None:
    if not raw:
        return None
    try:
        return DateType.fromisoformat(str(raw)[:10])
    except ValueError:
        return None


def _row_to_project(row: dict) -> Project:
    cat = row.get("category")
    pri = row.get("priority")
    if isinstance(pri, int):
        priority = INT_TO_PRIORITY.get(pri, TaskPriority.MEDIUM)
    elif isinstance(pri, str):
        try:
            priority = TaskPriority(pri)
        except ValueError:
            priority = TaskPriority.MEDIUM
    else:
        priority = TaskPriority.MEDIUM
    return Project(
        id=row["id"],
        user_id=row["user_id"],
        title=row["title"],
        description=row.get("description"),
        category=TaskCategory(cat) if cat else None,
        status=row.get("status") or "active",
        priority=priority,
        due_date=_parse_date(row.get("due_date")),
        color=row.get("color") or "#6366f1",
        created_at=_parse_iso(row.get("created_at")) or datetime.now(tz=UTC),
        updated_at=_parse_iso(row.get("updated_at")),
    )


def _row_to_section(row: dict) -> ProjectSection:
    return ProjectSection(
        id=row["id"],
        project_id=row["project_id"],
        user_id=row["user_id"],
        title=row["title"],
        position=int(row.get("position", 0)),
        created_at=_parse_iso(row.get("created_at")) or datetime.now(tz=UTC),
    )


def _row_to_task(row: dict) -> ProjectTask:
    return ProjectTask(
        id=row["id"],
        project_id=row["project_id"],
        section_id=row.get("section_id"),
        user_id=row["user_id"],
        title=row["title"],
        status=TaskStatus(row.get("status") or "todo"),
        priority=TaskPriority(row.get("priority") or "medium"),
        due_date=_parse_date(row.get("due_date")),
        completed_at=_parse_iso(row.get("completed_at")),
        estimated_minutes=row.get("estimated_minutes"),
        notes=row.get("notes"),
        position=int(row.get("position", 0)),
        created_at=_parse_iso(row.get("created_at")) or datetime.now(tz=UTC),
    )


# ─── Projects CRUD ─────────────────────────────────────────────────────────


def create_project(supabase: Client, user_id: str, data: ProjectCreate) -> Project:
    record = {
        "user_id": user_id,
        "title": data.title.strip(),
        "description": data.description,
        "category": data.category.value,
        "priority": PRIORITY_TO_INT.get(data.priority, 2),
        "due_date": data.due_date.isoformat() if data.due_date else None,
        "color": data.color,
        "status": "active",
    }
    res = supabase.table(TABLE_PROJECTS).insert(record).execute()
    if not res.data:
        raise RuntimeError("Failed to insert project")
    return _row_to_project(res.data[0])


def update_project(
    supabase: Client, user_id: str, project_id: str, data: ProjectUpdate
) -> Project:
    _fetch_project_row(supabase, user_id, project_id)
    patch: dict = {"updated_at": datetime.now(tz=UTC).isoformat()}
    if data.title is not None:
        patch["title"] = data.title.strip()
    if data.description is not None:
        patch["description"] = data.description
    if data.category is not None:
        patch["category"] = data.category.value
    if data.priority is not None:
        patch["priority"] = PRIORITY_TO_INT.get(data.priority, 2)
    if data.due_date is not None:
        patch["due_date"] = data.due_date.isoformat()
    if data.color is not None:
        patch["color"] = data.color
    if data.status is not None:
        patch["status"] = data.status
    res = (
        supabase.table(TABLE_PROJECTS)
        .update(patch)
        .eq("id", project_id)
        .eq("user_id", user_id)
        .execute()
    )
    return _row_to_project((res.data or [_fetch_project_row(supabase, user_id, project_id)])[0])


def archive_project(supabase: Client, user_id: str, project_id: str) -> Project:
    return update_project(
        supabase,
        user_id,
        project_id,
        ProjectUpdate(status="archived"),
    )


def delete_project(supabase: Client, user_id: str, project_id: str) -> None:
    _fetch_project_row(supabase, user_id, project_id)
    supabase.table(TABLE_PROJECTS).delete().eq("id", project_id).eq(
        "user_id", user_id
    ).execute()


def list_projects(
    supabase: Client, user_id: str, *, status: str | None = None
) -> list[Project]:
    q = supabase.table(TABLE_PROJECTS).select("*").eq("user_id", user_id)
    if status:
        q = q.eq("status", status)
    res = q.order("updated_at", desc=True).execute()
    return [_row_to_project(r) for r in (res.data or [])]


def _fetch_project_row(
    supabase: Client, user_id: str, project_id: str
) -> dict:
    res = (
        supabase.table(TABLE_PROJECTS)
        .select("*")
        .eq("id", project_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise ProjectNotFound(project_id)
    return res.data[0]


# ─── Sections ──────────────────────────────────────────────────────────────


def create_section(
    supabase: Client,
    user_id: str,
    project_id: str,
    data: ProjectSectionCreate,
) -> ProjectSection:
    _fetch_project_row(supabase, user_id, project_id)
    record = {
        "user_id": user_id,
        "project_id": project_id,
        "title": data.title.strip(),
        "position": data.position,
    }
    res = supabase.table(TABLE_SECTIONS).insert(record).execute()
    return _row_to_section((res.data or [record])[0])


def list_sections(
    supabase: Client, user_id: str, project_id: str
) -> list[ProjectSection]:
    res = (
        supabase.table(TABLE_SECTIONS)
        .select("*")
        .eq("user_id", user_id)
        .eq("project_id", project_id)
        .order("position", desc=False)
        .execute()
    )
    return [_row_to_section(r) for r in (res.data or [])]


def update_section(
    supabase: Client, user_id: str, section_id: str, data: ProjectSectionUpdate
) -> ProjectSection:
    res = supabase.table(TABLE_SECTIONS).select("*").eq("id", section_id).eq("user_id", user_id).execute()
    if not res.data:
        raise LookupError("Section not found")

    patch: dict = {}
    if data.title is not None:
        patch["title"] = data.title.strip()
    if data.position is not None:
        patch["position"] = data.position

    upd = (
        supabase.table(TABLE_SECTIONS)
        .update(patch)
        .eq("id", section_id)
        .eq("user_id", user_id)
        .execute()
    )
    return _row_to_section((upd.data or res.data)[0])


def delete_section(supabase: Client, user_id: str, section_id: str) -> None:
    res = supabase.table(TABLE_SECTIONS).select("id").eq("id", section_id).eq("user_id", user_id).execute()
    if not res.data:
        raise LookupError("Section not found")
    supabase.table(TABLE_SECTIONS).delete().eq("id", section_id).eq("user_id", user_id).execute()


def reorder_sections(
    supabase: Client, user_id: str, project_id: str, ids: list[str]
) -> None:
    for idx, sid in enumerate(ids):
        (
            supabase.table(TABLE_SECTIONS)
            .update({"position": idx})
            .eq("id", sid)
            .eq("user_id", user_id)
            .eq("project_id", project_id)
            .execute()
        )


def _ensure_default_section(
    supabase: Client, user_id: str, project_id: str
) -> str:
    existing = list_sections(supabase, user_id, project_id)
    if existing:
        return existing[0].id
    section = create_section(
        supabase,
        user_id,
        project_id,
        ProjectSectionCreate(title=DEFAULT_SECTION_TITLE, position=0),
    )
    return section.id


# ─── Project tasks ─────────────────────────────────────────────────────────


def create_project_task(
    supabase: Client,
    user_id: str,
    project_id: str,
    data: ProjectTaskCreate,
) -> ProjectTask:
    _fetch_project_row(supabase, user_id, project_id)
    section_id = data.section_id or _ensure_default_section(
        supabase, user_id, project_id
    )
    # Compute trailing position within the section
    pos_res = (
        supabase.table(TABLE_TASKS)
        .select("position")
        .eq("user_id", user_id)
        .eq("section_id", section_id)
        .order("position", desc=True)
        .limit(1)
        .execute()
    )
    next_pos = 0
    if pos_res.data:
        next_pos = int(pos_res.data[0].get("position") or 0) + 1

    record = {
        "user_id": user_id,
        "project_id": project_id,
        "section_id": section_id,
        "title": data.title.strip(),
        "priority": data.priority.value,
        "due_date": data.due_date.isoformat() if data.due_date else None,
        "estimated_minutes": data.estimated_minutes,
        "notes": data.notes,
        "position": next_pos,
        "status": "todo",
    }
    res = supabase.table(TABLE_TASKS).insert(record).execute()
    return _row_to_task((res.data or [record])[0])


def update_project_task(
    supabase: Client, user_id: str, task_id: str, data: ProjectTaskUpdate
) -> ProjectTask:
    _fetch_task_row(supabase, user_id, task_id)
    patch: dict = {}
    if data.title is not None:
        patch["title"] = data.title.strip()
    if data.section_id is not None:
        patch["section_id"] = data.section_id
    if data.status is not None:
        patch["status"] = data.status.value
        if data.status == TaskStatus.DONE:
            patch["completed_at"] = datetime.now(tz=UTC).isoformat()
    if data.priority is not None:
        patch["priority"] = data.priority.value
    if data.due_date is not None:
        patch["due_date"] = data.due_date.isoformat()
    if data.estimated_minutes is not None:
        patch["estimated_minutes"] = data.estimated_minutes
    if data.notes is not None:
        patch["notes"] = data.notes
    if data.position is not None:
        patch["position"] = data.position
    res = (
        supabase.table(TABLE_TASKS)
        .update(patch)
        .eq("id", task_id)
        .eq("user_id", user_id)
        .execute()
    )
    return _row_to_task(
        (res.data or [_fetch_task_row(supabase, user_id, task_id)])[0]
    )


def complete_project_task(
    supabase: Client, user_id: str, task_id: str
) -> ProjectTask:
    return update_project_task(
        supabase,
        user_id,
        task_id,
        ProjectTaskUpdate(status=TaskStatus.DONE),
    )


def delete_project_task(supabase: Client, user_id: str, task_id: str) -> None:
    _fetch_task_row(supabase, user_id, task_id)
    supabase.table(TABLE_TASKS).delete().eq("id", task_id).eq("user_id", user_id).execute()


def reorder_tasks(
    supabase: Client, user_id: str, section_id: str, ids: list[str]
) -> None:
    for idx, tid in enumerate(ids):
        (
            supabase.table(TABLE_TASKS)
            .update({"position": idx, "section_id": section_id})
            .eq("id", tid)
            .eq("user_id", user_id)
            .execute()
        )


def list_project_tasks(
    supabase: Client, user_id: str, project_id: str
) -> list[ProjectTask]:
    res = (
        supabase.table(TABLE_TASKS)
        .select("*")
        .eq("user_id", user_id)
        .eq("project_id", project_id)
        .order("section_id")
        .order("position", desc=False)
        .execute()
    )
    return [_row_to_task(r) for r in (res.data or [])]


def list_project_tasks_due_on(
    supabase: Client, user_id: str, target: DateType
) -> list[ProjectTask]:
    res = (
        supabase.table(TABLE_TASKS)
        .select("*")
        .eq("user_id", user_id)
        .eq("due_date", target.isoformat())
        .execute()
    )
    return [_row_to_task(r) for r in (res.data or [])]


def _fetch_task_row(
    supabase: Client, user_id: str, task_id: str
) -> dict:
    res = (
        supabase.table(TABLE_TASKS)
        .select("*")
        .eq("id", task_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise ProjectTaskNotFound(task_id)
    return res.data[0]


# ─── Aggregations ──────────────────────────────────────────────────────────


def get_project_full(
    supabase: Client, user_id: str, project_id: str
) -> ProjectFull:
    project = _row_to_project(_fetch_project_row(supabase, user_id, project_id))
    sections = list_sections(supabase, user_id, project_id)
    tasks = list_project_tasks(supabase, user_id, project_id)

    sections_with_tasks: list[ProjectSectionWithTasks] = []
    by_section: dict[str | None, list[ProjectTask]] = {}
    for t in tasks:
        by_section.setdefault(t.section_id, []).append(t)

    for sec in sections:
        sec_tasks = sorted(
            by_section.get(sec.id, []), key=lambda t: t.position
        )
        sections_with_tasks.append(
            ProjectSectionWithTasks(**sec.model_dump(), tasks=sec_tasks)
        )

    progress = _compute_progress(tasks)
    return ProjectFull(**project.model_dump(), sections=sections_with_tasks, progress=progress)


def _compute_progress(tasks: list[ProjectTask]) -> ProjectProgress:
    total = len(tasks)
    done = sum(1 for t in tasks if t.status == TaskStatus.DONE)
    overdue = 0
    today = DateType.today()
    for t in tasks:
        if (
            t.due_date is not None
            and t.due_date < today
            and t.status != TaskStatus.DONE
        ):
            overdue += 1
    pct = round(100.0 * done / total, 1) if total else 0.0
    return ProjectProgress(
        total_tasks=total,
        completed_tasks=done,
        completion_percentage=pct,
        overdue_count=overdue,
    )


__all__ = [
    "ProjectNotFound",
    "ProjectTaskNotFound",
    "archive_project",
    "complete_project_task",
    "create_project",
    "create_project_task",
    "create_section",
    "delete_project",
    "delete_project_task",
    "delete_section",
    "get_project_full",
    "list_project_tasks",
    "list_project_tasks_due_on",
    "list_projects",
    "list_sections",
    "reorder_sections",
    "reorder_tasks",
    "update_project",
    "update_project_task",
    "update_section",
]
