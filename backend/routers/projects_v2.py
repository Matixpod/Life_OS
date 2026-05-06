"""Projects API — redesign hierarchy (project → sections → tasks).

Mounted at `/projects` (the legacy Goals router uses `/goals/projects`,
so there's no path collision). Both share the underlying `projects` row
because the redesign extended the table; the new router exposes the
section/task subtree the legacy one doesn't know about.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from core.supabase_client import get_supabase, get_user_id
from models.project_models import (
    Project,
    ProjectCreate,
    ProjectFull,
    ProjectSection,
    ProjectSectionCreate,
    ProjectSectionUpdate,
    ProjectTask,
    ProjectTaskCreate,
    ProjectTaskUpdate,
    ProjectUpdate,
    ReorderRequest,
)
from services import projects_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/projects", tags=["projects"])


# ─── Project CRUD ──────────────────────────────────────────────────────────


@router.get("", response_model=list[Project])
async def list_projects_route(
    status: str | None = None,
    supabase: Client = Depends(get_supabase),
) -> list[Project]:
    user_id = get_user_id(supabase)
    return projects_service.list_projects(supabase, user_id, status=status)


@router.post("", response_model=Project, status_code=201)
async def create_project_route(
    payload: ProjectCreate,
    supabase: Client = Depends(get_supabase),
) -> Project:
    user_id = get_user_id(supabase)
    try:
        return projects_service.create_project(supabase, user_id, payload)
    except Exception as e:
        logger.exception("projects.create error")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/{project_id}", response_model=ProjectFull)
async def get_project_route(
    project_id: str,
    supabase: Client = Depends(get_supabase),
) -> ProjectFull:
    user_id = get_user_id(supabase)
    try:
        return projects_service.get_project_full(supabase, user_id, project_id)
    except projects_service.ProjectNotFound:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")


@router.patch("/{project_id}", response_model=Project)
async def update_project_route(
    project_id: str,
    payload: ProjectUpdate,
    supabase: Client = Depends(get_supabase),
) -> Project:
    user_id = get_user_id(supabase)
    try:
        return projects_service.update_project(
            supabase, user_id, project_id, payload
        )
    except projects_service.ProjectNotFound:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")


@router.delete("/{project_id}", status_code=204)
async def delete_project_route(
    project_id: str,
    supabase: Client = Depends(get_supabase),
) -> None:
    user_id = get_user_id(supabase)
    try:
        projects_service.delete_project(supabase, user_id, project_id)
    except projects_service.ProjectNotFound:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")


# ─── Sections ──────────────────────────────────────────────────────────────


@router.post(
    "/{project_id}/sections", response_model=ProjectSection, status_code=201
)
async def create_section_route(
    project_id: str,
    payload: ProjectSectionCreate,
    supabase: Client = Depends(get_supabase),
) -> ProjectSection:
    user_id = get_user_id(supabase)
    try:
        return projects_service.create_section(
            supabase, user_id, project_id, payload
        )
    except projects_service.ProjectNotFound:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")


@router.patch(
    "/{project_id}/sections/reorder", status_code=204
)
async def reorder_sections_route(
    project_id: str,
    payload: ReorderRequest,
    supabase: Client = Depends(get_supabase),
) -> None:
    user_id = get_user_id(supabase)
    projects_service.reorder_sections(
        supabase, user_id, project_id, payload.ids
    )


@router.patch("/sections/{section_id}", response_model=ProjectSection)
async def update_section_route(
    section_id: str,
    payload: ProjectSectionUpdate,
    supabase: Client = Depends(get_supabase),
) -> ProjectSection:
    user_id = get_user_id(supabase)
    try:
        return projects_service.update_section(supabase, user_id, section_id, payload)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.delete("/sections/{section_id}", status_code=204)
async def delete_section_route(
    section_id: str,
    supabase: Client = Depends(get_supabase),
) -> None:
    user_id = get_user_id(supabase)
    try:
        projects_service.delete_section(supabase, user_id, section_id)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


# ─── Project tasks ─────────────────────────────────────────────────────────


@router.post(
    "/{project_id}/tasks", response_model=ProjectTask, status_code=201
)
async def create_project_task_route(
    project_id: str,
    payload: ProjectTaskCreate,
    supabase: Client = Depends(get_supabase),
) -> ProjectTask:
    user_id = get_user_id(supabase)
    try:
        return projects_service.create_project_task(
            supabase, user_id, project_id, payload
        )
    except projects_service.ProjectNotFound:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")


@router.patch("/tasks/{task_id}", response_model=ProjectTask)
async def update_project_task_route(
    task_id: str,
    payload: ProjectTaskUpdate,
    supabase: Client = Depends(get_supabase),
) -> ProjectTask:
    user_id = get_user_id(supabase)
    try:
        return projects_service.update_project_task(
            supabase, user_id, task_id, payload
        )
    except projects_service.ProjectTaskNotFound:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")


@router.post("/tasks/{task_id}/complete", response_model=ProjectTask)
async def complete_project_task_route(
    task_id: str,
    supabase: Client = Depends(get_supabase),
) -> ProjectTask:
    user_id = get_user_id(supabase)
    try:
        return projects_service.complete_project_task(supabase, user_id, task_id)
    except projects_service.ProjectTaskNotFound:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")


@router.delete("/tasks/{task_id}", status_code=204)
async def delete_project_task_route(
    task_id: str,
    supabase: Client = Depends(get_supabase),
) -> None:
    user_id = get_user_id(supabase)
    try:
        projects_service.delete_project_task(supabase, user_id, task_id)
    except projects_service.ProjectTaskNotFound:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")


@router.patch("/sections/{section_id}/reorder", status_code=204)
async def reorder_tasks_route(
    section_id: str,
    payload: ReorderRequest,
    supabase: Client = Depends(get_supabase),
) -> None:
    user_id = get_user_id(supabase)
    projects_service.reorder_tasks(supabase, user_id, section_id, payload.ids)


__all__ = ["router"]
