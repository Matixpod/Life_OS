# 🔄 SYSTEM REDESIGN — Tasks, Habits, Projects & Unified Calendar

## [ROLE / CONTEXT]

You are modifying an existing Life OS application (FastAPI + React 18 + Supabase).
The system already has:
- KRONOS agent (streak tracking, pattern analysis)
- ARES agent (vitality scoring)
- Task System (daily_tasks table, completion flow, XP engine)
- AI Provider abstraction (Claude/Gemini/DeepSeek/Ollama)

You are implementing a significant UX and architecture redesign:
1. Three task types: regular Tasks, Habits (recurring), Projects (with sections)
2. Unified Calendar view replacing separate Goals/Tasks tabs
3. Smart navigation: clicking any item routes to the relevant AI agent tab
4. Agent task proposals: agents suggest tasks, user approves with one click

This is a MODIFICATION of existing code — do not rewrite working systems.
Make surgical changes. Existing `daily_tasks` table is the base.

---

## [DATABASE CHANGES] (`migrations/008_redesign_schema.sql`)

### Modify existing `daily_tasks` table
```sql
-- Add task_type column to existing table
ALTER TABLE daily_tasks ADD COLUMN IF NOT EXISTS
  task_type TEXT NOT NULL DEFAULT 'task'
  CHECK (task_type IN ('task', 'habit_entry', 'project_task'));

ALTER TABLE daily_tasks ADD COLUMN IF NOT EXISTS habit_id UUID;
ALTER TABLE daily_tasks ADD COLUMN IF NOT EXISTS project_task_id UUID;
```

### New: `habits` table
```sql
CREATE TABLE habits (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  category         task_category NOT NULL,
  priority         task_priority NOT NULL DEFAULT 'medium',
  
  -- Simple recurrence (default)
  recurrence_type  TEXT NOT NULL DEFAULT 'daily'
    CHECK (recurrence_type IN ('daily','weekly','monthly','selected_days','custom')),
  selected_days    INTEGER[],        -- [1,3,5] = Mon/Wed/Fri (ISO weekday 1=Mon)
  monthly_day      INTEGER,          -- day of month (1-31)
  
  -- Advanced recurrence (optional, only when recurrence_type = 'custom')
  custom_rule      JSONB,            -- {interval: 3, unit: 'days'} or {times: 2, per: 'week'}
  
  -- Metadata
  is_active        BOOLEAN NOT NULL DEFAULT true,
  start_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date         DATE,             -- null = infinite
  streak           INTEGER NOT NULL DEFAULT 0,
  longest_streak   INTEGER NOT NULL DEFAULT 0,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### New: `projects` table
```sql
CREATE TABLE projects (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT,
  category         task_category NOT NULL,
  status           TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'archived', 'on_hold')),
  priority         task_priority NOT NULL DEFAULT 'medium',
  due_date         DATE,
  color            TEXT DEFAULT '#6366f1',   -- hex color for UI
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### New: `project_sections` table
```sql
CREATE TABLE project_sections (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  position         INTEGER NOT NULL DEFAULT 0,   -- order within project
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### New: `project_tasks` table
```sql
CREATE TABLE project_tasks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  section_id       UUID REFERENCES project_sections(id) ON DELETE SET NULL,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  status           task_status NOT NULL DEFAULT 'todo',
  priority         task_priority NOT NULL DEFAULT 'medium',
  due_date         DATE,
  completed_at     TIMESTAMPTZ,
  estimated_minutes INTEGER,
  notes            TEXT,
  position         INTEGER NOT NULL DEFAULT 0,   -- order within section
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### New: `agent_task_proposals` table
```sql
CREATE TABLE agent_task_proposals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id         TEXT NOT NULL,          -- 'ares', 'athena', 'kronos' etc.
  proposed_title   TEXT NOT NULL,
  proposed_category task_category NOT NULL,
  proposed_date    DATE NOT NULL,
  proposed_priority task_priority DEFAULT 'medium',
  proposed_type    TEXT NOT NULL DEFAULT 'task'
    CHECK (proposed_type IN ('task', 'habit')),
  reason           TEXT NOT NULL,          -- why agent is proposing this
  status           TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### RLS for all new tables
```sql
ALTER TABLE habits               ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects             ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_sections     ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_tasks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_task_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner" ON habits               FOR ALL USING (user_id = auth.uid());
CREATE POLICY "owner" ON projects             FOR ALL USING (user_id = auth.uid());
CREATE POLICY "owner" ON project_sections     FOR ALL USING (user_id = auth.uid());
CREATE POLICY "owner" ON project_tasks        FOR ALL USING (user_id = auth.uid());
CREATE POLICY "owner" ON agent_task_proposals FOR ALL USING (user_id = auth.uid());
```

---

## [BACKEND — NEW SERVICES]

### `/app/services/habits_service.py`

```python
# Key functions:

