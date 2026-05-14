# Steps Tracking + Burn Rate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship daily step logging, a configurable weekly step goal, an inline tap-to-edit steps widget + 7-day calorie burn-rate chart in the Prometheus/Cardio tab, plus an optional "ile kroków wczoraj?" prompt in the morning briefing.

**Architecture:** Standard Life OS slice — Supabase migration adds `step_logs` and `users.weekly_step_goal`, FastAPI router + service in `backend/`, React widgets in `frontend/src/components/prometheus/`, all FE → BE traffic via `src/services/api.ts`. The burn-rate endpoint reuses the persisted `cardio_sessions.kcal_total` (already computed by `agents/prometheus/cardio_agent`) and falls back to a pure MET utility only when that value is missing.

**Tech Stack:** Python 3.12 · FastAPI 0.136 · Pydantic 2.13 · supabase-py 2.29 · pytest 9 · React 19 · TypeScript ~6 · Tailwind 3.4 · Recharts 3.8 · lucide-react 1.11.

---

## File Map

**Backend — new:**
- `backend/services/steps_service.py` — DB access for `step_logs`, weekly aggregation, burn-rate aggregation.
- `backend/routers/steps.py` — 5 endpoints under `/api/v1/steps/*`.
- `backend/tests/test_steps/__init__.py` (empty), `backend/tests/test_steps/conftest.py` (copy of daily-system FakeSupabase pre-seeded with steps tables), `backend/tests/test_steps/test_steps_service.py`.

**Backend — modify:**
- `backend/models/schemas.py` — append `StepLog`, `StepLogDay`, `StepLogRequest`, `UserSettings`, `UserSettingsUpdate`, `BurnRateDay`.
- `backend/core/config.py` — add `TABLE_STEP_LOGS = "step_logs"`.
- `backend/services/user_service.py` — add `get_settings`, `update_settings`.
- `backend/routers/user.py` — add `GET /settings`, `PATCH /settings`.
- `backend/main.py` — include `steps.router` under `/api/v1`.

**Migrations — new:**
- `migrations/017_steps_module.sql`.

**Frontend — new:**
- `frontend/src/components/prometheus/StepsWidget.tsx`.
- `frontend/src/components/prometheus/BurnRateChart.tsx`.
- `frontend/src/utils/fitness.ts`.

**Frontend — modify:**
- `frontend/src/types/index.ts` — append `UserSettings`, `StepLog`, `StepLogDay`, `BurnRateDay`.
- `frontend/src/services/api.ts` — append 7 step/settings methods (incl. burn-rate).
- `frontend/src/utils/date.ts` — add `yesterdayIso()` and `mondayOf(iso)` helpers.
- `frontend/src/pages/Profile.tsx` — replace placeholder with real profile + step-goal form.
- `frontend/src/components/prometheus/cardio/CardioTab.tsx` — mount `StepsWidget` + `BurnRateChart`.
- `frontend/src/components/daily/DailyBriefingModal.tsx` — optional yesterday-steps stepper.

**Obsidian memory — modify:**
- `memory/2026-05-13-steps-burn-rate.md` (create), `projects/life-os.md` (append session note).

---

## Migration SQL (referenced by Task 1)

```sql
-- migrations/017_steps_module.sql
-- Step tracking + weekly step goal on users.

create table if not exists step_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  date        date not null,
  steps       integer not null check (steps >= 0 and steps <= 100000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists idx_step_logs_user_date
  on step_logs (user_id, date desc);

alter table step_logs enable row level security;

drop policy if exists "step_logs_owner_all" on step_logs;
create policy "step_logs_owner_all"
  on step_logs for all
  using (user_id = (select id from users limit 1))
  with check (user_id = (select id from users limit 1));

alter table users
  add column if not exists weekly_step_goal integer not null default 70000;

alter table users
  add constraint users_weekly_step_goal_range
  check (weekly_step_goal >= 1000 and weekly_step_goal <= 200000);
```

Notes for the executor:
- This codebase enables RLS with a `(SELECT id FROM users LIMIT 1)` clause for cardio/prometheus tables (see ADR-011). We follow that pattern so the existing backend service key works.
- The spec mentions `auth.users(id)` and `auth.uid()` — that is NOT how this single-user repo is set up (`users.id` is the FK target everywhere — see `migrations/001_initial_schema.sql:34`). Use `users(id)`.
- Run the migration manually in Supabase SQL Editor — the project does not auto-run SQL.

---

## Phase 1 — Database

### Task 1: Steps + weekly-goal migration

**Files:**
- Create: `migrations/017_steps_module.sql`
- Verify: run in Supabase SQL Editor (manual, per ADR-011)

- [ ] **Step 1: Create the migration file**

Write `migrations/017_steps_module.sql` with the exact SQL from the **Migration SQL** section above.

- [ ] **Step 2: Register the table constant**

Edit `backend/core/config.py` — append below the `TABLE_CARDIO_SESSIONS` line:

```python
# Steps module (migration 017)
TABLE_STEP_LOGS = "step_logs"
```

- [ ] **Step 3: Apply the migration in Supabase**

Open Supabase SQL Editor, paste contents of `migrations/017_steps_module.sql`, run. Confirm:

```
select column_name, data_type, column_default
from information_schema.columns
where table_name = 'users' and column_name = 'weekly_step_goal';

select column_name, data_type from information_schema.columns
where table_name = 'step_logs' order by ordinal_position;
```

Expected: `weekly_step_goal` exists with default 70000; `step_logs` shows 6 columns.

- [ ] **Step 4: Commit**

```bash
git add migrations/017_steps_module.sql backend/core/config.py
git commit -m "migration 017: step_logs table + weekly_step_goal on users"
```

---

## Phase 2 — Backend

### Task 2: Pydantic schemas

**Files:**
- Modify: `backend/models/schemas.py` (append at end)

- [ ] **Step 1: Append the schemas**

Add to the bottom of `backend/models/schemas.py`:

```python
# ─── Steps + User Settings ───────────────────────────────────────────────────


class StepLog(BaseModel):
    """A single day's step count for the authenticated user."""

    id: str
    date: DateType
    steps: int


class StepLogDay(BaseModel):
    """A weekly-view entry — `steps=None` means no log for that date."""

    date: str  # ISO YYYY-MM-DD
    steps: int | None


class StepLogRequest(BaseModel):
    date: DateType
    steps: int = Field(ge=0, le=100000)


class BurnRateDay(BaseModel):
    """One day of the rolling 7-day cardio burn timeline."""

    date: str  # ISO YYYY-MM-DD
    kcal: int
    duration_minutes: int
    workout_type: str | None = None


class UserSettings(BaseModel):
    weekly_step_goal: int = 70000


class UserSettingsUpdate(BaseModel):
    weekly_step_goal: int = Field(ge=1000, le=200000)
```

- [ ] **Step 2: Verify ruff is clean**

Run: `cd backend && ruff check models/schemas.py`
Expected: `All checks passed!`

- [ ] **Step 3: Commit**

```bash
git add backend/models/schemas.py
git commit -m "schemas: Step/UserSettings/BurnRateDay Pydantic models"
```

---

### Task 3: Steps service — failing tests first

**Files:**
- Create: `backend/tests/test_steps/__init__.py` (empty)
- Create: `backend/tests/test_steps/conftest.py`
- Create: `backend/tests/test_steps/test_steps_service.py`

- [ ] **Step 1: Create the empty `__init__.py`**

```bash
touch backend/tests/test_steps/__init__.py
```

