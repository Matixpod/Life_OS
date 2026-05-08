"""Daily System service layer.

Implements the stamina ledger described in
`/docs/agents/daily-system/PROMPT.md` against the schema introduced by
`migrations/009_daily_system.sql`.

Stamina is real-time minutes, not points:

    base_pool   = ((sleep_score + energy_score) / 2) * 6     # capped [0, 600]
    boosts_total = sum(stamina_boosts.ap_restored where date = today)
    ap_used      = sum(ap_cost of completed non-regenerative tasks)
    ap_restored  = sum(ap_cost of completed regenerative tasks)
    ap_available = max(0, base_pool + boosts_total - ap_used + ap_restored)

`ap_cost` is the priority-weighted column on `daily_tasks` (migration 013):
HIGH × 1.5, MEDIUM × 1.0, LOW × 0.7. Regenerative tasks ignore the
multiplier and use raw `estimated_minutes`.

Per ADR-003 the system is single-user — `user_id` is resolved internally
via `get_user_id`. Per ADR-010 task data lives in `daily_tasks`.

Custom exceptions are raised for HTTP-mapped conditions; the router is
the only layer that knows about HTTP.
"""

from datetime import UTC, datetime, timedelta
from datetime import date as DateType

from supabase import Client

from core import config
from core.supabase_client import get_user_id
from models.daily_system_models import (
    BOOST_LABELS,
    BoostAvailability,
    BoostResult,
    BoostType,
    DailyLog,
    StaminaStatus,
    TaskAPItem,
)

__all__ = [
    "BOOST_CONFIG",
    "BoostOnCooldown",
    "BoostMaxReached",
    "compute_stamina_pool",
    "create_daily_log",
    "get_today_log",
    "get_log_for_date",
    "get_stamina_status",
    "get_boost_availability",
    "use_boost",
    "get_history",
]


# ─── Boost configuration ─────────────────────────────────────────────────────


BOOST_CONFIG: dict[BoostType, dict] = {
    BoostType.COFFEE:     {"ap": 30, "cooldown_hours": 4, "max_per_day": 2},
    BoostType.POWER_NAP:  {"ap": 60, "cooldown_hours": 6, "max_per_day": 1},
    BoostType.NAP:        {"ap": 90, "cooldown_hours": 8, "max_per_day": 1},
    BoostType.WALK:       {"ap": 20, "cooldown_hours": 2, "max_per_day": None},
    BoostType.WATER:      {"ap": 10, "cooldown_hours": 1, "max_per_day": None},
    BoostType.MEDITATION: {"ap": 45, "cooldown_hours": 6, "max_per_day": 1},
}


# ─── Exceptions (router maps to HTTP 429) ────────────────────────────────────


class BoostOnCooldown(Exception):
    """Boost requested before its cooldown elapsed. → 429"""

    def __init__(self, boost_type: BoostType, remaining_minutes: int):
        self.boost_type = boost_type
        self.remaining_minutes = remaining_minutes
        super().__init__(
            f"Boost {boost_type.value} on cooldown for another "
            f"{remaining_minutes} min."
        )


class BoostMaxReached(Exception):
    """Boost requested after its max_per_day cap. → 429"""

    def __init__(self, boost_type: BoostType, max_per_day: int):
        self.boost_type = boost_type
        self.max_per_day = max_per_day
        super().__init__(
            f"Boost {boost_type.value} already used {max_per_day} times today."
        )


# ─── Pure compute ────────────────────────────────────────────────────────────


def compute_stamina_pool(sleep_score: int, energy_score: int) -> int:
    """Map (sleep, energy) ∈ [0,100]² to a minutes pool ∈ [0,600].

    Floor at 0 / ceil at 600 so callers can rely on the bounds without
    re-clamping. Both inputs are validated to [0,100] by `DailyLogCreate`,
    but the floor/ceil here makes the function safe to call directly
    (e.g. from tests that pass adversarial inputs).
    """

    avg = (max(0, min(100, sleep_score)) + max(0, min(100, energy_score))) / 2
    return max(0, min(600, int(avg * 6)))


# ─── Row mappers ─────────────────────────────────────────────────────────────


def _row_to_daily_log(row: dict) -> DailyLog:
    return DailyLog(
        id=row["id"],
        date=DateType.fromisoformat(row["date"]),
        sleep_score=row["sleep_score"],
        energy_score=row["energy_score"],
        stamina_pool=row["stamina_pool"],
        notes=row.get("notes"),
        created_at=row["created_at"],
    )