async def create_habit(user_id, data: HabitCreate) -> Habit
async def update_habit(user_id, habit_id, data: HabitUpdate) -> Habit
async def delete_habit(user_id, habit_id) -> None          # soft: is_active=false
async def get_habits(user_id) -> list[Habit]

async def generate_habit_entries(user_id, date: date) -> list[DailyTask]
# Called every day (or on calendar load for date range)
# Checks which habits should appear on this date based on recurrence rules
# Creates daily_tasks entries with task_type='habit_entry', habit_id=habit.id
# Idempotent — if entry already exists for this habit+date, skip

async def complete_habit_entry(user_id, daily_task_id) -> HabitCompletionResult
# Marks daily_task as done
# Recalculates habit streak
# Updates habits.streak + habits.longest_streak

def should_habit_appear(habit: Habit, date: date) -> bool
# Recurrence logic:
# daily       → always True
# weekly      → date.weekday() in habit.selected_days (where selected_days=[0..6])
# monthly     → date.day == habit.monthly_day
# selected_days → date.isoweekday() in habit.selected_days
# custom      → parse custom_rule JSON, evaluate
```

### `/app/services/projects_service.py`

```python
async def create_project(user_id, data: ProjectCreate) -> Project
async def update_project(user_id, project_id, data: ProjectUpdate) -> Project
async def archive_project(user_id, project_id) -> Project

async def create_section(user_id, project_id, title, position) -> ProjectSection
async def reorder_sections(user_id, project_id, section_ids: list[str]) -> None

async def create_project_task(user_id, project_id, section_id, data) -> ProjectTask
async def complete_project_task(user_id, task_id) -> ProjectTask
async def reorder_tasks(user_id, section_id, task_ids: list[str]) -> None

async def get_project_full(user_id, project_id) -> ProjectFull
# Returns project + all sections + all tasks per section

async def get_project_progress(project_id) -> ProjectProgress
# total_tasks, completed_tasks, completion_percentage, overdue_count
```

### `/app/services/proposals_service.py`

```python
async def create_proposal(
    user_id: str,
    agent_id: str,
    title: str,
    category: TaskCategory,
    date: date,
    reason: str,
    proposed_type: str = 'task',
    priority: TaskPriority = TaskPriority.MEDIUM,
) -> AgentTaskProposal

async def approve_proposal(user_id, proposal_id) -> DailyTask | Habit
# Creates actual task or habit from proposal
# Sets proposal.status = 'approved'
# If proposed_type = 'habit' → creates in habits table
# If proposed_type = 'task' → creates in daily_tasks table

async def reject_proposal(user_id, proposal_id) -> None