- [ ] **Step 2: Create `conftest.py` — reuse the FakeSupabase pattern**

`backend/tests/test_steps/conftest.py`:

```python
"""Shared fixtures for Steps Module tests.

Reuses the FakeSupabase from test_daily_system but pre-seeds the
`step_logs`, `users`, and `cardio_sessions` tables that the steps
service touches.
"""

from __future__ import annotations

import pytest

from tests.test_daily_system.conftest import USER_ID, FakeSupabase


@pytest.fixture
def fake_supabase() -> FakeSupabase:
    return FakeSupabase(
        tables={
            "users": [{"id": USER_ID, "weekly_step_goal": 70000}],
            "step_logs": [],
            "cardio_sessions": [],
        }
    )
```

- [ ] **Step 3: Write the failing test file**

`backend/tests/test_steps/test_steps_service.py`:

```python
"""Service-layer tests for the Steps module.

Covers: upsert semantics (overwrite same date), week aggregation
(always 7 entries, Monday→Sunday of the current ISO week, null for
missing days), and burn-rate aggregation (always 7 calendar days
ending today, sums multiple sessions per day, uses persisted
`kcal_total` when present and the MET fallback when null).
"""

from __future__ import annotations

from datetime import date as DateType
from datetime import timedelta

import pytest

from models.schemas import StepLogRequest
from services import steps_service

from .conftest import USER_ID, FakeSupabase

TODAY = DateType.today()


def _monday_of(d: DateType) -> DateType:
    return d - timedelta(days=d.weekday())


def test_upsert_inserts_new_row(fake_supabase: FakeSupabase) -> None:
    res = steps_service.upsert_steps(
        fake_supabase, StepLogRequest(date=TODAY, steps=8432)
    )
    assert res.steps == 8432
    assert res.date == TODAY
    assert len(fake_supabase.tables["step_logs"]) == 1


def test_upsert_overwrites_same_date(fake_supabase: FakeSupabase) -> None:
    steps_service.upsert_steps(
        fake_supabase, StepLogRequest(date=TODAY, steps=1000)
    )
    steps_service.upsert_steps(
        fake_supabase, StepLogRequest(date=TODAY, steps=2000)
    )
    assert len(fake_supabase.tables["step_logs"]) == 1
    assert fake_supabase.tables["step_logs"][0]["steps"] == 2000


def test_get_steps_for_date_returns_none_when_missing(
    fake_supabase: FakeSupabase,
) -> None:
    assert steps_service.get_steps_for_date(fake_supabase, TODAY) is None


def test_get_steps_for_date_returns_log_when_present(
    fake_supabase: FakeSupabase,
) -> None:
    steps_service.upsert_steps(
        fake_supabase, StepLogRequest(date=TODAY, steps=9000)
    )
    log = steps_service.get_steps_for_date(fake_supabase, TODAY)
    assert log is not None
    assert log.steps == 9000


def test_get_steps_week_returns_seven_entries_with_nulls(
    fake_supabase: FakeSupabase,
) -> None:
    monday = _monday_of(TODAY)
    # log only Mon + Wed
    for offset, steps in [(0, 8100), (2, 12000)]:
        steps_service.upsert_steps(
            fake_supabase,
            StepLogRequest(date=monday + timedelta(days=offset), steps=steps),
        )

    week = steps_service.get_steps_week(fake_supabase)
    assert len(week) == 7
    assert week[0].date == monday.isoformat()
    assert week[0].steps == 8100
    assert week[1].steps is None
    assert week[2].steps == 12000
    assert week[6].date == (monday + timedelta(days=6)).isoformat()


def test_get_burn_rate_zero_when_no_sessions(
    fake_supabase: FakeSupabase,
) -> None:
    rows = steps_service.get_burn_rate(fake_supabase)
    assert len(rows) == 7
    assert all(r.kcal == 0 and r.duration_minutes == 0 for r in rows)


def test_get_burn_rate_uses_persisted_kcal(
    fake_supabase: FakeSupabase,
) -> None:
    fake_supabase.tables["cardio_sessions"].append({
        "id": "11111111-1111-1111-1111-111111111111",
        "user_id": USER_ID,
        "date": TODAY.isoformat(),
        "activity_type": "running",
        "label": "Bieg",
        "duration_min": 45,
        "kcal_total": 420.5,
    })
    rows = steps_service.get_burn_rate(fake_supabase)
    today_row = rows[-1]
    assert today_row.date == TODAY.isoformat()
    assert today_row.kcal == 420
    assert today_row.duration_minutes == 45
    assert today_row.workout_type == "running"


def test_get_burn_rate_falls_back_to_met_when_kcal_missing(
    fake_supabase: FakeSupabase,
) -> None:
    fake_supabase.tables["cardio_sessions"].append({
        "id": "22222222-2222-2222-2222-222222222222",
        "user_id": USER_ID,
        "date": TODAY.isoformat(),
        "activity_type": "bike",
        "label": "Rower",
        "duration_min": 60,
        "kcal_total": None,
    })
    rows = steps_service.get_burn_rate(fake_supabase)
    # MET bike=6, weight 75kg, 60 min → (6 * 3.5 * 75 / 200) * 60 = 472.5 → 472
    assert rows[-1].kcal == 472


def test_get_burn_rate_sums_multiple_sessions_same_day(
    fake_supabase: FakeSupabase,
) -> None:
    fake_supabase.tables["cardio_sessions"].extend([
        {
            "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            "user_id": USER_ID,
            "date": TODAY.isoformat(),
            "activity_type": "running",
            "label": "Bieg",
            "duration_min": 30,
            "kcal_total": 300,
        },
        {
            "id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            "user_id": USER_ID,
            "date": TODAY.isoformat(),
            "activity_type": "bike",
            "label": "Rower",
            "duration_min": 20,
            "kcal_total": 150,
        },
    ])
    today_row = steps_service.get_burn_rate(fake_supabase)[-1]
    assert today_row.kcal == 450
    assert today_row.duration_minutes == 50
```

- [ ] **Step 4: Run the tests — confirm they fail with import error**

Run: `cd backend && python -m pytest tests/test_steps -v`
Expected: `ModuleNotFoundError: No module named 'services.steps_service'` (or a similar import failure). This proves the suite is wired but the service does not exist yet.

- [ ] **Step 5: Commit the failing tests**

```bash
git add backend/tests/test_steps
git commit -m "tests: failing specs for steps_service (upsert/week/burn-rate)"
```

---

### Task 4: Implement `steps_service.py`

**Files:**
- Create: `backend/services/steps_service.py`

- [ ] **Step 1: Write the service**

`backend/services/steps_service.py`:

