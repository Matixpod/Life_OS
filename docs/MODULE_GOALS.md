# MODULE SPEC: Goals — Life Areas → Projects → Daily Tasks

## Module Purpose

This is not a todo-list. It is a **strategic planning layer** where an AI agent:
1. Knows the user's life priorities (Life Areas → Projects)
2. Every evening generates a justified, ordered plan for tomorrow
3. Tracks execution and holds the user accountable for stalled tasks
4. Feeds into the Daily Potential Score (max 20 points)

**Key principle:** The agent explains *why* tasks are ordered the way they are, and *how* to start the first one. It connects daily actions to larger life goals so the user always knows what they're building toward.

---

## Data Model

### New tables (add to `migrations/003_goals_module.sql`)

```sql
-- Life Areas: the user's 5-7 domains of life (Health, Career, Finance, etc.)
CREATE TABLE life_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                        -- e.g. "Health & Longevity"
  icon TEXT NOT NULL,                        -- emoji, e.g. "💪"
  color TEXT NOT NULL,                       -- hex, e.g. "#10B981"
  description TEXT,                          -- why this area matters to the user
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects: active initiatives linked to a Life Area
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  life_area_id UUID REFERENCES life_areas(id) ON DELETE SET NULL,
  title TEXT NOT NULL,                       -- e.g. "Build Life OS"
  description TEXT,                          -- why this project matters
  why TEXT,                                  -- deeper motivation / outcome
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'completed', 'dropped')),
  priority INTEGER DEFAULT 2
    CHECK (priority BETWEEN 1 AND 3),        -- 1=high, 2=medium, 3=low
  target_date DATE,                          -- optional deadline
  progress_pct INTEGER DEFAULT 0
    CHECK (progress_pct BETWEEN 0 AND 100),
  last_task_date DATE,                       -- date of most recent completed task
  stalled_flag BOOLEAN DEFAULT FALSE,        -- agent sets this if >7 days inactive
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily tasks: one-day actionable items linked to a project
CREATE TABLE daily_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  life_area_id UUID REFERENCES life_areas(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  title TEXT NOT NULL,
  notes TEXT,                                -- how to start / approach
  priority INTEGER DEFAULT 2
    CHECK (priority BETWEEN 1 AND 3),        -- 1=P1, 2=P2, 3=P3
  estimated_minutes INTEGER,
  source TEXT DEFAULT 'manual'
    CHECK (source IN ('manual', 'agent', 'google_calendar')),
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  postponed_count INTEGER DEFAULT 0,         -- how many times pushed to next day
  postponed_reason TEXT,
  agent_justification TEXT,                  -- why agent put it in this position
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent-generated daily plans (stored for reference and accountability)
CREATE TABLE daily_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL UNIQUE,                 -- plan is FOR this date
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  tasks_suggested JSONB,                     -- array of suggested tasks with order + justification
  plan_summary TEXT,                         -- agent's overall reasoning for the day
  energy_context TEXT,                       -- what sleep/energy data the agent considered
  accepted BOOLEAN DEFAULT FALSE,            -- did user accept this plan?
  modified BOOLEAN DEFAULT FALSE             -- did user modify it before accepting?
);

-- Seed default life areas
-- (run this after inserting a user)
-- INSERT INTO life_areas (user_id, name, icon, color, sort_order) VALUES
--   (uid, 'Health & Longevity', '💪', '#10B981', 1),
--   (uid, 'Career & Skills', '🧠', '#3B82F6', 2),
--   (uid, 'Finance', '💰', '#F59E0B', 3),
--   (uid, 'Personal Projects', '🚀', '#8B5CF6', 4),
--   (uid, 'Relationships', '❤️', '#EC4899', 5),
--   (uid, 'Learning & Growth', '📚', '#06B6D4', 6);

-- Indexes
CREATE INDEX idx_daily_tasks_date ON daily_tasks(date);
CREATE INDEX idx_daily_tasks_project ON daily_tasks(project_id);
CREATE INDEX idx_projects_life_area ON projects(life_area_id);
CREATE INDEX idx_projects_stalled ON projects(stalled_flag) WHERE stalled_flag = true;
```