async def get_pending_proposals(user_id) -> list[AgentTaskProposal]
# Only pending + not expired
```

---

## [BACKEND — UPDATED API ROUTES]

### New router: `/app/routers/habits.py`
```
GET    /api/v1/habits                    → list active habits
POST   /api/v1/habits                    → create habit
PATCH  /api/v1/habits/{id}              → update habit
DELETE /api/v1/habits/{id}              → deactivate habit
POST   /api/v1/habits/{id}/complete     → complete today's entry
GET    /api/v1/habits/entries/{date}    → habit entries for a date
```

### New router: `/app/routers/projects.py`
```
GET    /api/v1/projects                        → list projects
POST   /api/v1/projects                        → create project
GET    /api/v1/projects/{id}                   → full project (sections + tasks)
PATCH  /api/v1/projects/{id}                   → update project
POST   /api/v1/projects/{id}/sections          → add section
PATCH  /api/v1/projects/{id}/sections/reorder  → reorder sections
POST   /api/v1/projects/{id}/tasks             → add task to project
PATCH  /api/v1/projects/tasks/{task_id}        → update project task
POST   /api/v1/projects/tasks/{task_id}/complete → complete project task
```

### New router: `/app/routers/proposals.py`
```
GET    /api/v1/proposals                  → pending proposals
POST   /api/v1/proposals/{id}/approve     → approve (creates task/habit)
POST   /api/v1/proposals/{id}/reject      → reject
```

### Updated: `/app/routers/calendar.py` (NEW)
```
GET    /api/v1/calendar/{date}            → all items for one day
GET    /api/v1/calendar/range             → ?start=&end= items for date range
# Returns unified CalendarDay with tasks + habit_entries + project_tasks
# Also generates habit entries for requested dates (idempotent)
```

---

## [PYDANTIC MODELS]

```python
# Recurrence
class RecurrenceType(str, Enum):
    DAILY         = "daily"
    WEEKLY        = "weekly"
    MONTHLY       = "monthly"
    SELECTED_DAYS = "selected_days"
    CUSTOM        = "custom"

class CustomRecurrenceRule(BaseModel):
    interval: int = 1                          # every N
    unit: Literal["days","weeks","months"]     # units
    times_per: int | None = None               # e.g. 2x per week
    per: Literal["week","month"] | None = None

class HabitCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    category: TaskCategory
    priority: TaskPriority = TaskPriority.MEDIUM
    recurrence_type: RecurrenceType = RecurrenceType.DAILY
    selected_days: list[int] | None = None     # ISO weekdays 1-7
    monthly_day: int | None = Field(None, ge=1, le=31)
    custom_rule: CustomRecurrenceRule | None = None
    start_date: date = Field(default_factory=date.today)
    end_date: date | None = None
    notes: str | None = None

class Habit(BaseModel):
    id: str
    title: str
    category: TaskCategory
    recurrence_type: RecurrenceType
    selected_days: list[int] | None
    monthly_day: int | None
    custom_rule: CustomRecurrenceRule | None
    is_active: bool
    streak: int
    longest_streak: int
    start_date: date
    end_date: date | None

# Projects
class ProjectCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    category: TaskCategory
    priority: TaskPriority = TaskPriority.MEDIUM
    due_date: date | None = None
    color: str = '#6366f1'

class ProjectSection(BaseModel):
    id: str
    project_id: str
    title: str
    position: int
    tasks: list[ProjectTask] = []

class ProjectFull(BaseModel):
    id: str
    title: str
    description: str | None
    category: TaskCategory
    status: str
    priority: TaskPriority
    due_date: date | None
    color: str
    sections: list[ProjectSection]
    progress: ProjectProgress

class ProjectProgress(BaseModel):
    total_tasks: int
    completed_tasks: int
    completion_percentage: float
    overdue_count: int

# Proposals
class AgentTaskProposal(BaseModel):
    id: str
    agent_id: str
    proposed_title: str
    proposed_category: TaskCategory
    proposed_date: date
    proposed_priority: TaskPriority
    proposed_type: Literal["task", "habit"]
    reason: str
    status: str
    expires_at: datetime
    created_at: datetime