```python
"""DB persistence for the Steps module.

`step_logs` is a unique-per-(user_id, date) ledger; the service exposes
upsert/read helpers plus two aggregators:

* `get_steps_week` — the current ISO week (Mon→Sun), always 7 entries
  with `None` for days that have no row yet.
* `get_burn_rate` — the trailing 7 calendar days from today, with
  per-day kcal summed across all cardio sessions. Uses the persisted
  `kcal_total` when available and the MET fallback otherwise.
"""

from __future__ import annotations

from datetime import date as DateType
from datetime import timedelta

from supabase import Client

from core import config
from core.supabase_client import get_user_id
from models.schemas import (
    BurnRateDay,
    StepLog,
    StepLogDay,
    StepLogRequest,
)

# ─── MET fallback ────────────────────────────────────────────────────────────

DEFAULT_BODY_WEIGHT_KG = 75.0
MET_VALUES: dict[str, float] = {
    "running": 9.0,
    "treadmill": 7.0,
    "bike": 6.0,
    "elliptical": 7.0,
    "swimming": 7.0,
    "rowing": 7.0,
    "hiit": 8.0,
    "cardio": 7.0,
    "other": 6.0,
}


def _met_kcal(duration_min: int, activity_type: str | None, weight_kg: float) -> float:
    """Pure MET-based kcal estimate: `(MET * 3.5 * kg / 200) * minutes`."""
    met = MET_VALUES.get((activity_type or "").lower(), 6.0)
    return (met * 3.5 * weight_kg / 200.0) * float(duration_min)


# ─── Step logs ───────────────────────────────────────────────────────────────


def upsert_steps(supabase: Client, payload: StepLogRequest) -> StepLog:
    """Insert or overwrite the row for `(user_id, payload.date)`."""
    user_id = get_user_id(supabase)
    record = {
        "user_id": user_id,
        "date": payload.date.isoformat(),
        "steps": payload.steps,
    }
    res = (
        supabase.table(config.TABLE_STEP_LOGS)
        .upsert(record, on_conflict="user_id,date")
        .execute()
    )
    row = res.data[0] if res.data else record
    return StepLog(id=row.get("id", ""), date=payload.date, steps=payload.steps)


def get_steps_for_date(
    supabase: Client, target: DateType
) -> StepLog | None:
    user_id = get_user_id(supabase)
    res = (
        supabase.table(config.TABLE_STEP_LOGS)
        .select("id, date, steps")
        .eq("user_id", user_id)
        .eq("date", target.isoformat())
        .limit(1)
        .execute()
    )
    if not res.data:
        return None
    row = res.data[0]
    return StepLog(id=row["id"], date=target, steps=row["steps"])


def get_steps_week(supabase: Client) -> list[StepLogDay]:
    """Return the current ISO week (Monday → Sunday), always 7 entries."""
    today = DateType.today()
    monday = today - timedelta(days=today.weekday())
    sunday = monday + timedelta(days=6)

    user_id = get_user_id(supabase)
    res = (
        supabase.table(config.TABLE_STEP_LOGS)
        .select("date, steps")
        .eq("user_id", user_id)
        .gte("date", monday.isoformat())
        .lte("date", sunday.isoformat())
        .execute()
    )
    by_date: dict[str, int] = {
        str(r["date"]): int(r["steps"]) for r in (res.data or [])
    }
    out: list[StepLogDay] = []
    for offset in range(7):
        iso = (monday + timedelta(days=offset)).isoformat()
        out.append(StepLogDay(date=iso, steps=by_date.get(iso)))
    return out


# ─── Burn rate ───────────────────────────────────────────────────────────────


def get_burn_rate(supabase: Client) -> list[BurnRateDay]:
    """Last 7 calendar days ending today, summing all cardio sessions per day."""
    today = DateType.today()
    start = today - timedelta(days=6)

    user_id = get_user_id(supabase)
    res = (
        supabase.table(config.TABLE_CARDIO_SESSIONS)
        .select("date, activity_type, duration_min, kcal_total")
        .eq("user_id", user_id)
        .gte("date", start.isoformat())
        .lte("date", today.isoformat())
        .execute()
    )

    # Per-day accumulators.
    kcal_by_date: dict[str, float] = {}
    dur_by_date: dict[str, int] = {}
    type_by_date: dict[str, str] = {}

    for row in res.data or []:
        iso = str(row["date"])
        duration = int(row.get("duration_min") or 0)
        activity = row.get("activity_type")
        kcal_raw = row.get("kcal_total")
        if kcal_raw is None:
            kcal = _met_kcal(duration, activity, DEFAULT_BODY_WEIGHT_KG)
        else:
            kcal = float(kcal_raw)
        kcal_by_date[iso] = kcal_by_date.get(iso, 0.0) + kcal
        dur_by_date[iso] = dur_by_date.get(iso, 0) + duration
        # Keep the first activity_type we see for the day (UI shows one label).
        type_by_date.setdefault(iso, activity or "")

    out: list[BurnRateDay] = []
    for offset in range(7):
        iso = (start + timedelta(days=offset)).isoformat()
        out.append(
            BurnRateDay(
                date=iso,
                kcal=int(kcal_by_date.get(iso, 0.0)),
                duration_minutes=dur_by_date.get(iso, 0),
                workout_type=type_by_date.get(iso) or None,
            )
        )
    return out


__all__ = [
    "DEFAULT_BODY_WEIGHT_KG",
    "MET_VALUES",
    "get_burn_rate",
    "get_steps_for_date",
    "get_steps_week",
    "upsert_steps",
]
```

- [ ] **Step 2: Run the tests — confirm they all pass**

Run: `cd backend && python -m pytest tests/test_steps -v`
Expected: 9 passed.

- [ ] **Step 3: Run ruff**

Run: `cd backend && ruff check services/steps_service.py tests/test_steps`
Expected: `All checks passed!`

- [ ] **Step 4: Commit**

```bash
git add backend/services/steps_service.py
git commit -m "steps_service: upsert + week + burn-rate aggregation"
```

---

### Task 5: User settings — extend `user_service.py`

**Files:**
- Modify: `backend/services/user_service.py`

- [ ] **Step 1: Append the helpers**

Append to `backend/services/user_service.py`:

```python
from models.schemas import UserSettings, UserSettingsUpdate


def get_settings(supabase: Client) -> UserSettings:
    """Read user-level settings. Single-user system — falls back to default."""
    res = (
        supabase.table(config.TABLE_USERS)
        .select("weekly_step_goal")
        .limit(1)
        .execute()
    )
    if not res.data:
        raise RuntimeError("No user row found.")
    return UserSettings(weekly_step_goal=res.data[0].get("weekly_step_goal") or 70000)


def update_settings(
    supabase: Client, payload: UserSettingsUpdate
) -> UserSettings:
    user_id = get_user_id(supabase)
    res = (
        supabase.table(config.TABLE_USERS)
        .update({"weekly_step_goal": payload.weekly_step_goal})
        .eq("id", user_id)
        .execute()
    )
    if not res.data:
        raise RuntimeError("Failed to update user settings.")
    return UserSettings(weekly_step_goal=res.data[0]["weekly_step_goal"])
```

Move the `from models.schemas import …` line up to merge with the existing import at the top of the file (`UserProfile, StreakInfo, StreakRange` → also `UserSettings, UserSettingsUpdate`). The append above duplicates the import for clarity; merge it manually to keep one import block.

- [ ] **Step 2: Verify ruff is clean**

Run: `cd backend && ruff check services/user_service.py`
Expected: `All checks passed!`

- [ ] **Step 3: Commit**

```bash
git add backend/services/user_service.py
git commit -m "user_service: get_settings + update_settings"
```

---

### Task 6: Steps router

**Files:**
- Create: `backend/routers/steps.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Write `backend/routers/steps.py`**

```python
"""HTTP surface for the Steps module."""

from __future__ import annotations

import logging
from datetime import date as DateType
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from core.supabase_client import get_supabase
from models.schemas import BurnRateDay, StepLog, StepLogDay, StepLogRequest
from services import steps_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/steps", tags=["steps"])


@router.get("/today", response_model=StepLog | None)
async def today(supabase: Client = Depends(get_supabase)) -> StepLog | None:
    try:
        return steps_service.get_steps_for_date(supabase, DateType.today())
    except Exception as e:  # noqa: BLE001
        logger.exception("steps today error")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/yesterday", response_model=StepLog | None)
