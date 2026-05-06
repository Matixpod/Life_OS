-- Life OS — AI Model Preferences
-- Run AFTER 005_*.sql (or 004_kronos_schema.sql if 005 not present yet)
--
-- Stores per-agent AI provider preferences. One row per (user_id, agent_id);
-- agent_id="global" is the fallback when an individual agent has no row.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_provider') THEN
    CREATE TYPE ai_provider AS ENUM ('claude', 'gemini', 'deepseek', 'ollama');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS ai_model_preferences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_id    TEXT NOT NULL,                 -- 'kronos','ares','athena','global'
  provider    ai_provider NOT NULL DEFAULT 'claude',
  model_name  TEXT NOT NULL,
  temperature NUMERIC(3,2) NOT NULL DEFAULT 0.7
              CHECK (temperature BETWEEN 0.0 AND 1.0),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_model_prefs_user
  ON ai_model_preferences(user_id);

ALTER TABLE ai_model_preferences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_model_preferences'
      AND policyname = 'owner'
  ) THEN
    CREATE POLICY "owner" ON ai_model_preferences
      FOR ALL USING (user_id = auth.uid());
  END IF;
END $$;