# ─── Daily log CRUD ──────────────────────────────────────────────────────────


def create_daily_log(
    supabase: Client,
    sleep_score: int,
    energy_score: int,
    notes: str | None = None,
) -> DailyLog:
    """Upsert today's daily log.

    `daily_logs(user_id, date)` is UNIQUE — re-submitting the morning
    briefing on the same day overwrites the previous values. This is
    intentional: the user can re-sync if they realise the slider was off.
    """

    user_id = get_user_id(supabase)
    today = DateType.today().isoformat()
    pool = compute_stamina_pool(sleep_score, energy_score)

    record = {
        "user_id": user_id,
        "date": today,
        "sleep_score": sleep_score,
        "energy_score": energy_score,
        "stamina_pool": pool,
        "notes": notes,
    }

    res = (
        supabase.table(config.TABLE_DAILY_LOGS)
        .upsert(record, on_conflict="user_id,date")
        .execute()
    )
    return _row_to_daily_log(res.data[0])


def get_today_log(supabase: Client) -> DailyLog | None:
    return get_log_for_date(supabase, DateType.today())


def get_log_for_date(supabase: Client, target: DateType) -> DailyLog | None:
    user_id = get_user_id(supabase)
    res = (
        supabase.table(config.TABLE_DAILY_LOGS)
        .select("*")
        .eq("user_id", user_id)
        .eq("date", target.isoformat())
        .limit(1)
        .execute()
    )
    return _row_to_daily_log(res.data[0]) if res.data else None


def get_history(supabase: Client, days: int = 14) -> list[DailyLog]:
    """Return the last `days` daily logs (newest first)."""

    user_id = get_user_id(supabase)
    since = (DateType.today() - timedelta(days=days - 1)).isoformat()
    res = (
        supabase.table(config.TABLE_DAILY_LOGS)
        .select("*")
        .eq("user_id", user_id)
        .gte("date", since)
        .order("date", desc=True)
        .execute()
    )
    return [_row_to_daily_log(r) for r in (res.data or [])]


# ─── Stamina status ──────────────────────────────────────────────────────────


def _sum_boosts(supabase: Client, user_id: str, target: DateType) -> int:
    res = (
        supabase.table(config.TABLE_STAMINA_BOOSTS)
        .select("ap_restored")
        .eq("user_id", user_id)
        .eq("date", target.isoformat())
        .execute()
    )
    return sum(r["ap_restored"] for r in (res.data or []))


def _today_tasks(
    supabase: Client, user_id: str, target: DateType
) -> list[dict]:
    res = (
        supabase.table(config.TABLE_DAILY_TASKS)
        .select("id,title,status,estimated_minutes,is_regenerative,ap_cost")
        .eq("user_id", user_id)
        .eq("date", target.isoformat())
        .execute()
    )
    return res.data or []


def get_stamina_status(
    supabase: Client, target: DateType | None = None
) -> StaminaStatus:
    """Aggregate today's stamina ledger into a single response object."""

    user_id = get_user_id(supabase)
    target = target or DateType.today()

    log = get_log_for_date(supabase, target)
    base_pool = log.stamina_pool if log else 0

    boosts_total = _sum_boosts(supabase, user_id, target)

    rows = _today_tasks(supabase, user_id, target)
    ap_used = 0
    ap_restored = 0
    breakdown: list[TaskAPItem] = []

    for r in rows:
        # `ap_cost` is the priority-weighted generated column (migration 013);
        # falls back to `estimated_minutes` for rows predating that migration.
        cost = r.get("ap_cost")
        if cost is None:
            cost = r.get("estimated_minutes") or 0
        is_regen = bool(r.get("is_regenerative"))
        is_done = r.get("status") == "done"
        # Signed cost — negative for regenerative, positive for draining.
        signed = -cost if is_regen else cost
        breakdown.append(
            TaskAPItem(
                task_id=r["id"],
                title=r["title"],
                ap_cost=signed,
                is_completed=is_done,
                is_regenerative=is_regen,
            )
        )
        if is_done and cost > 0:
            if is_regen:
                ap_restored += cost
            else:
                ap_used += cost

    ap_available = max(0, base_pool + boosts_total - ap_used + ap_restored)
    pct = (ap_available / base_pool * 100.0) if base_pool > 0 else 0.0

    return StaminaStatus(
        date=target,
        base_pool=base_pool,
        boosts_total=boosts_total,
        ap_used=ap_used,
        ap_restored=ap_restored,
        ap_available=ap_available,
        percentage=round(pct, 1),
        tasks_breakdown=breakdown,
        is_initialized=log is not None,
    )