---

## TypeScript Types (add to `src/types/index.ts`)

```typescript
export interface LifeArea {
  id: string;
  name: string;
  icon: string;           // emoji
  color: string;          // hex color
  description: string | null;
  sort_order: number;
  active: boolean;
}

export type ProjectStatus = 'active' | 'paused' | 'completed' | 'dropped';
export type Priority = 1 | 2 | 3;   // 1=P1/High, 2=P2/Medium, 3=P3/Low

export interface Project {
  id: string;
  life_area_id: string | null;
  life_area?: LifeArea;
  title: string;
  description: string | null;
  why: string | null;
  status: ProjectStatus;
  priority: Priority;
  target_date: string | null;   // ISO date
  progress_pct: number;
  last_task_date: string | null;
  stalled_flag: boolean;
  created_at: string;
}

export type TaskSource = 'manual' | 'agent' | 'google_calendar';

export interface DailyTask {
  id: string;
  project_id: string | null;
  project?: Pick<Project, 'id' | 'title' | 'life_area_id'>;
  life_area_id: string | null;
  life_area?: Pick<LifeArea, 'id' | 'name' | 'icon' | 'color'>;
  date: string;
  title: string;
  notes: string | null;
  priority: Priority;
  estimated_minutes: number | null;
  source: TaskSource;
  completed: boolean;
  completed_at: string | null;
  postponed_count: number;
  postponed_reason: string | null;
  agent_justification: string | null;
}

export interface DailyPlan {
  id: string;
  date: string;
  generated_at: string;
  tasks_suggested: AgentTaskSuggestion[];
  plan_summary: string;
  energy_context: string;
  accepted: boolean;
  modified: boolean;
}

export interface AgentTaskSuggestion {
  title: string;
  project_id: string | null;
  life_area_id: string | null;
  priority: Priority;
  estimated_minutes: number;
  justification: string;     // why this task, why this order
  how_to_start: string;      // concrete first action to take
}

// For the module summary card on Dashboard
export interface GoalsSummary {
  total: number;
  completed: number;
  p1_completed: number;
  p1_total: number;
  has_agent_plan: boolean;
}
```

---

## Backend

### Files to create

**`backend/models/goals.py`** — all Pydantic v2 schemas:
- `LifeAreaCreate`, `LifeAreaUpdate`, `LifeAreaResponse`
- `ProjectCreate`, `ProjectUpdate`, `ProjectResponse`
- `DailyTaskCreate`, `DailyTaskUpdate`, `DailyTaskResponse`
- `PostponeTaskRequest` — `{ task_id, reason }`
- `GeneratePlanRequest` — `{ date, force_regenerate }`
- `DailyPlanResponse`
- `GoalsSummaryResponse`

**`backend/services/goals_service.py`** — all DB logic:
```python
# Key functions to implement:

async def get_life_areas(supabase, user_id) -> list[LifeArea]
async def create_life_area(supabase, user_id, data) -> LifeArea
async def update_life_area(supabase, area_id, data) -> LifeArea

async def get_projects(supabase, user_id, status=None) -> list[Project]
async def create_project(supabase, user_id, data) -> Project
async def update_project(supabase, project_id, data) -> Project
async def check_stalled_projects(supabase, user_id) -> list[Project]
  # sets stalled_flag=True for projects where last_task_date < today - 7 days

async def get_tasks_for_date(supabase, user_id, date) -> list[DailyTask]
async def create_task(supabase, user_id, data) -> DailyTask
async def complete_task(supabase, task_id) -> DailyTask
  # sets completed=True, completed_at=now(), updates project.last_task_date
async def postpone_task(supabase, task_id, reason, new_date) -> DailyTask
  # increments postponed_count, sets postponed_reason, creates copy for new_date

async def get_goals_summary(supabase, user_id, date) -> GoalsSummary
  # counts tasks for date, p1 breakdown, checks if agent plan exists
```

