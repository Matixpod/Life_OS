-- 011_habits_stamina.sql
-- Extend `habits` so habit completions can drain or restore Stamina (AP)
-- the same way `daily_tasks` already do (see 009_daily_system.sql).
--
-- `estimated_minutes` was added in 009. We now add `is_regenerative` and
-- backfill the column onto `daily_tasks` rows that materialise from this
-- habit, so the daily_log aggregation picks them up.
--
-- Idempotent: safe to re-run.

ALTER TABLE habits
  ADD COLUMN IF NOT EXISTS is_regenerative BOOLEAN NOT NULL DEFAULT FALSE;

-- Optional: backfill existing daily_tasks habit-entry rows so historical
-- completions reflect the habit's current stamina settings. New entries
-- generated after this migration will be set explicitly by the service.
UPDATE daily_tasks dt
SET    estimated_minutes = h.estimated_minutes,
       is_regenerative   = h.is_regenerative
FROM   habits h
WHERE  dt.habit_id = h.id
  AND  dt.task_type = 'habit_entry'
  AND  (dt.estimated_minutes IS DISTINCT FROM h.estimated_minutes
        OR dt.is_regenerative IS DISTINCT FROM h.is_regenerative);

-- Sanity check after running:
--   SELECT id, title, estimated_minutes, is_regenerative FROM habits LIMIT 1;