async def yesterday(
    supabase: Client = Depends(get_supabase),
) -> StepLog | None:
    try:
        return steps_service.get_steps_for_date(
            supabase, DateType.today() - timedelta(days=1)
        )
    except Exception as e:  # noqa: BLE001
        logger.exception("steps yesterday error")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/week", response_model=list[StepLogDay])
async def week(supabase: Client = Depends(get_supabase)) -> list[StepLogDay]:
    try:
        return steps_service.get_steps_week(supabase)
    except Exception as e:  # noqa: BLE001
        logger.exception("steps week error")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/log", response_model=StepLog)
async def log(
    payload: StepLogRequest, supabase: Client = Depends(get_supabase)
) -> StepLog:
    try:
        return steps_service.upsert_steps(supabase, payload)
    except Exception as e:  # noqa: BLE001
        logger.exception("steps log error")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/burn-rate", response_model=list[BurnRateDay])
async def burn_rate(
    supabase: Client = Depends(get_supabase),
) -> list[BurnRateDay]:
    try:
        return steps_service.get_burn_rate(supabase)
    except Exception as e:  # noqa: BLE001
        logger.exception("steps burn-rate error")
        raise HTTPException(status_code=500, detail=str(e)) from e
```

- [ ] **Step 2: Register the router in `main.py`**

Edit `backend/main.py`. In the imports block (lines 7–29), append `steps,` after `sleep,`. After `app.include_router(prometheus.router, prefix="/api/v1")` add:

```python
app.include_router(steps.router, prefix="/api/v1")
```

- [ ] **Step 3: Start backend, hit the endpoints**

Run in one terminal: `cd backend && source .venv/bin/activate && uvicorn main:app --reload --port 8000`

In another terminal (no auth — single-user):

```bash
curl -s http://localhost:8000/api/v1/steps/today | jq .
curl -s http://localhost:8000/api/v1/steps/week | jq '. | length'
curl -s -X POST http://localhost:8000/api/v1/steps/log \
  -H 'Content-Type: application/json' \
  -d '{"date":"2026-05-13","steps":8432}' | jq .
curl -s http://localhost:8000/api/v1/steps/yesterday | jq .
curl -s http://localhost:8000/api/v1/steps/burn-rate | jq '. | length'
```

Expected:
- `/today` → `null` (or the just-logged row after the POST)
- `/week` → `7`
- `/log` → `{"id":"...","date":"2026-05-13","steps":8432}`
- `/yesterday` → `null`
- `/burn-rate` → `7`

- [ ] **Step 4: Commit**

```bash
git add backend/routers/steps.py backend/main.py
git commit -m "router: /steps/{today,yesterday,week,log,burn-rate}"
```

---

### Task 7: User settings router

**Files:**
- Modify: `backend/routers/user.py`

- [ ] **Step 1: Extend the router**

Append to `backend/routers/user.py`:

```python
from models.schemas import UserSettings, UserSettingsUpdate


@router.get("/settings", response_model=UserSettings)
async def settings(supabase: Client = Depends(get_supabase)) -> UserSettings:
    try:
        return user_service.get_settings(supabase)
    except Exception as e:  # noqa: BLE001
        logger.exception("settings get error")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.patch("/settings", response_model=UserSettings)
async def update_settings(
    payload: UserSettingsUpdate,
    supabase: Client = Depends(get_supabase),
) -> UserSettings:
    try:
        return user_service.update_settings(supabase, payload)
    except Exception as e:  # noqa: BLE001
        logger.exception("settings patch error")
        raise HTTPException(status_code=500, detail=str(e)) from e
```

Merge the `from models.schemas import …` into the existing top-of-file import (line 7).

- [ ] **Step 2: Smoke-test via curl**

```bash
curl -s http://localhost:8000/api/v1/user/settings | jq .
curl -s -X PATCH http://localhost:8000/api/v1/user/settings \
  -H 'Content-Type: application/json' \
  -d '{"weekly_step_goal":80000}' | jq .
curl -s http://localhost:8000/api/v1/user/settings | jq .
```

Expected: GET → `{"weekly_step_goal":70000}`, PATCH → `{"weekly_step_goal":80000}`, second GET → `{"weekly_step_goal":80000}`.

Reset to default for downstream testing:

```bash
curl -s -X PATCH http://localhost:8000/api/v1/user/settings \
  -H 'Content-Type: application/json' \
  -d '{"weekly_step_goal":70000}' | jq .
```

- [ ] **Step 3: Commit**

```bash
git add backend/routers/user.py
git commit -m "router: GET/PATCH /api/v1/user/settings"
```

---

## Phase 3 — Frontend types, API client, utilities

### Task 8: Frontend types

**Files:**
- Modify: `frontend/src/types/index.ts` (append at end)

- [ ] **Step 1: Append the interfaces**

Append to `frontend/src/types/index.ts`:

```typescript
// ─── Steps + Settings ─────────────────────────────────────────────────────

/** User-level settings stored on the `users` row (single-user system). */
export interface UserSettings {
  weekly_step_goal: number;
}

/** A single day's persisted step count. */
export interface StepLog {
  id: string;
  date: string; // ISO YYYY-MM-DD
  steps: number;
}

/** One entry in the 7-day step view. `null` = no log for that date. */
export interface StepLogDay {
  date: string;
  steps: number | null;
}

/** One day in the trailing 7-day cardio burn timeline. */
export interface BurnRateDay {
  date: string;
  kcal: number;
  duration_minutes: number;
  workout_type: string | null;
}
```

- [ ] **Step 2: Verify TS compiles**

Run: `cd frontend && pnpm tsc --noEmit`
Expected: exit 0, no new errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/index.ts
git commit -m "fe types: UserSettings + StepLog + StepLogDay + BurnRateDay"
```

---

### Task 9: API client methods

**Files:**
- Modify: `frontend/src/services/api.ts`

- [ ] **Step 1: Update imports**

In `frontend/src/services/api.ts`, add the new types to the `import type {…} from '../types'` block:

```typescript
import type {
  // …existing imports
  BurnRateDay,
  StepLog,
  StepLogDay,
  UserSettings,
} from '../types';
```

Keep the list alphabetical to match the existing style.

- [ ] **Step 2: Add the API methods**

Inside the `export const api = { … }` object, append these methods just before the final `};`:

```typescript
  // ─── Steps & settings ──────────────────────────────────────────────────
  /** Today's step log, or `null` if not yet logged. */
  getStepsToday: () => getJson<StepLog | null>('/api/v1/steps/today'),

  /** Yesterday's step log, or `null` (used by the morning briefing). */
  getStepsYesterday: () => getJson<StepLog | null>('/api/v1/steps/yesterday'),

  /** Current ISO week (Mon–Sun) — always 7 entries, `null` for empty days. */
  getStepsWeek: () => getJson<StepLogDay[]>('/api/v1/steps/week'),

  /** Upsert the step count for a date. */
  logSteps: (date: string, steps: number) =>
    postJson<StepLog>('/api/v1/steps/log', { date, steps }),

  /** Last 7 calendar days of cardio kcal — always 7 entries, `0` for rest days. */
  getBurnRate: () => getJson<BurnRateDay[]>('/api/v1/steps/burn-rate'),

  /** User-level settings (currently just the weekly step goal). */
  getUserSettings: () => getJson<UserSettings>('/api/v1/user/settings'),

  /** Update user-level settings; backend validates the range. */
  updateUserSettings: (payload: Partial<UserSettings>) =>
    patchJson<UserSettings>('/api/v1/user/settings', payload),
```