**`backend/services/goals_agent_service.py`** — AI planning logic:
```python
async def generate_daily_plan(supabase, user_id: str, plan_date: str) -> DailyPlan:
    """
    Agent generates tomorrow's plan by:
    1. Fetching all active projects sorted by priority + last_task_date
    2. Fetching stalled projects (agent must address these)
    3. Fetching today's sleep/energy data (context for tomorrow's capacity)
    4. Fetching any incomplete tasks from today (carry-overs)
    5. Calling Claude to generate an ordered task list with justifications
    6. Saving to daily_plans table and creating daily_tasks rows
    """
    
    # Gather context
    projects = await get_projects(supabase, user_id, status='active')
    stalled = await check_stalled_projects(supabase, user_id)
    sleep_data = # fetch from sleep_entries for today
    energy_score = sleep_data.get('energy_score', 50)
    incomplete_today = # daily_tasks for today where completed=False
    
    context = f"""
    USER CONTEXT:
    Active projects: {json.dumps([p.dict() for p in projects])}
    Stalled projects (>7 days no progress): {json.dumps([p.dict() for p in stalled])}
    Tonight's sleep energy score: {energy_score}/100
    Incomplete tasks from today: {json.dumps([t.dict() for t in incomplete_today])}
    Planning for date: {plan_date}
    """
    
    system_prompt = """
    You are a strategic life planning agent. Your job is to generate an optimal daily task plan
    that balances the user's most important projects, addresses stalled work, and respects
    their energy levels.
    
    Rules:
    - Suggest 3-6 tasks maximum (quality over quantity)
    - Order by: (1) stalled high-priority projects first, (2) P1 active projects,
      (3) P2 projects, (4) carry-overs from yesterday
    - If energy_score < 50: suggest lighter tasks, no more than 3
    - For each task: give a specific, concrete, one-sentence 'how_to_start' tip
    - The justification must explain WHY this task at this position (connect to life goal)
    - Write the plan_summary as if explaining to the user in 2-3 sentences what today is about
    
    Return ONLY valid JSON, no markdown:
    {
      "plan_summary": "Today is about...",
      "energy_context": "Based on your X/100 energy score...",
      "tasks": [
        {
          "title": "...",
          "project_id": "uuid or null",
          "life_area_id": "uuid or null",
          "priority": 1,
          "estimated_minutes": 45,
          "justification": "This is first because...",
          "how_to_start": "Open your terminal and run..."
        }
      ]
    }
    """
    
    client = anthropic.Anthropic()
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2000,
        system=system_prompt,
        messages=[{"role": "user", "content": context}]
    )
    
    plan_data = json.loads(response.content[0].text)
    
    # Save plan to DB
    # Create daily_task rows from suggestions (source='agent')
    # Return DailyPlan
```

**`backend/routers/goals.py`** — endpoints:

```
GET  /api/v1/goals/areas               → list life areas
POST /api/v1/goals/areas               → create life area
PUT  /api/v1/goals/areas/{id}          → update life area
DELETE /api/v1/goals/areas/{id}        → deactivate (soft delete)

GET  /api/v1/goals/projects            → list projects (filter: ?status=active)
POST /api/v1/goals/projects            → create project
PUT  /api/v1/goals/projects/{id}       → update project
GET  /api/v1/goals/projects/stalled    → list stalled projects

GET  /api/v1/goals/tasks?date=         → tasks for a specific date (default: today)
POST /api/v1/goals/tasks               → create a task manually
PUT  /api/v1/goals/tasks/{id}/complete → mark task complete
PUT  /api/v1/goals/tasks/{id}/postpone → postpone with reason
DELETE /api/v1/goals/tasks/{id}        → delete a task

GET  /api/v1/goals/plan?date=          → get daily plan for a date
POST /api/v1/goals/plan/generate       → generate/regenerate agent plan
PUT  /api/v1/goals/plan/{id}/accept    → user accepts the plan

GET  /api/v1/goals/summary?date=       → GoalsSummary for dashboard card
```

