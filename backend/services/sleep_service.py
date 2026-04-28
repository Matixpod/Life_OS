from supabase import Client

from core import config
from core.supabase_client import get_user_id
from models.schemas import SleepLogRequest


def upsert_sleep(supabase: Client, payload: SleepLogRequest) -> dict:
    user_id = get_user_id(supabase)
    record = {
        "user_id": user_id,
        "date": str(payload.date),
        "duration_minutes": payload.duration_minutes,
        "quality_score": payload.quality_score,
        "energy_score": payload.energy_score,
        "morning_mood": payload.morning_mood,
        "source": "manual",
    }
    res = (
        supabase.table(config.TABLE_SLEEP)
        .upsert(record, on_conflict="date")
        .execute()
    )
    return res.data[0] if res.data else record
