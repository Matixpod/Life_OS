# 🗄️ KRONOS — Data Models

## SQL Schema (`001_kronos_schema.sql`)

```sql
-- Enum types
CREATE TYPE task_category AS ENUM (
  'vitality', 'intellect', 'discipline',
  'wealth', 'charisma', 'willpower'
);

CREATE TYPE task_status AS ENUM (
  'todo', 'in_progress', 'done', 'skipped'
);

CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high');

-- Core tasks table (source of truth)
CREATE TABLE tasks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  category         task_category NOT NULL,
  status           task_status NOT NULL DEFAULT 'todo',
  priority         task_priority NOT NULL DEFAULT 'medium',
  scheduled_date   DATE NOT NULL,
  completed_at     TIMESTAMPTZ,
  estimated_minutes INTEGER,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Streak state per user per category
CREATE TABLE kronos_streaks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category         task_category NOT NULL,
  current_streak   INTEGER NOT NULL DEFAULT 0,
  longest_streak   INTEGER NOT NULL DEFAULT 0,
  last_active_date DATE,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, category)
);

-- Precomputed completion heatmaps (reserved for scheduled jobs)
CREATE TABLE kronos_patterns (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category         task_category NOT NULL,
  day_of_week      SMALLINT,           -- 0=Monday, 6=Sunday
  hour_of_day      SMALLINT,           -- 0-23
  completion_rate  NUMERIC(4,3),       -- 0.000 to 1.000
  sample_size      INTEGER,
  computed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Weekly PvE snapshots (historical record)
CREATE TABLE kronos_snapshots (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_number      SMALLINT NOT NULL,  -- ISO week 1-53
  year             SMALLINT NOT NULL,
  plan_vs_execution JSONB NOT NULL,    -- {category: {planned: n, completed: n}}
  domain_scores    JSONB NOT NULL,     -- {category: score_0_to_100}
  global_score     NUMERIC(5,2),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, week_number, year)
);

-- Saved Claude analysis reports
CREATE TABLE kronos_analyses (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  analysis_text    TEXT NOT NULL,      -- full markdown from Claude
  analysis_type    TEXT NOT NULL,      -- 'weekly' | 'category_deep_dive' | 'crisis_intervention'
  focus_category   task_category,      -- null for global analyses
  status           TEXT NOT NULL DEFAULT 'complete',  -- 'complete' | 'incomplete'
  context_snapshot JSONB,              -- KronosContext at time of analysis
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_tasks_user_category     ON tasks(user_id, category);
CREATE INDEX idx_tasks_user_date         ON tasks(user_id, scheduled_date);
CREATE INDEX idx_tasks_user_status       ON tasks(user_id, status);
CREATE INDEX idx_tasks_completed_at      ON tasks(user_id, completed_at);
CREATE INDEX idx_kronos_analyses_user    ON kronos_analyses(user_id, created_at DESC);

-- Row Level Security
ALTER TABLE tasks              ENABLE ROW LEVEL SECURITY;
ALTER TABLE kronos_streaks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE kronos_patterns    ENABLE ROW LEVEL SECURITY;
ALTER TABLE kronos_snapshots   ENABLE ROW LEVEL SECURITY;
ALTER TABLE kronos_analyses    ENABLE ROW LEVEL SECURITY;

-- RLS Policies (all tables follow same pattern)
CREATE POLICY "Users access own tasks"
  ON tasks FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users access own streaks"
  ON kronos_streaks FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users access own patterns"
  ON kronos_patterns FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users access own snapshots"
  ON kronos_snapshots FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users access own analyses"
  ON kronos_analyses FOR ALL USING (auth.uid() = user_id);
```

---

## Pydantic v2 Models (`/app/agents/kronos/models.py`)