# Unified Calendar
class CalendarItem(BaseModel):
    id: str
    type: Literal["task", "habit_entry", "project_task"]
    title: str
    category: TaskCategory
    status: TaskStatus
    priority: TaskPriority
    habit_id: str | None        # if type=habit_entry
    project_id: str | None      # if type=project_task
    agent_route: str            # e.g. "/ares", "/athena" — for navigation

class CalendarDay(BaseModel):
    date: date
    items: list[CalendarItem]
    proposals: list[AgentTaskProposal]    # pending proposals for this date
    completion_rate: float
```

---

## [AGENT → CATEGORY → ROUTE MAPPING]

This mapping drives smart navigation from Calendar to agent tabs:

```python
# /app/core/agent_routing.py
CATEGORY_TO_AGENT_ROUTE: dict[TaskCategory, str] = {
    TaskCategory.VITALITY:   "/ares",
    TaskCategory.INTELLECT:  "/athena",
    TaskCategory.DISCIPLINE: "/kronos",
    TaskCategory.WEALTH:     "/plutus",
    TaskCategory.CHARISMA:   "/hermes",
    TaskCategory.WILLPOWER:  "/prometheus",
}

def get_agent_route(category: TaskCategory) -> str:
    return CATEGORY_TO_AGENT_ROUTE.get(category, "/dashboard")
```

This `agent_route` is included in every `CalendarItem` response so the frontend
knows where to navigate on click without any client-side logic.

---

## [AGENT PROPOSAL TOOL]

Each agent gets a new tool function to propose tasks:

```python
# /app/agents/shared/proposal_tool.py

async def propose_task(
    agent_id: str,
    user_id: str,
    supabase,
    title: str,
    category: TaskCategory,
    date: date,
    reason: str,
    task_type: str = "task",
    priority: TaskPriority = TaskPriority.MEDIUM,
) -> AgentTaskProposal:
    """
    Tool available to all agents.
    Creates a pending proposal in agent_task_proposals table.
    Frontend shows it as a dismissible card with one-click approval.
    """
    return await proposals_service.create_proposal(...)
```

ARES example usage — after analysis, ARES can call:
```python
await propose_task(
    agent_id="ares",
    user_id=user_id,
    title="Bieg 5km — uzupełnienie tygodnia",
    category=TaskCategory.VITALITY,
    date=date.today() + timedelta(days=1),
    reason="Brakuje Ci 1 treningu do zamknięcia tygodniowego celu aktywności",
    priority=TaskPriority.HIGH,
)
```

---

## [FRONTEND REDESIGN]

### Navigation structure (BEFORE → AFTER)

```
BEFORE:                          AFTER:
├── Dashboard                    ├── Dashboard
├── Goals          ─────────┐   ├── Kalendarz          ← NOWA unified view
├── Tasks          ──────── ┘   ├── Habity
├── KRONOS                       ├── Projekty
├── ARES                         ├── KRONOS
└── Settings                     ├── ARES
                                 └── Ustawienia
