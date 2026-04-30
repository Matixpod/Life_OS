# 📝 TASK SYSTEM — Coding Prompt

## [ROLE / CONTEXT]

You are an expert Python/FastAPI + React/TypeScript developer extending an existing
Life OS application. The system already has:
- KRONOS agent fully implemented (streak tracking, pattern analysis, PvE scoring)
- Supabase PostgreSQL with `tasks` table already created (schema in `001_kronos_schema.sql`)
- Authentication via Supabase JWT (`get_current_user` dependency in FastAPI)
- React 18 + TailwindCSS v3 + React Router v6 frontend

You are building the **Task System** — the primary data entry interface for the entire
application. Every other agent (ARES, ATHENA, KRONOS) depends on data produced here.
Without tasks, no agent has anything to analyze.

---

## [TASK]

Implement a complete Task System with:
1. FastAPI CRUD backend for tasks
2. Daily and Weekly view components in React
3. Quick-add task input (keyboard shortcut, no modal required)
4. Task completion flow with XP feedback animation
5. Category-aware task display (mapped to RPG stats: Vitality, Intellect, etc.)
6. KRONOS integration — dashboard auto-refreshes after task state changes

---

## [TECHNICAL CONSTRAINTS]

- **Language**: Python 3.12, TypeScript (strict mode)
- **Backend**: FastAPI + Pydantic v2 + supabase-py + uvicorn
- **Frontend**: React 18 + TailwindCSS v3 + Lucide React + React Router v6 + Recharts
- **Database**: Supabase PostgreSQL (tasks table already exists — do NOT recreate it)
- **Linting**: ruff (Python), ESLint + Prettier (TypeScript)
- **Package manager**: pnpm (frontend)
- **Auth**: All routes use existing `get_current_user` FastAPI dependency
- **No new DB migrations** — tasks table schema is already defined in KRONOS migration

---

## [REQUIREMENTS]

### Backend — API Routes (`/app/routers/tasks.py`)

```
GET    /api/tasks                  → list tasks (filters: date, category, status)
POST   /api/tasks                  → create task
PATCH  /api/tasks/{id}             → update task (status, title, priority, date)
DELETE /api/tasks/{id}             → soft delete (set status = 'skipped')
POST   /api/tasks/{id}/complete    → mark as done + trigger KRONOS context refresh
POST   /api/tasks/{id}/skip        → mark as skipped
GET    /api/tasks/today            → tasks for today (most used endpoint)
GET    /api/tasks/week             → tasks for current ISO week
GET    /api/tasks/backlog          → tasks with no scheduled_date (backlog)
```

### Backend — Task Service (`/app/services/task_service.py`)

- `create_task(user_id, data) -> Task` — validates category, sets default priority
- `complete_task(user_id, task_id) -> TaskCompletionResult` — sets status=done,
  completed_at=now(), computes XP earned, triggers KRONOS streak update
- `get_daily_tasks(user_id, date) -> DailyTaskList` — groups tasks by category,
  returns completion stats per category for that day
- `get_weekly_tasks(user_id, week_start) -> WeeklyTaskList` — 7-day breakdown,
  per-day completion counts
- `compute_xp(task: Task) -> int` — XP formula:
  - base: priority low=10, medium=25, high=50
  - bonus: completed before 12:00 = +20% (early bird)
  - bonus: high priority completed on scheduled date = +30%
  - bonus: part of active streak (3+ days) = +15%
  - returns final XP as integer

### Pydantic v2 Models (`/app/models/task_models.py`)

```python
class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    category: TaskCategory
    priority: TaskPriority = TaskPriority.MEDIUM
    scheduled_date: date
    estimated_minutes: int | None = Field(None, ge=5, le=480)
    notes: str | None = Field(None, max_length=1000)

class TaskUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    scheduled_date: date | None = None
    estimated_minutes: int | None = None
    notes: str | None = None

class Task(BaseModel):
    id: str
    user_id: str
    title: str
    category: TaskCategory
    status: TaskStatus
    priority: TaskPriority
    scheduled_date: date
    completed_at: datetime | None
    estimated_minutes: int | None
    notes: str | None
    created_at: datetime

class TaskCompletionResult(BaseModel):
    task: Task
    xp_earned: int
    streak_updated: bool
    new_streak: int
    bonus_reasons: list[str]   # ["early_bird", "on_schedule", "streak_bonus"]

class DailyTaskList(BaseModel):
    date: date
    tasks: list[Task]
    by_category: dict[str, CategoryDaySummary]
    total_planned: int
    total_completed: int
    completion_rate: float

class CategoryDaySummary(BaseModel):
    category: TaskCategory
    planned: int
    completed: int
    xp_earned: int

class WeeklyTaskList(BaseModel):
    week_start: date
    week_end: date
    days: list[DailyTaskList]
    total_xp: int
    best_day: date | None
    worst_day: date | None
```

### Frontend — Components (`/src/components/tasks/`)

