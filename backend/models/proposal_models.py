"""Pydantic v2 models for `agent_task_proposals`."""

from __future__ import annotations

from datetime import date as DateType
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from models.kronos import TaskCategory
from models.task_models import TaskPriority

__all__ = [
    "AgentTaskProposal",
    "ProposalApproveResult",
    "ProposalCreate",
    "ProposalStatus",
    "ProposalType",
]

ProposalType = Literal["task", "habit"]
ProposalStatus = Literal["pending", "approved", "rejected", "expired"]


class ProposalCreate(BaseModel):
    """Used by the shared agent tool, never sent over the wire from the UI."""

    agent_id: str = Field(min_length=1, max_length=64)
    proposed_title: str = Field(min_length=1, max_length=200)
    proposed_category: TaskCategory
    proposed_date: DateType
    proposed_priority: TaskPriority = TaskPriority.MEDIUM
    proposed_type: ProposalType = "task"
    reason: str = Field(min_length=1, max_length=400)


class AgentTaskProposal(BaseModel):
    id: str
    user_id: str
    agent_id: str
    proposed_title: str
    proposed_category: TaskCategory
    proposed_date: DateType
    proposed_priority: TaskPriority
    proposed_type: ProposalType
    reason: str
    status: ProposalStatus
    expires_at: datetime
    created_at: datetime


class ProposalApproveResult(BaseModel):
    """Discriminator-light envelope. The shape hangs on `kind`.

    - kind="task"  → `task_id` is the new daily_tasks UUID
    - kind="habit" → `habit_id` is the new habits UUID
    """

    proposal: AgentTaskProposal
    kind: ProposalType
    task_id: str | None = None
    habit_id: str | None = None