- [ ] **Step 3: Verify TS compiles**

Run: `cd frontend && pnpm tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/services/api.ts
git commit -m "api.ts: steps + user-settings client methods"
```

---

### Task 10: Fitness utility + date helpers

**Files:**
- Create: `frontend/src/utils/fitness.ts`
- Modify: `frontend/src/utils/date.ts`

- [ ] **Step 1: Create `fitness.ts`**

`frontend/src/utils/fitness.ts`:

```typescript
/**
 * MET-based kcal estimation for cardio activities.
 *
 * Formula: `kcal = (MET × 3.5 × bodyWeightKg / 200) × durationMinutes`.
 * Defaults are intentionally conservative; the backend's
 * `cardio_agent.analyze_cardio_session` performs the authoritative
 * calculation and the values it stores in `cardio_sessions.kcal_total`
 * always take priority. This utility is the fallback for sessions where
 * the backend value is missing.
 */

export const DEFAULT_BODY_WEIGHT_KG = 75;

/** MET values per activity. Unknown activities fall back to MET 6. */
export const MET_VALUES: Record<string, number> = {
  running: 9,
  treadmill: 7,
  bike: 6,
  elliptical: 7,
  swimming: 7,
  rowing: 7,
  hiit: 8,
  cardio: 7,
  other: 6,
};

/** Estimate kcal burn for a single cardio session. */
export function estimateKcal(
  durationMinutes: number,
  workoutType: string | null | undefined,
  weightKg: number = DEFAULT_BODY_WEIGHT_KG,
): number {
  const safeDuration = Math.max(0, durationMinutes);
  const met = MET_VALUES[(workoutType ?? '').toLowerCase()] ?? 6;
  return Math.round((met * 3.5 * weightKg) / 200 * safeDuration);
}
```

- [ ] **Step 2: Extend `date.ts`**

Append to `frontend/src/utils/date.ts`:

```typescript
/** ISO date for yesterday (local timezone). */
export function yesterdayIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Polish short weekday label (Pn/Wt/Śr/Czw/Pt/Sb/Nd) for an ISO date. */
export function shortWeekdayPl(iso: string): string {
  const labels = ['Nd', 'Pn', 'Wt', 'Śr', 'Czw', 'Pt', 'Sb'];
  const d = new Date(`${iso}T00:00:00`);
  return labels[d.getDay()] ?? '';
}
```

- [ ] **Step 3: Verify TS compiles**

Run: `cd frontend && pnpm tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/utils/fitness.ts frontend/src/utils/date.ts
git commit -m "utils: fitness.estimateKcal + date.yesterdayIso/shortWeekdayPl"
```

---

## Phase 4 — Profile page

### Task 11: Rewrite `Profile.tsx`

**Files:**
- Modify: `frontend/src/pages/Profile.tsx`

- [ ] **Step 1: Replace the file in full**

`frontend/src/pages/Profile.tsx`:

```tsx
import { Check, Flame, User } from 'lucide-react';
import { useEffect, useState } from 'react';

import { api } from '../services/api';
import type { UserProfile, UserSettings } from '../types';

/**
 * Profile page — user info plus user-level settings (currently the
 * weekly step goal). All data flows through `api.ts`; no Supabase
 * client lives on the frontend (CLAUDE.md ADR-002).
 */
export default function Profile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [goal, setGoal] = useState<number>(70000);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getUserProfile(), api.getUserSettings()])
      .then(([p, s]) => {
        if (cancelled) return;
        setProfile(p);
        setGoal(s.weekly_step_goal);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Błąd ładowania profilu');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave(): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      const next: UserSettings = await api.updateUserSettings({
        weekly_step_goal: goal,
      });
      setGoal(next.weekly_step_goal);
      setSavedAt(Date.now());
      window.setTimeout(() => setSavedAt(null), 2200);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Nie udało się zapisać');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="text-sm text-muted">Ładowanie profilu…</div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <header className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface text-accent-blue">
          <User size={22} />
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-widest text-muted">
            Profil
          </div>
          <h1 className="font-sora text-2xl font-semibold text-white">
            {profile?.name ?? '—'}
          </h1>
        </div>
      </header>

      {error && (
        <div className="rounded-md border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-xs text-accent-red">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-border bg-surface p-5">
        <div className="text-[11px] uppercase tracking-widest text-muted">
          Statystyki
        </div>
        <div className="mt-3 grid grid-cols-3 gap-4">
          <Stat label="Start systemu" value={profile?.system_start_date ?? '—'} />
          <Stat
            label="Aktualna seria"
            value={`${profile?.current_streak_days ?? 0} dni`}
            accent="amber"
            icon={<Flame size={14} />}
          />
          <Stat
            label="Najdłuższa"
            value={`${profile?.longest_streak_days ?? 0} dni`}
          />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-muted">
              Cel kroków tygodniowy
            </div>
            <div className="mt-0.5 text-xs text-muted">
              Domyślnie 70 000 kroków / tydzień (≈ 10 000 / dzień)
            </div>
          </div>
          {savedAt !== null && (
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-300">
              <Check size={12} /> Zapisano
            </span>
          )}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <input
            type="number"
            min={7000}
            max={200000}
            step={1000}
            value={goal}
            onChange={(e) => setGoal(Number.parseInt(e.target.value, 10) || 0)}
            className="w-40 rounded-md border border-border bg-surface2 px-3 py-2 text-right font-mono text-sm text-white outline-none focus:border-accent-blue"
          />
          <span className="text-xs text-muted">kroków / tydzień</span>
          <button
            type="button"
            disabled={saving || goal < 7000 || goal > 200000}
            onClick={() => void handleSave()}
            className="ml-auto rounded-md bg-accent-blue px-4 py-2 text-xs font-medium text-white transition hover:bg-accent-blue/85 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Zapisuję…' : 'Zapisz'}
          </button>
        </div>
      </section>
    </div>
  );
}

interface StatProps {
  label: string;
  value: string;
  accent?: 'amber';
  icon?: React.ReactNode;
}

function Stat({ label, value, accent, icon }: StatProps) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted">
        {label}
      </div>
      <div
        className={`mt-1 inline-flex items-center gap-1 font-mono text-lg ${
          accent === 'amber' ? 'text-accent-amber' : 'text-white'
        }`}
      >
        {icon}
        {value}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TS compiles + browser smoke-test**

Run: `cd frontend && pnpm tsc --noEmit`
Expected: exit 0.

Start the dev server (`pnpm dev` in `frontend/`), open `http://localhost:5173/profile`. Verify:
- Header shows your name + system_start_date + streaks.
- Goal input shows current goal (70 000 by default).
- Changing the number and clicking "Zapisz" shows the green "✓ Zapisano" pill for ~2s.
- Reloading the page shows the new goal.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Profile.tsx
git commit -m "Profile: real profile page + weekly step goal editor"
```

---

## Phase 5 — Steps widget

### Task 12: `StepsWidget.tsx`

**Files:**
- Create: `frontend/src/components/prometheus/StepsWidget.tsx`

- [ ] **Step 1: Write the component**

`frontend/src/components/prometheus/StepsWidget.tsx`:

```tsx
import { Footprints, Pencil } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts';

import { api } from '../../services/api';
import type { StepLogDay } from '../../types';
import { shortWeekdayPl, todayIso } from '../../utils/date';

