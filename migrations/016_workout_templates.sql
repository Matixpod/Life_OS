-- Life OS — PROMETHEUS Workout Templates
-- First-class reusable workout definitions: a template stores exercise order
-- and target set count; kg/reps are pulled from each exercise's last
-- performance at load time (prometheus_service.get_last_sets_for_exercise).
--
-- Run AFTER 015_workout_tasks.sql.

-- ─── 1. workout_templates ──────────────────────────────────────────────────
-- A named, reusable workout. UNIQUE on (user_id, lower(name)) so the
-- "Save workout" flow can upsert by name regardless of case.

CREATE TABLE IF NOT EXISTS workout_templates (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_workout_templates_user_lname
    ON workout_templates (user_id, lower(name));

CREATE INDEX IF NOT EXISTS idx_workout_templates_user
    ON workout_templates (user_id);

-- ─── 2. workout_template_exercises ────────────────────────────────────────
-- Exercise list for each template. target_sets stores the planned number of
-- sets; the actual reps/kg are loaded from the user's last performance of
-- this exercise via prometheus_service.get_last_sets_for_exercise().
-- muscle_load is duplicated here so the UI can show top muscle groups
-- without joining back to prometheus_exercises.

CREATE TABLE IF NOT EXISTS workout_template_exercises (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id    UUID NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
    exercise_name  TEXT NOT NULL,
    order_index    INTEGER NOT NULL DEFAULT 0,
    target_sets    INTEGER NOT NULL DEFAULT 3,
    muscle_load    JSONB NOT NULL DEFAULT '{}',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workout_template_exercises_template
    ON workout_template_exercises (template_id, order_index);

-- ─── 3. daily_tasks → workout_templates FK ────────────────────────────────
-- New FK lets a planned daily_task point at a concrete template. ON DELETE
-- SET NULL keeps historical workout tasks intact when the template they
-- referenced is later removed — workout_template_label is kept for the
-- human-readable name.

ALTER TABLE daily_tasks
    ADD COLUMN IF NOT EXISTS workout_template_id UUID
        REFERENCES workout_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_daily_tasks_workout_template_id
    ON daily_tasks (workout_template_id)
    WHERE workout_template_id IS NOT NULL;

-- ─── 4. RLS ────────────────────────────────────────────────────────────────
-- Single-user pattern matches the existing prometheus migrations
-- (014_cardio.sql, prometheus.sql). When multi-user lands, swap the USING
-- expression for `user_id = auth.uid()` per ADR-011.

ALTER TABLE workout_templates           ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_template_exercises  ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='workout_templates'
      AND policyname='own workout templates') THEN
    CREATE POLICY "own workout templates"
      ON workout_templates FOR ALL
      USING (user_id = (SELECT id FROM users LIMIT 1));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='workout_template_exercises'
      AND policyname='own template exercises') THEN
    CREATE POLICY "own template exercises"
      ON workout_template_exercises FOR ALL
      USING (
        template_id IN (
          SELECT id FROM workout_templates
          WHERE user_id = (SELECT id FROM users LIMIT 1)
        )
      );
  END IF;
END $$;

-- Sanity:
--   SELECT * FROM workout_templates LIMIT 5;
--   SELECT * FROM workout_template_exercises LIMIT 5;
--   SELECT id, workout_template_id, workout_template_label
--     FROM daily_tasks WHERE task_type = 'workout' LIMIT 5;
