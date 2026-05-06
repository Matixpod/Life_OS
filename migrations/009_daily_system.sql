-- Life OS — Daily System: Stamina, Briefing, Quest Cards
-- Run AFTER 008_redesign_schema.sql
--
-- Adaptations vs. /docs/agents/daily-system/PROMPT.md:
--   * FKs reference `users(id)` (single-user table, ADR-003), not
--     `auth.users(id)` — same pattern as 003/004/008.
--   * RLS still uses `auth.uid()` per ADR-011 (multi-user-ready policy).
--   * `daily_tasks.scheduled_date` does not exist — the column is named
--     `date` (migration 003). The unique main-quest index targets `date`.
--   * `daily_tasks.estimated_minutes` already exists from migration 003 —
--     ADD COLUMN IF NOT EXISTS makes that line a no-op (preserves data).
--   * `project_tasks.estimated_minutes` already exists from migration 008 —
--     same no-op behaviour.

-- ─── 1. daily_logs ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS daily_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  sleep_score     SMALLINT NOT NULL CHECK (sleep_score BETWEEN 0 AND 100),
  energy_score    SMALLINT NOT NULL CHECK (energy_score BETWEEN 0 AND 100),
  stamina_pool    INTEGER NOT NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_logs_user_date
  ON daily_logs(user_id, date);

-- ─── 2. stamina_boosts ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stamina_boosts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  boost_type      TEXT NOT NULL CHECK (boost_type IN (
                    'coffee','power_nap','nap','walk','water','meditation'
                  )),
  ap_restored     INTEGER NOT NULL,
  used_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stamina_boosts_user
  ON stamina_boosts(user_id, date);

-- ─── 3. Extend daily_tasks ───────────────────────────────────────────────────

ALTER TABLE daily_tasks
  ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS is_main_quest     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_regenerative   BOOLEAN NOT NULL DEFAULT FALSE;

-- Generated `ap_cost` column. Wrapped in a guard because Postgres rejects
-- ADD COLUMN IF NOT EXISTS … GENERATED on a re-run (the IF NOT EXISTS check
-- doesn't guard the GENERATED clause). Adding it via DO block makes the
-- migration safely idempotent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_tasks' AND column_name = 'ap_cost'
  ) THEN
    ALTER TABLE daily_tasks
      ADD COLUMN ap_cost INTEGER GENERATED ALWAYS AS (estimated_minutes) STORED;
  END IF;
END $$;

-- Max 1 main quest per (user_id, date). The PROMPT names the column
-- `scheduled_date` but the actual column is `date` (ADR-010 / migration 003).
CREATE UNIQUE INDEX IF NOT EXISTS idx_main_quest_once
  ON daily_tasks(user_id, date) WHERE is_main_quest = TRUE;

-- ─── 4. Extend project_tasks ─────────────────────────────────────────────────

ALTER TABLE project_tasks
  ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER;

-- ─── 5. Extend habits ────────────────────────────────────────────────────────

ALTER TABLE habits
  ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER;

-- ─── 6. RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE daily_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE stamina_boosts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='daily_logs' AND policyname='owner') THEN
    CREATE POLICY "owner" ON daily_logs FOR ALL USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='stamina_boosts' AND policyname='owner') THEN
    CREATE POLICY "owner" ON stamina_boosts FOR ALL USING (user_id = auth.uid());
  END IF;
END $$;

-- ─── 7. Sanity checks ────────────────────────────────────────────────────────
-- After running this migration, the following queries should all succeed:
--   SELECT id, sleep_score, energy_score, stamina_pool FROM daily_logs LIMIT 1;
--   SELECT id, boost_type, ap_restored FROM stamina_boosts LIMIT 1;
--   SELECT estimated_minutes, ap_cost, is_main_quest, is_regenerative FROM daily_tasks LIMIT 1;
--   SELECT estimated_minutes FROM project_tasks LIMIT 1;
--   SELECT estimated_minutes FROM habits LIMIT 1;
