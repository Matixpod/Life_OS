-- Life OS — Priority-weighted AP cost
-- Run AFTER 009_daily_system.sql (which created the original ap_cost column)
--
-- Replaces the trivial `ap_cost = estimated_minutes` generated column with a
-- formula that factors task difficulty (priority L/M/H). Regenerative tasks
-- are intentionally excluded from the multiplier — recovery shouldn't be
-- amplified by a "priority" field that represents cognitive load.
--
-- Multipliers (per ADR — May 2026):
--   HIGH   (priority = 1)  → 1.5×   60 min → 90 AP
--   MEDIUM (priority = 2)  → 1.0×   60 min → 60 AP   (baseline)
--   LOW    (priority = 3)  → 0.7×   60 min → 42 AP
--
-- Generated stored columns can't be ALTER-ed in place — Postgres requires a
-- DROP + ADD. Since the column has no user-supplied data (it's derived), this
-- is non-destructive.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_tasks' AND column_name = 'ap_cost'
  ) THEN
    ALTER TABLE daily_tasks DROP COLUMN ap_cost;
  END IF;

  ALTER TABLE daily_tasks
    ADD COLUMN ap_cost INTEGER GENERATED ALWAYS AS (
      CASE
        WHEN estimated_minutes IS NULL OR estimated_minutes <= 0 THEN 0
        WHEN is_regenerative THEN estimated_minutes
        WHEN priority = 1 THEN GREATEST(1, ROUND(estimated_minutes * 1.5)::INTEGER)
        WHEN priority = 3 THEN GREATEST(1, ROUND(estimated_minutes * 0.7)::INTEGER)
        ELSE estimated_minutes
      END
    ) STORED;
END $$;

-- Sanity:
--   SELECT id, estimated_minutes, priority, is_regenerative, ap_cost
--   FROM daily_tasks
--   ORDER BY created_at DESC LIMIT 10;
-- Expect: HIGH 60-min → 90, LOW 60-min → 42, regenerative → equals minutes.
