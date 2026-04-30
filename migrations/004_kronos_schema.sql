-- Life OS — KRONOS (Discipline & Consistency agent) schema
-- Run AFTER 003_goals_module.sql

-- ─── Extend daily_tasks with KRONOS-required columns ──────────────────────────
-- Per ADR (2026-04-28): KRONOS reads from daily_tasks rather than a parallel
-- `tasks` table. Adds a category enum (vitality/intellect/discipline/wealth/
-- charisma/willpower) and a richer status field. Existing `completed` boolean
-- is preserved for backwards compatibility with the goals module.

ALTER TABLE daily_tasks
  ADD COLUMN IF NOT EXISTS category TEXT
    CHECK (category IN (
      'vitality','intellect','discipline','wealth','charisma','willpower'
    )),
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo','in_progress','done','skipped'));

UPDATE daily_tasks SET status = 'done'
  WHERE completed = TRUE AND status = 'todo';

CREATE INDEX IF NOT EXISTS idx_daily_tasks_category
  ON daily_tasks(category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_daily_tasks_status
  ON daily_tasks(status);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_date_category
  ON daily_tasks(date, category);

-- ─── KRONOS tables ────────────────────────────────────────────────────────────

CREATE TABLE kronos_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN (
    'vitality','intellect','discipline','wealth','charisma','willpower'
  )),
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_active_date DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, category)
);

-- Patterns are stored as either day-of-week OR hour-of-day rows, not both.
CREATE TABLE kronos_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN (
    'vitality','intellect','discipline','wealth','charisma','willpower'
  )),
  day_of_week SMALLINT CHECK (day_of_week BETWEEN 0 AND 6),
  hour_of_day SMALLINT CHECK (hour_of_day BETWEEN 0 AND 23),
  completion_rate NUMERIC(4,3) NOT NULL
    CHECK (completion_rate BETWEEN 0 AND 1),
  sample_size INTEGER NOT NULL DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (day_of_week IS NOT NULL AND hour_of_day IS NULL)
    OR (day_of_week IS NULL AND hour_of_day IS NOT NULL)
  )
);

CREATE TABLE kronos_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_number SMALLINT NOT NULL CHECK (week_number BETWEEN 1 AND 53),
  year SMALLINT NOT NULL,
  plan_vs_execution JSONB NOT NULL,
  domain_scores JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, year, week_number)
);

CREATE TABLE kronos_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  analysis_text TEXT NOT NULL,
  triggered_by TEXT NOT NULL CHECK (triggered_by IN (
    'weekly','category_deep_dive','crisis_intervention','manual'
  )),
  focus_category TEXT CHECK (focus_category IN (
    'vitality','intellect','discipline','wealth','charisma','willpower'
  )),
  status TEXT NOT NULL DEFAULT 'complete'
    CHECK (status IN ('complete','incomplete')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kronos_streaks_user ON kronos_streaks(user_id);
CREATE INDEX idx_kronos_patterns_user_category
  ON kronos_patterns(user_id, category);
CREATE INDEX idx_kronos_snapshots_user_period
  ON kronos_snapshots(user_id, year DESC, week_number DESC);
CREATE INDEX idx_kronos_analyses_user_created
  ON kronos_analyses(user_id, created_at DESC);