---

## Frontend

### Page layout: `src/pages/Goals.tsx`

**3 tabs / views:**

#### Tab 1 — TODAY (default view)
```
┌─────────────────────────────────────────────────────┐
│  Monday, April 27                    [+ Add Task]   │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  🤖 Agent Plan  ─────────────────── [Regenerate]   │
│  ╔═══════════════════════════════════════════════╗  │
│  ║ "Today focus on Life OS (stalled 3 days) and  ║  │
│  ║  your workout prep. Energy is high — use it." ║  │
│  ╚═══════════════════════════════════════════════╝  │
│                                                     │
│  P1  ┌─────────────────────────────────────────┐   │
│  🚀  │ ☐ Build Goals module backend            │   │
│      │   Life OS → Personal Projects  ~60 min  │   │
│      │   💡 Start with `touch backend/routers/ │   │
│      │      goals.py` then write the schema    │   │
│      └─────────────────────────────────────────┘   │
│                                                     │
│  P1  ┌─────────────────────────────────────────┐   │
│  💪  │ ☐ Plan this week's training split       │   │
│      │   Health & Longevity          ~15 min   │   │
│      │   💡 Open notes, list Mon-Sat with      │   │
│      │      muscle groups                      │   │
│      └─────────────────────────────────────────┘   │
│                                                     │
│  P2  ┌─────────────────────────────────────────┐   │
│  🧠  │ ☐ Review Python decorators chapter      │   │
│      │   Career & Skills             ~30 min   │   │
│      └─────────────────────────────────────────┘   │
│                                                     │
│  ─── Completed (1) ──────────────────────────────  │
│  ✅  Review morning routine protocol               │
└─────────────────────────────────────────────────────┘
```

**Task card interactions:**
- Click checkbox → task completes with green flash + strikethrough animation
- Click anywhere else on card → expand to show full agent justification + how_to_start
- "..." menu on each card → Postpone (asks for reason) / Edit / Delete
- Postponed tasks show count badge: "Postponed 2×"

#### Tab 2 — PROJECTS
```
┌─────────────────────────────────────────────────────┐
│  Projects                            [+ New Project] │
│                                                      │
│  💪 Health & Longevity                              │
│  ┌──────────────────────────────────────────┐       │
│  │ 🟢 Life OS Health Stack    P1  ████░░ 60%│       │
│  │ Last task: 2 days ago · Target: Jun 2026 │       │
│  └──────────────────────────────────────────┘       │
│                                                      │
│  🧠 Career & Skills                                 │
│  ┌──────────────────────────────────────────┐       │
│  │ 🔴 Learn FastAPI (STALLED 9 days) P1 ██░ 35%│   │
│  │ ⚠️  Agent: "This stalled. Decide now."   │       │
│  │ [Resume] [Pause] [Drop]                  │       │
│  └──────────────────────────────────────────┘       │
│  ┌──────────────────────────────────────────┐       │
│  │ 🟡 System Design study     P2  █░░░░ 20% │       │
│  │ Last task: 5 days ago · No deadline      │       │
│  └──────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────┘
```

#### Tab 3 — AREAS (setup / rarely used)
- List of Life Areas with edit capability
- Each shows: icon, name, color, active project count, description
- [+ Add Area] button
- Drag to reorder

### Components to build

**`src/components/goals/TaskCard.tsx`**
- Props: `task: DailyTask, onComplete, onPostpone, onDelete`
- Shows: priority badge (P1 red chip, P2 amber, P3 grey), life area icon + color, title, estimated time
- Expandable: shows `agent_justification` and `how_to_start` tip (💡 prefixed)
- Postponed badge if `postponed_count > 0`
- Hover: subtle left border glow in life area color
- Complete animation: checkbox turns green, title strikethrough, card fades to 60% opacity then slides up

