from datetime import UTC, datetime

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "version": "1.0.0",
        "timestamp": datetime.now(UTC).isoformat(),
    }
