# 🗄️ TASK SYSTEM — Data Models

## Important: No New Migration Needed
The `tasks` table was created in `001_kronos_schema.sql`.
Do NOT run a new migration. Use the existing schema.

```sql
-- Existing tasks table (reference only — already created)
CREATE TABLE tasks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  category          task_category NOT NULL,
  status            task_status NOT NULL DEFAULT 'todo',
  priority          task_priority NOT NULL DEFAULT 'medium',
  scheduled_date    DATE NOT NULL,
  completed_at      TIMESTAMPTZ,
  estimated_minutes INTEGER,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## Pydantic v2 Models (`/app/models/task_models.py`)

```python
from datetime import date, datetime
from pydantic import BaseModel, Field, model_validator
from app.agents.kronos.models import TaskCategory, TaskStatus, TaskPriority

class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    category: TaskCategory
    priority: TaskPriority = TaskPriority.MEDIUM
    scheduled_date: date
    estimated_minutes: int | None = Field(None, ge=5, le=480)
    notes: str | None = Field(None, max_length=1000)

    @model_validator(mode='after')
    def trim_title(self) -> 'TaskCreate':
        self.title = self.title.strip()
        if not self.title:
            raise ValueError("Title cannot be empty or whitespace only")
        return self

class TaskUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    scheduled_date: date | None = None
    estimated_minutes: int | None = Field(None, ge=5, le=480)
    notes: str | None = None

class Task(BaseModel):
    id: str
    user_id: str
    title: str
    category: TaskCategory
    status: TaskStatus
    priority: TaskPriority
    scheduled_date: date
    completed_at: datetime | None = None
    estimated_minutes: int | None = None
    notes: str | None = None
    created_at: datetime

    @property
    def is_overdue(self) -> bool:
        return (
            self.status == TaskStatus.TODO
            and self.scheduled_date < date.today()
        )

class CategoryDaySummary(BaseModel):
    category: TaskCategory
    planned: int = 0
    completed: int = 0
    xp_earned: int = 0
    completion_rate: float = 0.0

class DailyTaskList(BaseModel):
    date: date
    tasks: list[Task]
    by_category: dict[str, CategoryDaySummary]
    total_planned: int
    total_completed: int
    completion_rate: float

class WeeklyTaskList(BaseModel):
    week_start: date
    week_end: date
    days: list[DailyTaskList]
    total_xp: int
    best_day: date | None
    worst_day: date | None

class TaskCompletionResult(BaseModel):
    task: Task
    xp_earned: int
    streak_updated: bool
    new_streak: int
    bonus_reasons: list[str]  # ["early_bird", "on_schedule", "streak_bonus"]
```

---

## TypeScript Interfaces (`/src/api/tasks.ts`)

```typescript
import type { TaskCategory } from './kronos'

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'skipped'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface Task {
  id: string
  user_id: string
  title: string
  category: TaskCategory
  status: TaskStatus
  priority: TaskPriority
  scheduled_date: string        // ISO date "2026-04-29"
  completed_at: string | null   // ISO datetime
  estimated_minutes: number | null
  notes: string | null
  created_at: string
}

export interface TaskCreate {
  title: string
  category: TaskCategory
  priority?: TaskPriority
  scheduled_date: string
  estimated_minutes?: number
  notes?: string
}

export interface TaskUpdate {
  title?: string
  status?: TaskStatus
  priority?: TaskPriority
  scheduled_date?: string
  estimated_minutes?: number
  notes?: string
}

export interface CategoryDaySummary {
  category: TaskCategory
  planned: number
  completed: number
  xp_earned: number
  completion_rate: number
}

export interface DailyTaskList {
  date: string
  tasks: Task[]
  by_category: Record<TaskCategory, CategoryDaySummary>
  total_planned: number
  total_completed: number
  completion_rate: number
}

export interface WeeklyTaskList {
  week_start: string
  week_end: string
  days: DailyTaskList[]
  total_xp: number
  best_day: string | null
  worst_day: string | null
}

export interface TaskCompletionResult {
  task: Task
  xp_earned: number
  streak_updated: boolean
  new_streak: number
  bonus_reasons: Array<'early_bird' | 'on_schedule' | 'streak_bonus'>
}
```

---

## XP Formula Reference (`/app/services/xp_engine.py`)

```python
BASE_XP = {
    TaskPriority.LOW:    10,
    TaskPriority.MEDIUM: 25,
    TaskPriority.HIGH:   50,
}

BONUS_EARLY_BIRD   = 0.20   # completed before 12:00 local time
BONUS_ON_SCHEDULE  = 0.30   # completed on scheduled_date
BONUS_STREAK       = 0.15   # active streak >= 3 days

def compute_xp(task: Task, streak: int) -> tuple[int, list[str]]:
    base = BASE_XP[task.priority]
    bonuses = []
    multiplier = 1.0

    if task.completed_at and task.completed_at.hour < 12:
        multiplier += BONUS_EARLY_BIRD
        bonuses.append("early_bird")

    if task.completed_at and task.completed_at.date() == task.scheduled_date:
        multiplier += BONUS_ON_SCHEDULE
        bonuses.append("on_schedule")

    if streak >= 3:
        multiplier += BONUS_STREAK
        bonuses.append("streak_bonus")

    return (math.ceil(base * multiplier), bonuses)
```

---

## Example API Responses

### `GET /api/tasks/today`
```json
{
  "date": "2026-04-29",
  "tasks": [
    {
      "id": "a1b2c3d4-...",
      "title": "Bieg 5km",
      "category": "vitality",
      "status": "done",
      "priority": "high",
      "scheduled_date": "2026-04-29",
      "completed_at": "2026-04-29T07:42:00Z",
      "estimated_minutes": 40,
      "notes": null,
      "created_at": "2026-04-28T20:00:00Z"
    },
    {
      "id": "e5f6g7h8-...",
      "title": "Przeczytaj rozdział książki",
      "category": "intellect",
      "status": "todo",
      "priority": "medium",
      "scheduled_date": "2026-04-29",
      "completed_at": null,
      "estimated_minutes": 30,
      "notes": null,
      "created_at": "2026-04-29T06:00:00Z"
    }
  ],
  "by_category": {
    "vitality":  { "category": "vitality",  "planned": 1, "completed": 1, "xp_earned": 72, "completion_rate": 1.0 },
    "intellect": { "category": "intellect", "planned": 1, "completed": 0, "xp_earned": 0,  "completion_rate": 0.0 }
  },
  "total_planned": 2,
  "total_completed": 1,
  "completion_rate": 0.5
}
```

### `POST /api/tasks/{id}/complete`
```json
{
  "task": {
    "id": "a1b2c3d4-...",
    "status": "done",
    "completed_at": "2026-04-29T07:42:00Z",
    "..."
  },
  "xp_earned": 72,
  "streak_updated": true,
  "new_streak": 5,
  "bonus_reasons": ["early_bird", "on_schedule", "streak_bonus"]
}
```
