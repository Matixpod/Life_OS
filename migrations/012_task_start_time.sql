-- 012_task_start_time.sql
-- Add chronological scheduling within a day:
--   * start_time (TIME, nullable) — manual HH:mm slot
--   * day_part   (TEXT, nullable, CHECK in 'morning' | 'day' | 'evening')
--
-- Both columns live on `daily_tasks` (where the calendar reads from) and on
-- `habits` (so a habit's default time propagates to every generated entry).
-- When start_time is set, day_part should match the corresponding window:
--   05:00–11:59 → morning
--   12:00–17:59 → day
--   18:00–04:59 → evening
-- The frontend infers this; the DB does not enforce it (a manual override is
-- allowed for edge cases like "10pm Sunday-evening cleanup" tagged as 'day').
--
-- Idempotent: safe to re-run.

ALTER TABLE daily_tasks
  ADD COLUMN IF NOT EXISTS start_time TIME NULL,
  ADD COLUMN IF NOT EXISTS day_part   TEXT NULL;

ALTER TABLE habits
  ADD COLUMN IF NOT EXISTS start_time TIME NULL,
  ADD COLUMN IF NOT EXISTS day_part   TEXT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'daily_tasks_day_part_check'
  ) THEN
    ALTER TABLE daily_tasks
      ADD CONSTRAINT daily_tasks_day_part_check
      CHECK (day_part IS NULL OR day_part IN ('morning', 'day', 'evening'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'habits_day_part_check'
  ) THEN
    ALTER TABLE habits
      ADD CONSTRAINT habits_day_part_check
      CHECK (day_part IS NULL OR day_part IN ('morning', 'day', 'evening'));
  END IF;
END $$;

-- Index supports the calendar's chronological ordering within a day.
CREATE INDEX IF NOT EXISTS idx_daily_tasks_date_start_time
  ON daily_tasks (user_id, date, start_time);
