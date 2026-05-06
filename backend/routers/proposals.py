"""Agent task proposals — list pending, approve, reject."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from core.supabase_client import get_supabase, get_user_id
from models.proposal_models import AgentTaskProposal, ProposalApproveResult
from services import proposals_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/proposals", tags=["proposals"])


@router.get("", response_model=list[AgentTaskProposal])
async def list_proposals_route(
    agent_id: str | None = None,
    supabase: Client = Depends(get_supabase),
) -> list[AgentTaskProposal]:
    user_id = get_user_id(supabase)
    return proposals_service.list_pending(
        supabase, user_id, agent_id=agent_id
    )


@router.post("/{proposal_id}/approve", response_model=ProposalApproveResult)
async def approve_route(
    proposal_id: str,
    supabase: Client = Depends(get_supabase),
) -> ProposalApproveResult:
    user_id = get_user_id(supabase)
    try:
        return proposals_service.approve_proposal(
            supabase, user_id, proposal_id
        )
    except proposals_service.ProposalNotFound:
        raise HTTPException(status_code=404, detail=f"Proposal {proposal_id} not found")
    except proposals_service.ProposalExpired:
        raise HTTPException(status_code=410, detail="Proposal has expired")
    except proposals_service.ProposalAlreadyResolved:
        raise HTTPException(status_code=409, detail="Proposal already resolved")
    except Exception as e:
        logger.exception("proposals.approve error")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/{proposal_id}/reject", response_model=AgentTaskProposal)
async def reject_route(
    proposal_id: str,
    supabase: Client = Depends(get_supabase),
) -> AgentTaskProposal:
    user_id = get_user_id(supabase)
    try:
        return proposals_service.reject_proposal(
            supabase, user_id, proposal_id
        )
    except proposals_service.ProposalNotFound:
        raise HTTPException(status_code=404, detail=f"Proposal {proposal_id} not found")
    except proposals_service.ProposalAlreadyResolved:
        raise HTTPException(status_code=409, detail="Proposal already resolved")


__all__ = ["router"]