**`src/components/goals/AgentPlanBanner.tsx`**
- Shows `plan_summary` and `energy_context` from today's DailyPlan
- Dark card with subtle gradient, robot icon 🤖
- "Regenerate" button — calls `POST /api/v1/goals/plan/generate` — shows spinner while generating
- If no plan yet: shows "Plan not generated yet" with a "Generate Today's Plan" CTA button

**`src/components/goals/ProjectCard.tsx`**
- Props: `project: Project`
- Shows: status dot (green=active, amber=paused, red=stalled), title, priority badge, progress bar, last task date
- Stalled projects: red border, ⚠️ icon, action buttons [Resume] [Pause] [Drop]
- Progress bar color matches life area color

**`src/components/goals/PostponeModal.tsx`**
- Small modal: "Why are you postponing?" with 4 quick options:
  - "Too big — needs breaking down"
  - "No energy right now"
  - "Blocked by something else"
  - "Not a priority today"
- Plus freeform text option
- Selects new date (tomorrow by default, can change)

**`src/components/goals/AddTaskModal.tsx`**
- Title input
- Project selector dropdown (all active projects)
- Priority selector (P1 / P2 / P3)
- Estimated time (15 / 30 / 45 / 60 / 90 / 120 min)
- Optional notes

**`src/components/goals/AddProjectModal.tsx`**
- Title input
- Life Area selector
- "Why does this matter?" textarea (encourages reflection)
- Priority (P1/P2/P3)
- Target date (optional)

---

## Agent Accountability Logic

Implement these checks in `goals_agent_service.py`. Run daily (called from dashboard summary endpoint or a scheduled job):

```python
def check_accountability_flags(supabase, user_id) -> list[AccountabilityAlert]:
    alerts = []
    
    # 1. Tasks postponed 3+ times
    repeatedly_postponed = supabase.table('daily_tasks')\
        .select('*')\
        .eq('user_id', user_id)\
        .gte('postponed_count', 3)\
        .eq('completed', False)\
        .execute()
    
    for task in repeatedly_postponed.data:
        alerts.append({
            "type": "repeated_postpone",
            "task_id": task['id'],
            "message": f"'{task['title']}' has been postponed {task['postponed_count']} times. Time to decide: break it down, drop it, or commit.",
            "actions": ["break_down", "drop", "commit_today"]
        })
    
    # 2. Projects stalled >7 days
    stalled_projects = supabase.table('projects')\
        .select('*')\
        .eq('user_id', user_id)\
        .eq('status', 'active')\
        .lt('last_task_date', str(date.today() - timedelta(days=7)))\
        .execute()
    
    for project in stalled_projects.data:
        # Update stalled_flag
        supabase.table('projects').update({'stalled_flag': True})\
            .eq('id', project['id']).execute()
        
        alerts.append({
            "type": "stalled_project",
            "project_id": project['id'],
            "message": f"'{project['title']}' has had no progress in 7+ days.",
            "actions": ["resume", "pause", "drop"]
        })
    
    return alerts
```

Show alerts as dismissible notification cards at the top of the TODAY tab, above the agent plan.

---

## Potential Score Calculation

Add to `dashboard_service.py`:

```python
def calculate_goals_score(tasks: list[DailyTask]) -> int:
    """
    Max 20 points.
    3+ tasks done → 20 pts
    2 tasks done → 13 pts
    1 task done → 7 pts
    0 tasks done → 0 pts
    Bonus: +3 pts per P1 task completed (score capped at 100 total across all modules)
    """
    completed = [t for t in tasks if t['completed']]
    count = len(completed)
    
    base = 0
    if count >= 3:
        base = 20
    elif count == 2:
        base = 13
    elif count == 1:
        base = 7
    
    p1_bonus = sum(3 for t in completed if t['priority'] == 1)
    return min(base + p1_bonus, 20)   # capped at module max
```

