from supabase import Client, create_client

from .config import settings

_client: Client | None = None


def get_supabase() -> Client:
    global _client
    if _client is None:
        _client = create_client(settings.supabase_url, settings.supabase_key)
    return _client


def get_fresh_supabase() -> Client:
    """A non-cached Supabase client.

    Use inside FastAPI BackgroundTasks (sync functions executed in a
    threadpool) — the singleton client's HTTP/2 connection is not safe
    to share with the request that's still in flight. A fresh client
    avoids "RemoteProtocolError: Server disconnected" races without
    polluting the singleton's connection pool.
    """
    return create_client(settings.supabase_url, settings.supabase_key)


def get_user_id(supabase: Client) -> str:
    """Single-user system: return the only user's UUID."""
    result = supabase.table("users").select("id").limit(1).execute()
    if not result.data:
        raise RuntimeError("No user found — run migrations/002_seed_data.sql first.")
    return result.data[0]["id"]
