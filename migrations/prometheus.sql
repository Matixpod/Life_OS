-- Migration: 020_prometheus_gym
-- Creates all tables needed by the PROMETHEUS gym module.
-- Run via Supabase SQL editor or supabase db push.

-- ─── 1. Exercise library ───────────────────────────────────────────────────
-- Stores user-defined exercises with AI-determined muscle load.
-- "muscle_load" example: {"chest": 0.7, "triceps": 0.2, "front_delt": 0.1}

CREATE TABLE IF NOT EXISTS prometheus_exercises (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    muscle_load  JSONB NOT NULL DEFAULT '{}',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_prometheus_exercises_user
    ON prometheus_exercises (user_id);

-- ─── 2. Training sessions ─────────────────────────────────────────────────
-- One session = one gym visit.

CREATE TABLE IF NOT EXISTS prometheus_sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date        DATE NOT NULL,
    label       TEXT NOT NULL DEFAULT '',
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prometheus_sessions_user_date
    ON prometheus_sessions (user_id, date DESC);

-- ─── 3. Session exercises ─────────────────────────────────────────────────
-- Each exercise performed inside a session.
-- "sets" example: [{"reps": 12, "kg": 80}, {"reps": 10, "kg": 85}]
-- "muscle_load" is stored per-exercise (may override library value)

CREATE TABLE IF NOT EXISTS prometheus_session_exercises (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES prometheus_sessions(id) ON DELETE CASCADE,
    exercise_name   TEXT NOT NULL,
    sets            JSONB NOT NULL DEFAULT '[]',
    muscle_load     JSONB NOT NULL DEFAULT '{}',
    order_index     INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prometheus_session_exercises_session
    ON prometheus_session_exercises (session_id);

-- ─── 4. Weekly AI reports ─────────────────────────────────────────────────
-- Cached PROMETHEUS weekly analysis reports.
-- "report_json" stores the full structured report from the AI.

CREATE TABLE IF NOT EXISTS prometheus_reports (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week_start   DATE NOT NULL,
    report_json  JSONB NOT NULL DEFAULT '{}',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_prometheus_reports_user_week
    ON prometheus_reports (user_id, week_start DESC);

-- ─── 5. RLS policies (mirror existing tables pattern) ─────────────────────
-- Enable Row Level Security — single-user system, but good practice.

ALTER TABLE prometheus_exercises         ENABLE ROW LEVEL SECURITY;
ALTER TABLE prometheus_sessions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE prometheus_session_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE prometheus_reports           ENABLE ROW LEVEL SECURITY;

-- Users can only see/modify their own rows.
CREATE POLICY "own exercises"
    ON prometheus_exercises FOR ALL
    USING (user_id = (SELECT id FROM users LIMIT 1));

CREATE POLICY "own sessions"
    ON prometheus_sessions FOR ALL
    USING (user_id = (SELECT id FROM users LIMIT 1));

CREATE POLICY "own session exercises"
    ON prometheus_session_exercises FOR ALL
    USING (
        session_id IN (
            SELECT id FROM prometheus_sessions
            WHERE user_id = (SELECT id FROM users LIMIT 1)
        )
    );

CREATE POLICY "own reports"
    ON prometheus_reports FOR ALL
    USING (user_id = (SELECT id FROM users LIMIT 1));

-- ─── 6. Seed: default exercise library ────────────────────────────────────
-- Pre-populate common exercises. The user's own upserts will override these.
-- Note: user_id is injected at runtime by the service; this seed uses a
-- placeholder that must be replaced in the service layer.

-- (No static seed here — the AI populates the library dynamically on first parse.)

-- ─── Done ──────────────────────────────────────────────────────────────────
-- After running this migration, add to backend/core/config.py:
--
--   TABLE_PROMETHEUS_EXERCISES    = "prometheus_exercises"
--   TABLE_PROMETHEUS_SESSIONS     = "prometheus_sessions"
--   TABLE_PROMETHEUS_SESSION_EXES = "prometheus_session_exercises"
--   TABLE_PROMETHEUS_REPORTS      = "prometheus_reports"
