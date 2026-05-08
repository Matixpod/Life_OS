-- Life OS — PROMETHEUS Cardio System
-- Adds cardio tracking + retroactive kcal columns on strength sessions.
-- Run AFTER prometheus.sql.

-- ─── 1. cardio_profiles ────────────────────────────────────────────────────
-- One row per user. Biometrics used by the kcal formulas (Keytel + MET).

CREATE TABLE IF NOT EXISTS cardio_profiles (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    gender        TEXT NOT NULL CHECK (gender IN ('male','female')),
    weight_kg     NUMERIC(5,1) NOT NULL,
    age           INTEGER NOT NULL,
    vo2max        NUMERIC(4,1),
    body_fat_pct  NUMERIC(4,1),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id)
);

-- ─── 2. cardio_sessions ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cardio_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date            DATE NOT NULL,
    activity_type   TEXT NOT NULL,
    label           TEXT NOT NULL,
    duration_min    INTEGER NOT NULL,
    avg_hr          INTEGER,
    params          JSONB NOT NULL DEFAULT '{}',
    kcal_total      NUMERIC(7,1),
    kcal_epoc       NUMERIC(6,1),
    fat_pct         NUMERIC(5,1),
    carb_pct        NUMERIC(5,1),
    fat_kcal        NUMERIC(7,1),
    carb_kcal       NUMERIC(7,1),
    fat_grams       NUMERIC(6,2),
    hr_zone         TEXT,
    analysis_note   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cardio_sessions_user_date
    ON cardio_sessions (user_id, date DESC);

-- ─── 3. Extend prometheus_sessions with kcal/duration ──────────────────────

ALTER TABLE prometheus_sessions
    ADD COLUMN IF NOT EXISTS duration_min  INTEGER,
    ADD COLUMN IF NOT EXISTS avg_hr        INTEGER,
    ADD COLUMN IF NOT EXISTS kcal_total    NUMERIC(7,1),
    ADD COLUMN IF NOT EXISTS kcal_epoc     NUMERIC(6,1),
    ADD COLUMN IF NOT EXISTS fat_pct       NUMERIC(5,1),
    ADD COLUMN IF NOT EXISTS carb_pct      NUMERIC(5,1),
    ADD COLUMN IF NOT EXISTS fat_grams     NUMERIC(6,2),
    ADD COLUMN IF NOT EXISTS analysis_note TEXT;

-- ─── 4. RLS ─────────────────────────────────────────────────────────────────

ALTER TABLE cardio_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cardio_sessions  ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='cardio_profiles' AND policyname='own cardio profile') THEN
    CREATE POLICY "own cardio profile"
      ON cardio_profiles FOR ALL
      USING (user_id = (SELECT id FROM users LIMIT 1));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='cardio_sessions' AND policyname='own cardio sessions') THEN
    CREATE POLICY "own cardio sessions"
      ON cardio_sessions FOR ALL
      USING (user_id = (SELECT id FROM users LIMIT 1));
  END IF;
END $$;

-- Sanity:
--   SELECT id, gender, weight_kg, age FROM cardio_profiles LIMIT 1;
--   SELECT id, activity_type, kcal_total, fat_grams FROM cardio_sessions LIMIT 1;
--   SELECT id, duration_min, kcal_total, fat_grams FROM prometheus_sessions LIMIT 1;
