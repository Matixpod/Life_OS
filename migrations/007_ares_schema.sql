-- Life OS — ARES (Vitality & Physical Health agent) schema
-- Run AFTER 006_ai_model_preferences.sql

CREATE TABLE IF NOT EXISTS ares_scores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  health_score    NUMERIC(5,2) NOT NULL CHECK (health_score BETWEEN 0 AND 100),
  activity_score  NUMERIC(5,2) NOT NULL CHECK (activity_score BETWEEN 0 AND 100),
  nutrition_score NUMERIC(5,2) NOT NULL CHECK (nutrition_score BETWEEN 0 AND 100),
  sleep_score     NUMERIC(5,2) NOT NULL CHECK (sleep_score BETWEEN 0 AND 100),
  hydration_score NUMERIC(5,2) NOT NULL CHECK (hydration_score BETWEEN 0 AND 100),
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ares_analyses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  analysis_text   TEXT NOT NULL,
  health_score    NUMERIC(5,2) NOT NULL CHECK (health_score BETWEEN 0 AND 100),
  score_delta     NUMERIC(5,2),
  analysis_type   TEXT NOT NULL DEFAULT 'weekly'
                  CHECK (analysis_type IN ('weekly','crisis','progress','manual')),
  status          TEXT NOT NULL DEFAULT 'complete'
                  CHECK (status IN ('complete','incomplete')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ares_scores   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ares_analyses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ares_scores' AND policyname = 'owner'
  ) THEN
    CREATE POLICY "owner" ON ares_scores
      FOR ALL USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ares_analyses' AND policyname = 'owner'
  ) THEN
    CREATE POLICY "owner" ON ares_analyses
      FOR ALL USING (user_id = auth.uid());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ares_scores_user
  ON ares_scores(user_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ares_analyses_user
  ON ares_analyses(user_id, created_at DESC);