# ─── Boost availability & use ────────────────────────────────────────────────


def _boosts_today(
    supabase: Client, user_id: str, target: DateType
) -> list[dict]:
    res = (
        supabase.table(config.TABLE_STAMINA_BOOSTS)
        .select("boost_type,used_at")
        .eq("user_id", user_id)
        .eq("date", target.isoformat())
        .order("used_at", desc=True)
        .execute()
    )
    return res.data or []


def _parse_ts(raw: str) -> datetime:
    """Supabase returns timestamps with a trailing `+00:00` already, but
    `datetime.fromisoformat` on Python 3.11+ accepts that. Strip a
    trailing `Z` defensively for older shapes.
    """

    return datetime.fromisoformat(raw.replace("Z", "+00:00"))


def get_boost_availability(
    supabase: Client, target: DateType | None = None
) -> list[BoostAvailability]:
    """Per-boost button state for the StaminaDetailsPanel."""

    user_id = get_user_id(supabase)
    target = target or DateType.today()
    history = _boosts_today(supabase, user_id, target)
    now = datetime.now(tz=UTC)

    # Group by boost type, newest first (already ordered).
    by_type: dict[str, list[datetime]] = {}
    for r in history:
        by_type.setdefault(r["boost_type"], []).append(_parse_ts(r["used_at"]))

    out: list[BoostAvailability] = []
    for boost in BoostType:
        cfg = BOOST_CONFIG[boost]
        uses = by_type.get(boost.value, [])
        uses_today = len(uses)
        max_uses = cfg["max_per_day"]
        cooldown_h = cfg["cooldown_hours"]

        cooldown_remaining: int | None = None
        is_available = True

        if max_uses is not None and uses_today >= max_uses:
            is_available = False
        elif uses:
            last = uses[0]
            elapsed = now - last
            cooldown = timedelta(hours=cooldown_h)
            if elapsed < cooldown:
                is_available = False
                cooldown_remaining = int((cooldown - elapsed).total_seconds() // 60)
                # Don't show 0 — round up so the FE always has at least 1 min.
                cooldown_remaining = max(1, cooldown_remaining)

        out.append(
            BoostAvailability(
                boost_type=boost,
                label=BOOST_LABELS[boost],
                ap_restored=cfg["ap"],
                is_available=is_available,
                cooldown_remaining_min=cooldown_remaining,
                uses_today=uses_today,
                max_per_day=max_uses,
            )
        )
    return out


def use_boost(supabase: Client, boost_type: BoostType) -> BoostResult:
    """Insert a `stamina_boosts` row after enforcing cooldown + max_per_day.

    Race condition note: two concurrent calls could both pass the
    availability check and insert. For a single-user system this is
    not a concern; if/when this becomes multi-user we'd add a
    serialisable transaction or a DB-level constraint.
    """

    user_id = get_user_id(supabase)
    today = DateType.today()
    cfg = BOOST_CONFIG[boost_type]

    history = _boosts_today(supabase, user_id, today)
    same = [
        _parse_ts(r["used_at"])
        for r in history
        if r["boost_type"] == boost_type.value
    ]
    now = datetime.now(tz=UTC)

    max_uses = cfg["max_per_day"]
    if max_uses is not None and len(same) >= max_uses:
        raise BoostMaxReached(boost_type, max_uses)

    if same:
        last = same[0]  # already ordered newest-first
        cooldown = timedelta(hours=cfg["cooldown_hours"])
        elapsed = now - last
        if elapsed < cooldown:
            remaining = int((cooldown - elapsed).total_seconds() // 60)
            raise BoostOnCooldown(boost_type, max(1, remaining))

    record = {
        "user_id": user_id,
        "date": today.isoformat(),
        "boost_type": boost_type.value,
        "ap_restored": cfg["ap"],
    }
    supabase.table(config.TABLE_STAMINA_BOOSTS).insert(record).execute()

    cooldown_until = now + timedelta(hours=cfg["cooldown_hours"])
    status = get_stamina_status(supabase, today)

    return BoostResult(
        boost_type=boost_type,
        ap_restored=cfg["ap"],
        new_ap_available=status.ap_available,
        cooldown_until=cooldown_until,
    )
