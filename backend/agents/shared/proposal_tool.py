"""`propose_task` — shared "tool" any agent can call to suggest a task/habit.

Wraps `services.proposals_service.create_proposal` so agents have a stable,
typed entry point and don't import the service directly.
"""

from __future__ import annotations

import logging
from datetime import date as DateType

from supabase import Client

from models.kronos import TaskCategory
from models.proposal_models import (
    AgentTaskProposal,
    ProposalCreate,
    ProposalType,
)
from models.task_models import TaskPriority
from services import proposals_service

logger = logging.getLogger(__name__)


def propose_task(
    supabase: Client,
    *,
    agent_id: str,
    user_id: str,
    title: str,
    category: TaskCategory,
    target_date: DateType,
    reason: str,
    proposed_type: ProposalType = "task",
    priority: TaskPriority = TaskPriority.MEDIUM,
) -> AgentTaskProposal:
    """Create a pending proposal that the user can approve from the Calendar.

    Returns the persisted proposal. Errors propagate; the caller (usually
    a finally-block in an agent stream) decides whether to surface them.
    """
    return proposals_service.create_proposal(
        supabase,
        user_id,
        ProposalCreate(
            agent_id=agent_id,
            proposed_title=title,
            proposed_category=category,
            proposed_date=target_date,
            proposed_priority=priority,
            proposed_type=proposed_type,
            reason=reason,
        ),
    )


__all__ = ["propose_task"]