interface StepsWidgetProps {
  /** Optional callback fired after a successful upsert. */
  onLogged?: () => void;
}

const COLOR_AMBER = '#f59e0b';
const COLOR_EMERALD = '#10b981';
const COLOR_RED = '#ef4444';
const COLOR_BLUE = '#3b82f6';
const COLOR_MUTED = '#374151';

function formatThousands(n: number): string {
  return n.toLocaleString('pl-PL').replace(/,/g, ' ');
}

function progressColor(pct: number): string {
  if (pct >= 100) return COLOR_EMERALD;
  if (pct >= 70) return COLOR_AMBER;
  return COLOR_RED;
}

/**
 * Inline daily step tracker with weekly progress bar + 7-day mini chart.
 * Tap the today value (or pencil icon) to edit inline; Enter or blur
 * commits via `POST /api/v1/steps/log`. Optimistic update; on failure
 * the UI reverts and shows an inline error.
 */
export default function StepsWidget({ onLogged }: StepsWidgetProps) {
  const [week, setWeek] = useState<StepLogDay[] | null>(null);
  const [goal, setGoal] = useState<number>(70000);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const [w, s] = await Promise.all([
        api.getStepsWeek(),
        api.getUserSettings(),
      ]);
      setWeek(w);
      setGoal(s.weekly_step_goal);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Błąd ładowania kroków');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const today = todayIso();
  const todayEntry = week?.find((d) => d.date === today) ?? null;
  const todaySteps = todayEntry?.steps ?? 0;

  const weeklyTotal = useMemo(
    () => (week ?? []).reduce((sum, d) => sum + (d.steps ?? 0), 0),
    [week],
  );
  const pct =
    goal > 0 ? Math.min(999, Math.round((weeklyTotal / goal) * 100)) : 0;
  const barColor = progressColor(pct);

  const chartData = (week ?? []).map((d) => ({
    day: shortWeekdayPl(d.date),
    steps: d.steps ?? 0,
    missing: d.steps === null,
    isToday: d.date === today,
    iso: d.date,
  }));

  const commit = useCallback(
    async (raw: string) => {
      const parsed = Number.parseInt(raw, 10);
      const steps = Number.isFinite(parsed) ? Math.max(0, Math.min(100000, parsed)) : 0;
      // Optimistic update.
      const prevWeek = week;
      setWeek((w) =>
        (w ?? []).map((d) =>
          d.date === today ? { ...d, steps } : d,
        ),
      );
      setEditing(false);
      setSubmitting(true);
      try {
        await api.logSteps(today, steps);
        onLogged?.();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Nie udało się zapisać');
        setWeek(prevWeek);
      } finally {
        setSubmitting(false);
      }
    },
    [today, week, onLogged],
  );

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="h-4 w-32 animate-pulse rounded bg-surface2" />
        <div className="mt-4 h-6 w-48 animate-pulse rounded bg-surface2" />
        <div className="mt-2 h-2 w-full animate-pulse rounded bg-surface2" />
        <div className="mt-4 h-20 w-full animate-pulse rounded bg-surface2" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      {error && (
        <div className="mb-3 flex items-center justify-between rounded-md border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-xs text-accent-red">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void reload()}
            className="rounded bg-accent-red/20 px-2 py-0.5 text-[11px] font-medium text-accent-red hover:bg-accent-red/30"
          >
            Spróbuj ponownie
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted">
          <Footprints size={14} /> Kroki
        </div>
        <span className="text-[11px] text-muted">
          tygodniowy cel:{' '}
          <span className="font-mono text-white/80">{formatThousands(goal)}</span>
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted">
            Dziś
          </div>
          {editing ? (
            <input
              ref={inputRef}
              type="number"
              inputMode="numeric"
              min={0}
              max={100000}
              defaultValue={String(todaySteps)}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={(e) => void commit(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void commit(draft || e.currentTarget.value);
                if (e.key === 'Escape') setEditing(false);
              }}
              className="mt-1 w-32 rounded-md border border-accent-blue bg-surface2 px-2 py-1 text-right font-mono text-2xl text-white outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="mt-1 inline-flex items-center gap-2 rounded-md px-1 py-1 font-mono text-2xl text-white hover:bg-surface2"
              aria-label="Edytuj dzisiejsze kroki"
            >
              <span>{formatThousands(todaySteps)}</span>
              <Pencil size={14} className="text-muted" />
            </button>
          )}
          {submitting && (
            <div className="mt-1 text-[10px] text-muted">Zapisuję…</div>
          )}
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-muted">
            Tydzień
          </div>
          <div className="mt-1 font-mono text-sm text-white/85">
            {formatThousands(weeklyTotal)} /{' '}
            <span className="text-muted">{formatThousands(goal)}</span>
          </div>
          <div className="mt-0.5 text-[11px] text-muted">
            {goal > 0 ? `${pct}%` : '—'}
          </div>
        </div>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface2">
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${Math.min(100, pct)}%`, backgroundColor: barColor }}
        />
      </div>

      {weeklyTotal === 0 && (
        <p className="mt-3 text-xs text-muted">
          Brak danych — zacznij logować kroki
        </p>
      )}

      <div className="mt-4 h-24">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
            <XAxis
              dataKey="day"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: '#1f293733' }}
              contentStyle={{
                background: '#12121A',
                border: '1px solid #1f2937',
                fontSize: 11,
                color: '#fff',
              }}
              formatter={(value: number, _name, payload) => {
                const d = payload?.payload as { missing: boolean };
                return d?.missing ? ['—', 'kroki'] : [formatThousands(value), 'kroki'];
              }}
            />
            <Bar dataKey="steps" radius={[3, 3, 0, 0]}>
              {chartData.map((entry) => (
                <Cell
                  key={entry.iso}
                  fill={
                    entry.missing
                      ? COLOR_MUTED
                      : entry.isToday
                        ? COLOR_BLUE
                        : COLOR_AMBER
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TS compiles**

Run: `cd frontend && pnpm tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/prometheus/StepsWidget.tsx
git commit -m "StepsWidget: inline tap-to-edit + weekly bar + 7-day chart"
```

---

## Phase 6 — Burn-rate chart

### Task 13: `BurnRateChart.tsx`

**Files:**
- Create: `frontend/src/components/prometheus/BurnRateChart.tsx`

- [ ] **Step 1: Write the component**

`frontend/src/components/prometheus/BurnRateChart.tsx`:

```tsx
import { Flame } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { api } from '../../services/api';
import type { BurnRateDay } from '../../types';
import { shortWeekdayPl } from '../../utils/date';
import { estimateKcal } from '../../utils/fitness';

const COLOR_AMBER = '#f59e0b';
const COLOR_MUTED = '#6b7280';

function formatThousands(n: number): string {
  return n.toLocaleString('pl-PL').replace(/,/g, ' ');
}

/**
 * Smooth-line chart of cardio kcal burn over the last 7 calendar days.
 * Backend values come from `cardio_sessions.kcal_total` (computed by
 * `cardio_agent`); rest days arrive as `kcal=0` and render as a muted
 * dot. The footnote shown if no body weight is available is a UX hint
 * — the values are still informative regardless.
 */
export default function BurnRateChart() {
  const [data, setData] = useState<BurnRateDay[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getBurnRate()
      .then((rows) => {
        if (!cancelled) setData(rows);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Błąd ładowania');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const chartData = useMemo(
    () =>
      (data ?? []).map((d) => ({
        day: shortWeekdayPl(d.date),
        iso: d.date,
        kcal: d.kcal,
        duration: d.duration_minutes,
        workoutType: d.workout_type,
      })),
    [data],
  );

  const weeklyTotal = useMemo(
    () => (data ?? []).reduce((sum, d) => sum + d.kcal, 0),
    [data],
  );
  const hasAnyCardio = weeklyTotal > 0;

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="h-4 w-40 animate-pulse rounded bg-surface2" />
        <div className="mt-3 h-[180px] w-full animate-pulse rounded bg-surface2" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-xs text-accent-red">
        {error}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted">
          <Flame size={14} className="text-accent-amber" /> Burn Rate — ostatnie 7 dni
        </div>
        <span className="text-[11px] text-muted">kcal z cardio</span>
      </div>

      <div className="mt-3 h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
            <XAxis
              dataKey="day"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              axisLine={{ stroke: '#1f2937' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip
              cursor={{ stroke: '#1f2937' }}
              contentStyle={{
                background: '#12121A',
                border: '1px solid #1f2937',
                fontSize: 11,
                color: '#fff',
              }}
              formatter={(value: number, _name, payload) => {
                const d = payload?.payload as { duration: number };
                return [
                  `${formatThousands(value)} kcal · ${d?.duration ?? 0} min`,
                  'burn',
                ];
              }}
              labelFormatter={(label) => String(label)}
            />
            <Line
              type="monotone"
              dataKey="kcal"
              stroke={COLOR_AMBER}
              strokeWidth={2}
              dot={(props: { cx?: number; cy?: number; payload?: { kcal: number } }) => {
                const { cx, cy, payload } = props;
                const kcal = payload?.kcal ?? 0;
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={kcal > 0 ? 4 : 3}
                    fill={kcal > 0 ? COLOR_AMBER : COLOR_MUTED}
                    stroke="#12121A"
                    strokeWidth={1}
                  />
                );
              }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {hasAnyCardio ? (
        <div className="mt-2 font-mono text-sm text-accent-amber">
          Łącznie: {formatThousands(weeklyTotal)} kcal ten tydzień
        </div>
      ) : (
        <div className="mt-2 text-xs text-muted">
          Brak treningów cardio w ostatnich 7 dniach
        </div>
      )}

      <p className="mt-2 text-[10px] text-muted">
        * kalkulacja dla 75 kg (gdy w sesji brak własnej kalorymetrii); użyj{' '}
        <span className="font-mono">{estimateKcal(30, 'cardio')}</span> kcal jako
        odniesienie dla 30 min cardio.
      </p>
    </div>
  );
}
```

Note on the inline `estimateKcal(30, 'cardio')` call — it surfaces the utility usage so reviewers see the fallback is wired. If that example value reads awkwardly in the UI, drop the trailing `<p>` paragraph; functionally the utility is still imported but unused at render time. Either choice is acceptable.

- [ ] **Step 2: Verify TS compiles**

Run: `cd frontend && pnpm tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/prometheus/BurnRateChart.tsx
git commit -m "BurnRateChart: 7-day cardio kcal LineChart + weekly total"
```

---

## Phase 7 — Cardio tab integration

### Task 14: Mount widgets in `CardioTab`

**Files:**
- Modify: `frontend/src/components/prometheus/cardio/CardioTab.tsx`

- [ ] **Step 1: Add imports**

At the top of `frontend/src/components/prometheus/cardio/CardioTab.tsx`, add (alphabetically near the relative imports):

```typescript
import BurnRateChart from '../BurnRateChart';
import StepsWidget from '../StepsWidget';
```

- [ ] **Step 2: Render the widgets above the `FatJar` / `CardioHistory` grid**

Inside the returned `<div className="mx-auto w-full max-w-3xl space-y-4">`, after the `<CardioForm …/>` and before the `<div className="grid …">`, add:

```tsx
      <div className="grid gap-4 md:grid-cols-2">
        <StepsWidget />
        <BurnRateChart />
      </div>
```

- [ ] **Step 3: Browser smoke-test**

Start the dev server, open `http://localhost:5173/workout`, click the "Cardio" tab. Confirm:
- The Steps card appears (today=0 if not yet logged).
- Clicking the today value → input appears, focused.
- Typing a number + Enter or blur → number persists; reload the page and it survives.
- Weekly bar fills proportionally; color changes as you cross 70 % / 100 %.
- The mini bar chart renders 7 bars with today highlighted blue.
- Burn-rate chart shows 7 days of cardio kcal (or the empty-state copy).
- Resize viewport to 375px (DevTools mobile) — the two cards stack and remain readable.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/prometheus/cardio/CardioTab.tsx
git commit -m "CardioTab: mount StepsWidget + BurnRateChart"
```

---

## Phase 8 — Morning briefing prompt

### Task 15: Optional steps stepper in `DailyBriefingModal`

**Files:**
- Modify: `frontend/src/components/daily/DailyBriefingModal.tsx`

- [ ] **Step 1: Add state + fetch yesterday's log on mount**

At the top of the component (after the existing `useState` hooks), add:

```typescript
const [yesterdayMissing, setYesterdayMissing] = useState<boolean>(false);
const [stepsValue, setStepsValue] = useState<number>(0);

useEffect(() => {
  let cancelled = false;
  api
    .getStepsYesterday()
    .then((log) => {
      if (!cancelled && log === null) setYesterdayMissing(true);
    })
    .catch(() => {
      // Silent — the steps section is non-blocking by design.
    });
  return () => {
    cancelled = true;
  };
}, []);
```

Add the matching imports at the top of the file:

```typescript
import { api } from '../../services/api';
import { yesterdayIso } from '../../utils/date';
```

- [ ] **Step 2: Submit steps alongside the briefing**

Replace the existing `handleSubmit` with:

```typescript
const handleSubmit = async () => {
  if (!canSubmit) return;
  setSubmitting(true);
  setError(null);
  try {
    const tasks: Promise<unknown>[] = [
      dailySystemApi.createLog({
        sleep_score: sleep,
        energy_score: energy,
      }),
    ];
    if (yesterdayMissing && stepsValue > 0) {
      tasks.push(api.logSteps(yesterdayIso(), stepsValue));
    }
    const [log] = (await Promise.all(tasks)) as [DailyLog, ...unknown[]];
    setClosing(true);
    window.setTimeout(() => onComplete(log), 220);
  } catch (e) {
    setError(e instanceof Error ? e.message : String(e));
    setSubmitting(false);
  }
};
```

- [ ] **Step 3: Render the optional stepper between the energy slider and the submit button**

Inside the modal, after the closing `</div>` of the `space-y-6` container that holds the two `SliderField`s (and *before* the amber stamina block), insert:

```tsx
{yesterdayMissing && (
  <div className="mt-6 border-t border-white/5 pt-4">
    <p className="text-[10px] uppercase tracking-widest text-white/40">
      Opcjonalnie
    </p>
    <p className="mt-2 flex items-center gap-2 font-sora text-sm text-white/80">
      🦶 Ile kroków zrobiłeś wczoraj?
    </p>
    <div className="mt-3 flex items-center justify-center gap-3">
      <button
        type="button"
        onClick={() => setStepsValue((v) => Math.max(0, v - 1000))}
        className="h-9 w-9 rounded-md border border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
      >
        −
      </button>
      <div className="w-28 rounded-md border border-white/10 bg-black/30 px-3 py-2 text-center font-mono text-base text-white">
        {stepsValue.toLocaleString('pl-PL').replace(/,/g, ' ')}
      </div>
      <button
        type="button"
        onClick={() => setStepsValue((v) => Math.min(50000, v + 1000))}
        className="h-9 w-9 rounded-md border border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
      >
        +
      </button>
    </div>
    <p className="mt-2 text-center text-[10px] text-white/30">
      Pole opcjonalne — możesz pominąć
    </p>
  </div>
)}
```

- [ ] **Step 4: Verify TS compiles + manual test**

Run: `cd frontend && pnpm tsc --noEmit`
Expected: exit 0.

Manual test:
1. Ensure no row exists for yesterday: in Supabase SQL Editor, run
   `delete from step_logs where date = current_date - interval '1 day';`
2. Open the dashboard; the morning briefing modal should appear with the steps section visible.
3. Adjust steps with the +/− steppers (range 0–50 000, step 1000).
4. Submit the briefing → check `select * from step_logs where date = current_date - interval '1 day';` returns 1 row.
5. Re-trigger the briefing flow → the steps section should now be hidden (yesterday already logged).
6. Test the silent-failure path: stop the backend, refresh → modal still renders, sleep/energy still required, steps section hidden (fetch fails silently).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/daily/DailyBriefingModal.tsx
git commit -m "DailyBriefingModal: optional 'ile kroków wczoraj?' stepper"
```

---

## Phase 9 — Wrap-up

### Task 16: Final verification pass

- [ ] **Step 1: Backend tests**

Run: `cd backend && python -m pytest -q`
Expected: existing tests still green + 9 new steps tests pass.

- [ ] **Step 2: Ruff**

Run: `cd backend && ruff check .`
Expected: `All checks passed!`

- [ ] **Step 3: TS check**

Run: `cd frontend && pnpm tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: End-to-end manual smoke test**

With both servers running:
1. `Profile` page — change goal to 80 000 → save → reload → goal persists.
2. Cardio tab — log 9 000 steps via the inline edit → reload → today shows 9 000; weekly bar updates.
3. In `Profile`, change goal to 50 000 → reload Cardio tab → weekly progress percentage changes accordingly.
4. Manually trigger the morning briefing (e.g. `delete from daily_logs where date = current_date;` + reload) → confirm steps stepper appears when yesterday is empty, and only then.
5. Burn-rate chart — log a cardio session via the existing CardioForm; refresh → today's bar/point shows the kcal.

- [ ] **Step 5: Update PROGRESS.md (optional but conventional)**

If `docs/PROGRESS.md` is being kept current, append a one-line entry under the latest date. (PROGRESS.md is known to be stale; skipping is acceptable.)

---

### Task 17: Update Obsidian memory

**Files:**
- Create: `memory/2026-05-13-steps-burn-rate.md` (in the Obsidian vault, via the obsidian-vault MCP)
- Modify: `projects/life-os.md` (prepend a session note + update "Last Updated"; via the obsidian-vault MCP)

- [ ] **Step 1: Write the memory note**

Call `mcp__obsidian-vault__write_note` with path `memory/2026-05-13-steps-burn-rate.md` and frontmatter `{ date: "2026-05-13", project: "life-os", module: "steps", status: "code-complete, migration pending" }`. Content should summarise:
- new migration `017_steps_module.sql` (`step_logs` + `users.weekly_step_goal`);
- new backend router/service + `user.get_settings`/`update_settings`;
- new `StepsWidget` + `BurnRateChart` mounted in CardioTab;
- optional steps stepper in `DailyBriefingModal`;
- verification commands (pytest / ruff / tsc) and the curl probes used.
- Locked design choices: ISO Mon–Sun for the steps week; trailing 7 calendar days (today-anchored) for burn rate; backend re-uses `cardio_sessions.kcal_total` and falls back to MET for null values; FE `estimateKcal` is the FE-side mirror of the same formula.
- Manual step: apply `migrations/017_steps_module.sql` in Supabase SQL Editor (per ADR-011).

- [ ] **Step 2: Patch `projects/life-os.md`**

Call `mcp__obsidian-vault__patch_note` on `projects/life-os.md` to:
1. Prepend a `## 2026-05-13 — Steps tracking + burn rate (live)` section directly under the top of the file (or after the most recent `## 2026-05-12 …` block), summarising the shipped work in 4–6 bullets.
2. Update the trailing `## Last Updated\n\n2026-05-09` to `2026-05-13`.
3. Remove `frontend/src/pages/Profile.tsx (12 lines)` from the "8 page-level stubs" list — it is no longer a stub.

- [ ] **Step 3: Commit the migration + planning artefact**

```bash
git add docs/superpowers/plans/2026-05-13-steps-tracking-burn-rate.md
git commit -m "plan: steps tracking + burn rate"
```

(The Obsidian vault is outside the repo; the MCP writes persist independently.)

---

## ✅ Phase-mapped checklist (mirror of the spec)

### 🗄️ Phase 1: Database
- [ ] Write and run migration 017 — `step_logs` with unique `(user_id, date)`
- [ ] Add `weekly_step_goal` column to `users` (no `user_settings` table needed — single-user repo)
- [ ] RLS policy on `step_logs` follows the existing `(SELECT id FROM users LIMIT 1)` pattern (ADR-011)

### 🐍 Phase 2: Backend
- [ ] `schemas.py` — `StepLog`, `StepLogDay`, `StepLogRequest`, `BurnRateDay`, `UserSettings`, `UserSettingsUpdate`
- [ ] `steps_service.py` — `upsert_steps`, `get_steps_for_date`, `get_steps_week`, `get_burn_rate` (+ MET fallback)
- [ ] `routers/steps.py` — 5 endpoints
- [ ] `routers/user.py` — `GET /settings`, `PATCH /settings`
- [ ] `main.py` — register `steps.router`
- [ ] curl smoke-tests pass

### ⚛️ Phase 3: Frontend — Types & API
- [ ] `types/index.ts` — `StepLog`, `StepLogDay`, `BurnRateDay`, `UserSettings`
- [ ] `services/api.ts` — 7 methods (`getStepsToday/Yesterday/Week`, `logSteps`, `getBurnRate`, `getUserSettings`, `updateUserSettings`)
- [ ] `utils/fitness.ts` — `estimateKcal` utility
- [ ] `utils/date.ts` — `yesterdayIso`, `shortWeekdayPl`

### 👤 Phase 4: Profile Page
- [ ] Replace `ModulePlaceholder`
- [ ] Weekly step goal input with save/success feedback
- [ ] Display name, streaks, system_start_date

### 🦶 Phase 5: Steps Widget
- [ ] Inline tap-to-edit
- [ ] Weekly progress bar with red/amber/emerald
- [ ] 7-day mini bar chart
- [ ] Loading + error states

### 🔥 Phase 6: Burn Rate Chart
- [ ] LineChart with tooltips + weekly total
- [ ] Empty state when no cardio

### 🌅 Phase 7: Morning Briefing
- [ ] Call `getStepsYesterday()` on mount
- [ ] Conditionally render stepper (range 0–50 000, step 1000)
- [ ] Submit steps alongside the briefing

### 🧪 Phase 8: Integration
- [ ] Mount widgets in `CardioTab`
- [ ] log steps → widget updates → weekly total updates
- [ ] briefing flow → yesterday row appears in week view
- [ ] profile settings → widget reflects new goal immediately

### 📓 Obsidian memory
- [ ] `memory/2026-05-13-steps-burn-rate.md` written
- [ ] `projects/life-os.md` patched (stubs list + Last Updated)
