"""Agent task proposals — pending suggestions awaiting user approval.

7-day TTL. On approve, materialises into either a daily_tasks row (task)
or a habits row (habit). On expiry, approve raises `ProposalExpired`.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from datetime import date as DateType

from supabase import Client

from core import config
from models.habit_models import HabitCreate
from models.kronos import TaskCategory
from models.proposal_models import (
    AgentTaskProposal,
    ProposalApproveResult,
    ProposalCreate,
)
from models.task_models import PRIORITY_TO_INT, TaskPriority

from . import habits_service

logger = logging.getLogger(__name__)

TABLE = "agent_task_proposals"


class ProposalNotFound(LookupError):
    pass


class ProposalExpired(RuntimeError):
    pass


class ProposalAlreadyResolved(RuntimeError):
    pass


def _parse_iso(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except ValueError:
        return None


def _row_to_proposal(row: dict) -> AgentTaskProposal:
    return AgentTaskProposal(
        id=row["id"],
        user_id=row["user_id"],
        agent_id=row["agent_id"],
        proposed_title=row["proposed_title"],
        proposed_category=TaskCategory(row["proposed_category"]),
        proposed_date=DateType.fromisoformat(str(row["proposed_date"])[:10]),
        proposed_priority=TaskPriority(row.get("proposed_priority") or "medium"),
        proposed_type=row.get("proposed_type") or "task",
        reason=row["reason"],
        status=row.get("status") or "pending",
        expires_at=_parse_iso(row["expires_at"]) or datetime.now(tz=UTC),
        created_at=_parse_iso(row["created_at"]) or datetime.now(tz=UTC),
    )


def create_proposal(
    supabase: Client, user_id: str, data: ProposalCreate
) -> AgentTaskProposal:
    record = {
        "user_id": user_id,
        "agent_id": data.agent_id,
        "proposed_title": data.proposed_title.strip(),
        "proposed_category": data.proposed_category.value,
        "proposed_date": data.proposed_date.isoformat(),
        "proposed_priority": data.proposed_priority.value,
        "proposed_type": data.proposed_type,
        "reason": data.reason.strip(),
        # status / expires_at use DB defaults
    }
    res = supabase.table(TABLE).insert(record).execute()
    if not res.data:
        raise RuntimeError("Failed to insert proposal")
    return _row_to_proposal(res.data[0])


def list_pending(
    supabase: Client,
    user_id: str,
    *,
    agent_id: str | None = None,
    target_date: DateType | None = None,
) -> list[AgentTaskProposal]:
    """Return non-expired proposals in `pending` status."""
    now_iso = datetime.now(tz=UTC).isoformat()
    q = (
        supabase.table(TABLE)
        .select("*")
        .eq("user_id", user_id)
        .eq("status", "pending")
        .gt("expires_at", now_iso)
    )
    if agent_id:
        q = q.eq("agent_id", agent_id)
    if target_date:
        q = q.eq("proposed_date", target_date.isoformat())
    res = q.order("created_at", desc=True).execute()
    return [_row_to_proposal(r) for r in (res.data or [])]


def list_pending_for_dates(
    supabase: Client, user_id: str, dates: list[DateType]
) -> dict[DateType, list[AgentTaskProposal]]:
    if not dates:
        return {}
    now_iso = datetime.now(tz=UTC).isoformat()
    iso_dates = [d.isoformat() for d in dates]
    res = (
        supabase.table(TABLE)
        .select("*")
        .eq("user_id", user_id)
        .eq("status", "pending")
        .gt("expires_at", now_iso)
        .in_("proposed_date", iso_dates)
        .execute()
    )
    out: dict[DateType, list[AgentTaskProposal]] = {d: [] for d in dates}
    for row in res.data or []:
        proposal = _row_to_proposal(row)
        out.setdefault(proposal.proposed_date, []).append(proposal)
    return out


def _fetch_row(
    supabase: Client, user_id: str, proposal_id: str
) -> dict:
    res = (
        supabase.table(TABLE)
        .select("*")
        .eq("id", proposal_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise ProposalNotFound(proposal_id)
    return res.data[0]


def reject_proposal(
    supabase: Client, user_id: str, proposal_id: str
) -> AgentTaskProposal:
    row = _fetch_row(supabase, user_id, proposal_id)
    if row.get("status") != "pending":
        raise ProposalAlreadyResolved(proposal_id)
    upd = (
        supabase.table(TABLE)
        .update({"status": "rejected"})
        .eq("id", proposal_id)
        .eq("user_id", user_id)
        .execute()
    )
    return _row_to_proposal((upd.data or [row])[0])


def approve_proposal(
    supabase: Client, user_id: str, proposal_id: str
) -> ProposalApproveResult:
    row = _fetch_row(supabase, user_id, proposal_id)
    if row.get("status") != "pending":
        raise ProposalAlreadyResolved(proposal_id)
    expires = _parse_iso(row.get("expires_at"))
    if expires and expires < datetime.now(tz=UTC):
        # mark as expired in DB so subsequent reads reflect reality
        (
            supabase.table(TABLE)
            .update({"status": "expired"})
            .eq("id", proposal_id)
            .eq("user_id", user_id)
            .execute()
        )
        raise ProposalExpired(proposal_id)

    proposal = _row_to_proposal(row)

    task_id: str | None = None
    habit_id: str | None = None

    if proposal.proposed_type == "habit":
        habit = habits_service.create_habit(
            supabase,
            user_id,
            HabitCreate(
                title=proposal.proposed_title,
                category=proposal.proposed_category,
                priority=proposal.proposed_priority,
                start_date=proposal.proposed_date,
                notes=f"Z propozycji {proposal.agent_id}: {proposal.reason}",
            ),
        )
        habit_id = habit.id
    else:
        record = {
            "user_id": user_id,
            "title": proposal.proposed_title,
            "category": proposal.proposed_category.value,
            "priority": PRIORITY_TO_INT.get(proposal.proposed_priority, 2),
            "date": proposal.proposed_date.isoformat(),
            "status": "todo",
            "task_type": "task",
            "source": "agent",
            "agent_justification": (
                f"[{proposal.agent_id}] {proposal.reason}"
            ),
        }
        ins = (
            supabase.table(config.TABLE_DAILY_TASKS).insert(record).execute()
        )
        if not ins.data:
            raise RuntimeError("Failed to materialise proposed task")
        task_id = ins.data[0]["id"]

    upd = (
        supabase.table(TABLE)
        .update({"status": "approved"})
        .eq("id", proposal_id)
        .eq("user_id", user_id)
        .execute()
    )
    final_proposal = _row_to_proposal((upd.data or [row])[0])
    return ProposalApproveResult(
        proposal=final_proposal,
        kind=final_proposal.proposed_type,
        task_id=task_id,
        habit_id=habit_id,
    )


__all__ = [
    "ProposalAlreadyResolved",
    "ProposalExpired",
    "ProposalNotFound",
    "approve_proposal",
    "create_proposal",
    "list_pending",
    "list_pending_for_dates",
    "reject_proposal",
]