---

## MCP Tools to add to `mcp/lifeos_mcp.py`

```python
@mcp.tool()
def get_today_goals() -> dict:
    """Get today's task list with completion status, priorities, and agent plan."""
    return api_get(f"/api/v1/goals/tasks?date={date.today()}")

@mcp.tool()
def get_active_projects() -> list:
    """Get all active projects grouped by life area. Use for planning context."""
    return api_get("/api/v1/goals/projects?status=active")

@mcp.tool()
def generate_tomorrow_plan() -> dict:
    """Trigger agent to generate tomorrow's task plan. Returns plan with justifications."""
    return api_post("/api/v1/goals/plan/generate", {"date": str(date.today() + timedelta(days=1))})

@mcp.tool()
def complete_task(task_id: str) -> dict:
    """Mark a task as completed."""
    return api_post(f"/api/v1/goals/tasks/{task_id}/complete", {})

@mcp.tool()
def get_stalled_projects() -> list:
    """Get projects that have had no progress in 7+ days. Use for accountability."""
    return api_get("/api/v1/goals/projects/stalled")
```

---

## Verification Steps (for Claude Code to run after building)

### Backend verification
```bash
# Life Areas
curl -s http://localhost:8000/api/v1/goals/areas | python3 -m json.tool
# Expected: list of 6 default life areas from seed data

# Projects (seed needs 1-2 sample projects)
curl -s "http://localhost:8000/api/v1/goals/projects?status=active" | python3 -m json.tool
# Expected: list with life_area nested

# Tasks for today
curl -s "http://localhost:8000/api/v1/goals/tasks?date=$(date +%Y-%m-%d)" | python3 -m json.tool
# Expected: array (may be empty if no seed tasks)

# Generate plan
curl -s -X POST http://localhost:8000/api/v1/goals/plan/generate \
  -H "Content-Type: application/json" \
  -d '{"date":"'$(date -d tomorrow +%Y-%m-%d 2>/dev/null || date -v+1d +%Y-%m-%d)'"}' \
  | python3 -m json.tool
# Expected: plan_summary, energy_context, tasks array with justifications

# Complete a task (use a real task_id from tasks endpoint)
curl -s -X PUT http://localhost:8000/api/v1/goals/tasks/{TASK_ID}/complete | python3 -m json.tool
# Expected: task with completed=true, completed_at set

# Goals summary (used by dashboard card)
curl -s "http://localhost:8000/api/v1/goals/summary?date=$(date +%Y-%m-%d)" | python3 -m json.tool
# Expected: { total, completed, p1_completed, p1_total, has_agent_plan }

# Lint
cd backend && ruff check .
# Expected: 0 errors
```

### Frontend verification (Playwright)

1. Navigate to `/goals`
2. Screenshot — verify: 3 tabs visible (Today / Projects / Areas), task list visible
3. Verify AgentPlanBanner visible with plan_summary text
4. Click a task card — verify it expands to show justification + how_to_start tip
5. Click checkbox on a task — verify green animation + strikethrough
6. Click "..." on a task → Postpone → verify PostponeModal appears with 4 options
7. Select a postpone reason, click confirm — verify task disappears from today's list
8. Navigate to Projects tab — verify project cards grouped by Life Area
9. Verify stalled project (if any in seed) shows red border + action buttons
10. Navigate to Areas tab — verify Life Areas list with colors and icons
11. Click [+ Add Task] — verify AddTaskModal with all fields
12. Mobile (375px): verify tabs still work, cards readable, no overflow

### End-to-end flow test
1. Generate agent plan for tomorrow
2. Verify tasks appear in today's list (after date change) or inspect DB directly
3. Complete 3 tasks → verify Potential Score increases in dashboard
4. Postpone 1 task 3 times (use API directly) → verify accountability alert appears