```python
from enum import Enum
from datetime import date, datetime
from typing import Literal
from pydantic import BaseModel, Field, model_validator

class TaskCategory(str, Enum):
    VITALITY   = "vitality"
    INTELLECT  = "intellect"
    DISCIPLINE = "discipline"
    WEALTH     = "wealth"
    CHARISMA   = "charisma"
    WILLPOWER  = "willpower"

class TaskStatus(str, Enum):
    TODO        = "todo"
    IN_PROGRESS = "in_progress"
    DONE        = "done"
    SKIPPED     = "skipped"

class DailyPvE(BaseModel):
    date: date
    planned: int
    completed: int
    ratio: float = Field(ge=0.0, le=1.0)
    is_zero_execution: bool

class StreakData(BaseModel):
    category: TaskCategory
    current_streak: int = Field(ge=0)
    longest_streak: int = Field(ge=0)
    last_active_date: date | None
    streak_broken_dates: list[date] = Field(default_factory=list)
    trend: Literal["up", "down", "stable"]
    insufficient_data: bool = False

class PatternData(BaseModel):
    category: TaskCategory
    by_day_of_week: dict[str, float]   # "monday": 0.73
    by_hour_of_day: dict[int, float]   # 14: 0.65
    peak_zones: list[str]
    dead_zones: list[str]
    insufficient_data: bool = False

class PvEScore(BaseModel):
    category: TaskCategory
    overall_ratio: float = Field(ge=0.0, le=1.0)
    daily_breakdown: list[DailyPvE]
    zero_execution_days: list[date]
    best_day: date | None
    worst_day: date | None
    insufficient_data: bool = False

class KronosAlert(BaseModel):
    type: Literal["dead_zone", "streak_at_risk", "zero_execution_week", "crisis"]
    category: TaskCategory | None
    message: str
    severity: Literal["low", "medium", "high"]

class KronosContext(BaseModel):
    user_id: str
    generated_at: datetime
    streaks: list[StreakData]
    patterns: list[PatternData]
    pve_scores: list[PvEScore]
    global_consistency_score: float | None  # null if < 3 categories have data
    alerts: list[KronosAlert] = Field(default_factory=list)

    def to_prompt_string(self) -> str:
        """Deterministic text block for Claude. Same data = same output."""
        lines = [
            f"KRONOS DATA SNAPSHOT — {self.generated_at.strftime('%Y-%m-%d')}",
            f"Global Consistency Score: {self.global_consistency_score or 'N/A'}",
            "",
            "=== STREAKS ===",
        ]
        for s in sorted(self.streaks, key=lambda x: x.category.value):
            lines.append(
                f"{s.category.value.upper()}: current={s.current_streak}d "
                f"best={s.longest_streak}d trend={s.trend}"
            )
        lines += ["", "=== PLAN VS EXECUTION (30d) ==="]
        for p in sorted(self.pve_scores, key=lambda x: x.category.value):
            lines.append(
                f"{p.category.value.upper()}: {p.overall_ratio:.1%} "
                f"zero_exec_days={len(p.zero_execution_days)}"
            )
        lines += ["", "=== ALERTS ==="]
        for a in self.alerts:
            lines.append(f"[{a.severity.upper()}] {a.message}")
        return "\n".join(lines)

class KronosDashboard(BaseModel):
    global_consistency_score: float | None
    streaks: list[StreakData]
    patterns: list[PatternData]
    pve_scores: list[PvEScore]
    alerts: list[KronosAlert]
    last_analysis_at: datetime | None

class KronosAnalysisRecord(BaseModel):
    id: str
    analysis_text: str
    analysis_type: str
    focus_category: TaskCategory | None
    status: str
    created_at: datetime

class AnalysisRequest(BaseModel):
    analysis_type: Literal["weekly", "category_deep_dive", "crisis_intervention"] = "weekly"
    focus_category: TaskCategory | None = None
```

---

## TypeScript Interfaces (`/src/api/kronos.ts`)

```typescript
export type TaskCategory =
  | 'vitality' | 'intellect' | 'discipline'
  | 'wealth' | 'charisma' | 'willpower'

export interface StreakData {
  category: TaskCategory
  current_streak: number
  longest_streak: number
  last_active_date: string | null
  streak_broken_dates: string[]
  trend: 'up' | 'down' | 'stable'
  insufficient_data: boolean
}

export interface PatternData {
  category: TaskCategory
  by_day_of_week: Record<string, number>
  by_hour_of_day: Record<number, number>
  peak_zones: string[]
  dead_zones: string[]
  insufficient_data: boolean
}

export interface DailyPvE {
  date: string
  planned: number
  completed: number
  ratio: number
  is_zero_execution: boolean
}

export interface PvEScore {
  category: TaskCategory
  overall_ratio: number
  daily_breakdown: DailyPvE[]
  zero_execution_days: string[]
  best_day: string | null
  worst_day: string | null
  insufficient_data: boolean
}

export interface KronosAlert {
  type: 'dead_zone' | 'streak_at_risk' | 'zero_execution_week' | 'crisis'
  category: TaskCategory | null
  message: string
  severity: 'low' | 'medium' | 'high'
}

export interface KronosDashboard {
  global_consistency_score: number | null
  streaks: StreakData[]
  patterns: PatternData[]
  pve_scores: PvEScore[]
  alerts: KronosAlert[]
  last_analysis_at: string | null
}

export interface KronosAnalysisRecord {
  id: string
  analysis_text: string
  analysis_type: string
  focus_category: TaskCategory | null
  status: string
  created_at: string
}
```

---

## Example JSON Payloads

### `GET /api/kronos/dashboard` response
```json
{
  "global_consistency_score": 68.4,
  "streaks": [
    {
      "category": "vitality",
      "current_streak": 14,
      "longest_streak": 21,
      "last_active_date": "2026-04-27",
      "streak_broken_dates": ["2026-03-15"],
      "trend": "up",
      "insufficient_data": false
    }
  ],
  "patterns": [
    {
      "category": "vitality",
      "by_day_of_week": { "monday": 0.45, "tuesday": 0.82, "wednesday": 0.78 },
      "by_hour_of_day": { "7": 0.85, "12": 0.60, "22": 0.25 },
      "peak_zones": ["tuesday_morning", "thursday_morning"],
      "dead_zones": ["monday_all_day", "friday_evening"],
      "insufficient_data": false
    }
  ],
  "pve_scores": [
    {
      "category": "vitality",
      "overall_ratio": 0.76,
      "daily_breakdown": [...],
      "zero_execution_days": ["2026-04-14"],
      "best_day": "2026-04-22",
      "worst_day": "2026-04-14",
      "insufficient_data": false
    }
  ],
  "alerts": [
    {
      "type": "dead_zone",
      "category": "intellect",
      "message": "Monday completion rate: 12% over last 4 weeks",
      "severity": "high"
    },
    {
      "type": "streak_at_risk",
      "category": "vitality",
      "message": "No vitality task logged today — 14-day streak at risk",
      "severity": "medium"
    }
  ],
  "last_analysis_at": "2026-04-21T09:14:00Z"
}
```
