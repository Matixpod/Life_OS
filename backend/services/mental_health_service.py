from supabase import Client

from core import config
from core.supabase_client import get_user_id
from models.schemas import MentalHealthLogRequest


def upsert_mental_health(supabase: Client, payload: MentalHealthLogRequest) -> dict:
    user_id = get_user_id(supabase)
    record = {
        "user_id": user_id,
        "date": str(payload.date),
        "mood_score": payload.mood_score,
        "energy_score": payload.energy_score,
        "stress_score": payload.stress_score,
        "journal_text": payload.journal_text,
    }
    res = (
        supabase.table(config.TABLE_MENTAL_HEALTH)
        .upsert(record, on_conflict="date")
        .execute()
    )
    return res.data[0] if res.data else record