```

Goals categories are KEPT — they become the `TaskCategory` filter system in Calendar.

### `/src/components/calendar/` — New unified Calendar

**`CalendarView.tsx`** — main container:
- Month/Week/Day view switcher
- All items shown: tasks + habit entries + project tasks
- Color-coded by category (vitality=red, intellect=blue, discipline=amber, etc.)
- Pending proposals shown as dashed-border cards with ✓ / ✗ buttons
- Click any item → navigate to `item.agent_route` with item pre-selected

**`CalendarItem.tsx`** — single item in calendar:
- Icon based on type: checkbox (task), loop (habit), folder (project task)
- Category color dot
- Title + priority indicator
- On click: `navigate(item.agent_route, { state: { focusItemId: item.id } })`

**`ProposalCard.tsx`** — agent proposal in calendar:
- Dashed border, slightly transparent
- Agent icon + "ARES sugeruje:" label
- Proposed task title + date
- Reason text (small, muted)
- ✓ Dodaj (one click → POST /api/v1/proposals/{id}/approve)
- ✗ Odrzuć (one click → POST /api/v1/proposals/{id}/reject)
- Auto-expires badge if expires within 24h

**`HabitRecurrenceSelector.tsx`** — in QuickAdd / habit creation form:
- Toggle: Prosty / Zaawansowany
- Simple mode: pill buttons (Codziennie / Co tydzień / Co miesiąc / Wybrane dni)
- Selected days mode: Mon/Tue/Wed/Thu/Fri/Sat/Sun toggles
- Advanced mode: "Co X dni/tygodni/miesięcy" + "X razy na tydzień/miesiąc"

### `/src/components/habits/` — Habits tab

**`HabitsView.tsx`**:
- List of all active habits grouped by category
- Each habit: streak flame + current streak number + recurrence description
- Today's completion status (done/pending)
- "Dodaj habit" button → opens form with HabitRecurrenceSelector

### `/src/components/projects/` — Projects tab

**`ProjectsView.tsx`**:
- Card grid of active projects
- Each card: color bar + title + category + progress bar + due date
- Click → opens ProjectDetail

**`ProjectDetail.tsx`**:
- Project header: title + description + progress ring
- Sections as columns (Kanban-style) or as stacked lists (toggle)
- Tasks within sections: draggable to reorder
- "+ Dodaj sekcję" button
- "+ Dodaj zadanie" per section

### Updated: Agent tabs (ARES, KRONOS etc.)

Each agent tab gets a **"Propozycje"** section at top:
- Shows pending proposals from THIS agent
- Same ProposalCard component
- Empty state: "Brak nowych propozycji"

When navigated from Calendar with `focusItemId`:
- Highlight the relevant task in agent's task list
- Auto-scroll to it
- Optional: pre-fill chat with context about that task

---

## [QUICKADD UPDATES]

QuickAdd (`N` shortcut) gains a type selector:

```
[Task ▼] [Habit ▼] [Project Task ▼]   ← type switcher, leftmost
[Title input                        ]
[Category pills] [Priority L/M/H]
[Date picker — only for Task/ProjectTask]
[Recurrence — only for Habit]
```

When type = "Habit": show HabitRecurrenceSelector inline
When type = "Project Task": show project selector dropdown

---

## [EDGE CASES]

- Habit `generate_entries` must be idempotent — calling twice for same date creates only one entry
- `should_habit_appear` for `selected_days=[1,3,5]` uses ISO weekday (1=Mon, 7=Sun)
- `monthly_day=31` on months with < 31 days → skip that month (do not use last day)
- Project with no sections → show "Sekcja domyślna" auto-created on first task add
- Proposal approved after expiry → return 410 Gone
- Proposal for habit → creates habit with `start_date = proposed_date`, `recurrence_type = daily` (user can edit)
- Calendar range query > 90 days → return 400 (performance guard)
- Deleting a habit → set `is_active=false`, keep existing `daily_tasks` entries (history preserved)
- Project task completed → does NOT update KRONOS streaks (only `daily_tasks` category tasks do)
- `agent_route` for unknown category → fallback to "/dashboard"

---

## [ADDITIONAL INSTRUCTIONS]

- Keep existing `daily_tasks` table intact — only ADD columns, never remove
- `task_type` default = 'task' so existing data is unaffected
- All new tables follow same RLS pattern as existing tables
- Habit streaks are calculated independently from KRONOS vitality streaks
- Calendar is the new default landing page after login (replace current dashboard or add as first tab)
- Category colors must be consistent across Calendar, Habits, Projects, Agent tabs
- Mobile: Calendar in day view by default, week view on tablet+
- ProposalCard auto-dismiss animation after approve/reject (slide out left/right)

Think step by step. Start with database migration, verify it runs, then proceed.
