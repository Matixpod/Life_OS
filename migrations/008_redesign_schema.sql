-- Life OS — Redesign: Tasks / Habits / Projects / Calendar
-- Run AFTER 007_ares_schema.sql
--
-- Surgical extension of existing schema. Does NOT drop columns or rewrite
-- working tables. Notable adaptations vs. /docs/agents/redesign/PROMPT.md:
--   * The codebase uses `users(id)` (single-user table, ADR-003), not
--     `auth.users(id)`. All FKs follow the existing pattern.
--   * `task_category` / `task_priority` are NOT existing Postgres ENUM types
--     in this DB — `daily_tasks.category` is TEXT, `daily_tasks.priority` is
--     INTEGER. New tables therefore use TEXT + CHECK constraints to mirror
--     the existing convention rather than introducing brand-new ENUM types.
--   * `projects` table already exists from migration 003. We ALTER it to add
--     `category`, `color`, `due_date` and extend the status CHECK to allow
--     'archived' / 'on_hold'. Existing rows keep their old status values.

-- ─── 1. Extend daily_tasks ───────────────────────────────────────────────────

ALTER TABLE daily_tasks
  ADD COLUMN IF NOT EXISTS task_type TEXT NOT NULL DEFAULT 'task'
    CHECK (task_type IN ('task','habit_entry','project_task'));

ALTER TABLE daily_tasks ADD COLUMN IF NOT EXISTS habit_id UUID;
ALTER TABLE daily_tasks ADD COLUMN IF NOT EXISTS project_task_id UUID;

CREATE INDEX IF NOT EXISTS idx_daily_tasks_task_type ON daily_tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_habit_id
  ON daily_tasks(habit_id) WHERE habit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_daily_tasks_project_task_id
  ON daily_tasks(project_task_id) WHERE project_task_id IS NOT NULL;

-- ─── 2. Habits ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS habits (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  category         TEXT NOT NULL CHECK (category IN (
    'vitality','intellect','discipline','wealth','charisma','willpower'
  )),
  priority         TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low','medium','high')),

  recurrence_type  TEXT NOT NULL DEFAULT 'daily'
    CHECK (recurrence_type IN ('daily','weekly','monthly','selected_days','custom')),
  selected_days    INTEGER[],            -- ISO weekdays (1=Mon … 7=Sun)
  monthly_day      INTEGER CHECK (monthly_day BETWEEN 1 AND 31),
  custom_rule      JSONB,

  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  start_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date         DATE,
  streak           INTEGER NOT NULL DEFAULT 0,
  longest_streak   INTEGER NOT NULL DEFAULT 0,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_habits_user
  ON habits(user_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_habits_category ON habits(category);

-- ─── 3. Projects: extend the existing table (do NOT recreate) ────────────────
-- Existing columns kept: id, user_id, life_area_id, title, description, why,
-- status, priority(int), target_date, progress_pct, last_task_date,
-- stalled_flag, created_at, updated_at.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS category TEXT
    CHECK (category IN (
      'vitality','intellect','discipline','wealth','charisma','willpower'
    )),
  ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT '#6366f1',
  ADD COLUMN IF NOT EXISTS due_date DATE;

-- Extend the status enum-via-CHECK to add 'archived' / 'on_hold' without
-- breaking existing rows ('active','paused','completed','dropped').
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'projects'::regclass AND conname = 'projects_status_check'
  ) THEN
    ALTER TABLE projects DROP CONSTRAINT projects_status_check;
  END IF;
  ALTER TABLE projects ADD CONSTRAINT projects_status_check
    CHECK (status IN ('active','paused','completed','dropped','archived','on_hold'));
END $$;

-- ─── 4. Project sections ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS project_sections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_sections_project
  ON project_sections(project_id, position);

-- ─── 5. Project tasks (separate from daily_tasks) ────────────────────────────

CREATE TABLE IF NOT EXISTS project_tasks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  section_id        UUID REFERENCES project_sections(id) ON DELETE SET NULL,
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'todo'
                    CHECK (status IN ('todo','in_progress','done','skipped')),
  priority          TEXT NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('low','medium','high')),
  due_date          DATE,
  completed_at      TIMESTAMPTZ,
  estimated_minutes INTEGER,
  notes             TEXT,
  position          INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_tasks_project
  ON project_tasks(project_id, position);
CREATE INDEX IF NOT EXISTS idx_project_tasks_section
  ON project_tasks(section_id, position);
CREATE INDEX IF NOT EXISTS idx_project_tasks_due_date
  ON project_tasks(due_date) WHERE due_date IS NOT NULL;

-- ─── 6. Agent task proposals ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_task_proposals (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_id           TEXT NOT NULL,
  proposed_title     TEXT NOT NULL,
  proposed_category  TEXT NOT NULL CHECK (proposed_category IN (
    'vitality','intellect','discipline','wealth','charisma','willpower'
  )),
  proposed_date      DATE NOT NULL,
  proposed_priority  TEXT NOT NULL DEFAULT 'medium'
                     CHECK (proposed_priority IN ('low','medium','high')),
  proposed_type      TEXT NOT NULL DEFAULT 'task'
                     CHECK (proposed_type IN ('task','habit')),
  reason             TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','approved','rejected','expired')),
  expires_at         TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_proposals_user_status
  ON agent_task_proposals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_proposals_date
  ON agent_task_proposals(proposed_date);
CREATE INDEX IF NOT EXISTS idx_agent_proposals_user_agent
  ON agent_task_proposals(user_id, agent_id);

-- ─── 7. RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE habits               ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_sections     ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_tasks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_task_proposals ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='habits' AND policyname='owner') THEN
    CREATE POLICY "owner" ON habits FOR ALL USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='project_sections' AND policyname='owner') THEN
    CREATE POLICY "owner" ON project_sections FOR ALL USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='project_tasks' AND policyname='owner') THEN
    CREATE POLICY "owner" ON project_tasks FOR ALL USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='agent_task_proposals' AND policyname='owner') THEN
    CREATE POLICY "owner" ON agent_task_proposals FOR ALL USING (user_id = auth.uid());
  END IF;
END $$;

-- ─── 8. Sanity checks ────────────────────────────────────────────────────────
-- After running this migration, the following queries should all succeed:
--   SELECT task_type, habit_id, project_task_id FROM daily_tasks LIMIT 1;
--   SELECT category, color, due_date FROM projects LIMIT 1;
--   SELECT 1 FROM habits, project_sections, project_tasks, agent_task_proposals;
