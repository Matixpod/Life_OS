from supabase import Client

from core import config
from core.supabase_client import get_user_id
from models.schemas import WorkoutLogRequest


def insert_workout(supabase: Client, payload: WorkoutLogRequest) -> dict:
    user_id = get_user_id(supabase)
    record = {
        "user_id": user_id,
        "date": str(payload.date),
        "type": payload.type,
        "label": payload.label,
        "muscle_groups": payload.muscle_groups,
        "duration_minutes": payload.duration_minutes,
    }
    res = supabase.table(config.TABLE_WORKOUTS).insert(record).execute()
    return res.data[0] if res.data else record
