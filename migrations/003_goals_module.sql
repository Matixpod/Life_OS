-- Life OS — Goals Module Schema + Seed Data
-- Run AFTER 001_initial_schema.sql and 002_seed_data.sql

-- ─── SCHEMA ───────────────────────────────────────────────────────────────────

CREATE TABLE life_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  life_area_id UUID REFERENCES life_areas(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  why TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'dropped')),
  priority INTEGER DEFAULT 2 CHECK (priority BETWEEN 1 AND 3),
  target_date DATE,
  progress_pct INTEGER DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  last_task_date DATE,
  stalled_flag BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE daily_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  life_area_id UUID REFERENCES life_areas(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  title TEXT NOT NULL,
  notes TEXT,
  priority INTEGER DEFAULT 2 CHECK (priority BETWEEN 1 AND 3),
  estimated_minutes INTEGER,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'agent', 'google_calendar')),
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  postponed_count INTEGER DEFAULT 0,
  postponed_reason TEXT,
  agent_justification TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE daily_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL UNIQUE,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  tasks_suggested JSONB,
  plan_summary TEXT,
  energy_context TEXT,
  accepted BOOLEAN DEFAULT FALSE,
  modified BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_daily_tasks_date ON daily_tasks(date);
CREATE INDEX idx_daily_tasks_project ON daily_tasks(project_id);
CREATE INDEX idx_projects_life_area ON projects(life_area_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_stalled ON projects(stalled_flag) WHERE stalled_flag = true;

-- ─── SEED DATA ────────────────────────────────────────────────────────────────

DO $$
DECLARE
  uid UUID;
  area_health UUID;
  area_career UUID;
  area_finance UUID;
  area_projects UUID;
  area_relations UUID;
  area_learning UUID;
  proj_lifeos UUID;
  proj_python UUID;
BEGIN
  SELECT id INTO uid FROM users LIMIT 1;

  -- Life Areas
  INSERT INTO life_areas (user_id, name, icon, color, sort_order, description) VALUES
    (uid, 'Health & Longevity', '💪', '#10B981', 1, 'Physical performance, longevity protocols, mental health')
    RETURNING id INTO area_health;

  INSERT INTO life_areas (user_id, name, icon, color, sort_order, description) VALUES
    (uid, 'Career & Skills', '🧠', '#3B82F6', 2, 'Professional growth, technical skills, coding')
    RETURNING id INTO area_career;

  INSERT INTO life_areas (user_id, name, icon, color, sort_order, description) VALUES
    (uid, 'Finance', '💰', '#F59E0B', 3, 'Savings, investments, financial independence')
    RETURNING id INTO area_finance;

  INSERT INTO life_areas (user_id, name, icon, color, sort_order, description) VALUES
    (uid, 'Personal Projects', '🚀', '#8B5CF6', 4, 'Side projects, entrepreneurial ideas, Life OS')
    RETURNING id INTO area_projects;

  INSERT INTO life_areas (user_id, name, icon, color, sort_order, description) VALUES
    (uid, 'Relationships', '❤️', '#EC4899', 5, 'Family, friends, social connections')
    RETURNING id INTO area_relations;

  INSERT INTO life_areas (user_id, name, icon, color, sort_order, description) VALUES
    (uid, 'Learning & Growth', '📚', '#06B6D4', 6, 'Books, courses, intellectual curiosity')
    RETURNING id INTO area_learning;

  -- Sample projects
  INSERT INTO projects (user_id, life_area_id, title, description, why, status, priority, progress_pct, last_task_date)
  VALUES (
    uid, area_projects,
    'Build Life OS',
    'Personal intelligence dashboard with 12 tracking modules and AI agents',
    'I want a system that helps me optimize every area of my life and discover my best self',
    'active', 1, 15, CURRENT_DATE - 1
  ) RETURNING id INTO proj_lifeos;

  INSERT INTO projects (user_id, life_area_id, title, description, why, status, priority, progress_pct, last_task_date)
  VALUES (
    uid, area_career,
    'FastAPI & Python Mastery',
    'Reach intermediate-advanced level in Python backend development',
    'Core skill needed for Life OS backend and future career opportunities',
    'active', 1, 35, CURRENT_DATE - 9  -- stalled: 9 days ago
  ) RETURNING id INTO proj_python;

  -- Mark Python project as stalled (9 days no activity)
  UPDATE projects SET stalled_flag = TRUE WHERE id = proj_python;

  -- Sample daily tasks for today
  INSERT INTO daily_tasks (user_id, project_id, life_area_id, date, title, priority, estimated_minutes, source, agent_justification)
  VALUES
    (uid, proj_lifeos, area_projects, CURRENT_DATE,
     'Build Goals module backend (routers + services)',
     1, 60, 'agent',
     'Life OS is your top P1 project and has been stalled for 3 days. Morning is your peak cognitive window — use it for this.'),

    (uid, NULL, area_health, CURRENT_DATE,
     'Plan this week''s training split',
     1, 15, 'agent',
     'Health is non-negotiable. Quick planning task that unblocks your workout execution all week.'),

    (uid, proj_python, area_career, CURRENT_DATE,
     'Complete FastAPI chapter 4: dependency injection',
     2, 45, 'agent',
     'Python project has been stalled 9 days. Agent escalation: address it today or decide to pause.');

  -- One completed task
  INSERT INTO daily_tasks (user_id, life_area_id, date, title, priority, estimated_minutes, source, completed, completed_at)
  VALUES
    (uid, area_health, CURRENT_DATE, 'Review morning supplement protocol', 2, 10, 'manual', TRUE, NOW() - INTERVAL '2 hours');

END $$;
