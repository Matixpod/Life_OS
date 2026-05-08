-- Life OS — Workout daily-task type
-- Lets a `daily_tasks` row represent a planned workout that, on completion,
-- spawns a `prometheus_sessions` entry (copying exercises/sets from the most
-- recent strength session with a matching label).
--
-- Run AFTER 014_cardio.sql.

-- ─── 1. Extend task_type CHECK ──────────────────────────────────────────────
-- 008 created the constraint with three values; we drop it and re-add it with
-- 'workout' included so the column accepts the new task type.

ALTER TABLE daily_tasks DROP CONSTRAINT IF EXISTS daily_tasks_task_type_check;
ALTER TABLE daily_tasks
  ADD CONSTRAINT daily_tasks_task_type_check
  CHECK (task_type IN ('task', 'habit_entry', 'project_task', 'workout'));

-- ─── 2. workout_template_label ──────────────────────────────────────────────
-- The label of the source PROMETHEUS session. On completion, the service
-- finds the most recent prometheus_session with this label and copies its
-- exercises (with last sets) into a new session.

ALTER TABLE daily_tasks
  ADD COLUMN IF NOT EXISTS workout_template_label TEXT;

CREATE INDEX IF NOT EXISTS idx_daily_tasks_workout_template
  ON daily_tasks (user_id, workout_template_label)
  WHERE workout_template_label IS NOT NULL;

-- Sanity:
--   SELECT id, task_type, workout_template_label
--   FROM daily_tasks WHERE task_type = 'workout' LIMIT 5;