**`TaskDashboard.tsx`** — main container:
- Tab switcher: Dziś / Tydzień / Backlog
- QuickAdd bar always visible at top
- KRONOS alert strip (if alerts exist, show top banner)
- Auto-refresh KRONOS context after any task state change

**`QuickAdd.tsx`** — fast task input:
- Single text input always visible (not in modal)
- Keyboard shortcut: `N` focuses input from anywhere
- Inline category selector (icon pills, not dropdown)
- Inline priority selector (L / M / H toggle)
- `Enter` to submit, `Escape` to clear
- Defaults: today's date, medium priority

**`DailyView.tsx`** — today's tasks:
- Grouped by category with category header (icon + name + XP earned today)
- Each task: checkbox + title + priority badge + estimated time
- Click checkbox → complete animation → XP popup (+25 XP ⚡)
- Overdue tasks from previous days shown in red at top with "Przenieś na dziś" button
- Empty state per category: "Brak zadań — dodaj pierwsze"

**`TaskCard.tsx`** — single task item:
- Checkbox (animated on complete)
- Title (strikethrough when done)
- Priority indicator (colored left border: red/amber/slate)
- Category icon (small, from Lucide React)
- Estimated time badge (if set)
- Hover: show Edit / Skip / Delete actions
- Done state: muted colors, checkmark icon

**`WeeklyView.tsx`** — 7-day overview:
- Column per day (Mon–Sun)
- Each column: date header + tasks list + day completion bar
- Current day highlighted
- Click day → expands to show DailyView for that day
- Summary row: total XP per day as mini bar chart (Recharts)

**`BacklogView.tsx`** — tasks without date:
- List of unscheduled tasks
- Drag to day (or "Schedule for today" button per task)
- Sorted by priority descending

**`XPPopup.tsx`** — completion animation:
- Appears above completed task for 1.5 seconds
- Shows: `+25 XP ⚡` with bonus reasons if any
- CSS animation: float up + fade out
- Does not block interaction

**`CategoryFilter.tsx`** — filter bar:
- Row of category icons (Vitality, Intellect, etc.)
- Click to toggle filter
- "Wszystkie" option
- Persists in localStorage

---

## [INPUT / OUTPUT]

**POST `/api/tasks`** request:
```json
{
  "title": "Bieg 5km",
  "category": "vitality",
  "priority": "high",
  "scheduled_date": "2026-04-29",
  "estimated_minutes": 40
}
```

**POST `/api/tasks/{id}/complete`** response:
```json
{
  "task": { "id": "uuid", "status": "done", "completed_at": "2026-04-29T07:45:00Z", "..." },
  "xp_earned": 72,
  "streak_updated": true,
  "new_streak": 5,
  "bonus_reasons": ["early_bird", "streak_bonus"]
}
```

**GET `/api/tasks/today`** response:
```json
{
  "date": "2026-04-29",
  "tasks": [...],
  "by_category": {
    "vitality": { "category": "vitality", "planned": 2, "completed": 1, "xp_earned": 50 }
  },
  "total_planned": 5,
  "total_completed": 2,
  "completion_rate": 0.4
}
```

---

## [EDGE CASES]

- Task completed after midnight → use user's local date for streak calculation, not UTC
- `complete_task` called on already-done task → return 409 Conflict with message
- `complete_task` called on skipped task → return 422 Unprocessable
- Task scheduled in the past → allow, but flag as overdue in response
- QuickAdd submitted with empty title → prevent submit, shake animation on input
- Backlog task dragged to a past date → warn but allow
- KRONOS context refresh after completion → fire-and-forget (don't block response)
- Weekly view when week has no tasks → show empty columns, not error
- User deletes task that was part of streak → recalculate streak via KRONOS
- `estimated_minutes` must be between 5 and 480 — validate on both frontend and backend

---

## [KRONOS INTEGRATION]

After every `complete_task` or `skip_task`:
1. Call `context_builder.build_context(user_id)` as a `BackgroundTask`
2. This updates streak data in `kronos_streaks` table
3. Frontend subscribes to KRONOS refresh via a shared React context
4. KRONOS dashboard widget (if visible) re-fetches automatically

```python
# In tasks router — after completion
background_tasks.add_task(
    kronos_context_builder.refresh_streaks,
    user_id=current_user.id,
    category=task.category,
)
```

---

## [ADDITIONAL INSTRUCTIONS]

- QuickAdd `N` shortcut must not fire when user is typing in another input
- XP formula must be in one isolated function — easy to tune later
- Priority border colors: high=#ef4444, medium=#f59e0b, low=#94a3b8
- Category colors must match KRONOS theme (same palette across entire app)
- All datetime handling must use `python-dateutil` for timezone safety
- Task title must be trimmed of whitespace before saving
- Soft delete only — never hard delete tasks (data integrity for KRONOS)
- `DailyView` must work offline-first: optimistic UI update on complete, rollback on error
- Include loading skeletons for all list views
- Mobile-friendly: TaskCard tap target minimum 44px height

Think step by step before writing any code.
