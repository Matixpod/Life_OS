-- Life OS — Initial Schema
-- Run this in Supabase SQL Editor
-- Enable extensions first

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── CORE ─────────────────────────────────────────────────────────────────────

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  avatar_url TEXT,
  system_start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  current_streak_days INTEGER DEFAULT 0,
  longest_streak_days INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE daily_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL UNIQUE,
  potential_score INTEGER CHECK (potential_score BETWEEN 0 AND 100),
  score_breakdown JSONB,
  agent_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── MODULE 1: GOALS ──────────────────────────────────────────────────────────

CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'google_calendar')),
  google_event_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── MODULE 2: SLEEP & ENERGY ─────────────────────────────────────────────────

CREATE TABLE sleep_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL UNIQUE,
  duration_minutes INTEGER,
  quality_score INTEGER CHECK (quality_score BETWEEN 1 AND 5),
  energy_score INTEGER CHECK (energy_score BETWEEN 0 AND 100),
  morning_mood INTEGER CHECK (morning_mood BETWEEN 1 AND 10),
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── MODULE 3: SUPPLEMENTS ────────────────────────────────────────────────────

CREATE TABLE supplement_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dosage TEXT,
  time_of_day TEXT CHECK (time_of_day IN ('morning', 'afternoon', 'evening')),
  active BOOLEAN DEFAULT TRUE
);

CREATE TABLE supplement_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  supplement_id UUID REFERENCES supplement_items(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  taken BOOLEAN DEFAULT FALSE,
  taken_at TIMESTAMPTZ,
  UNIQUE(supplement_id, date)
);

-- ─── MODULE 4: WORKOUT ────────────────────────────────────────────────────────

CREATE TABLE workout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('strength', 'cardio', 'flexibility', 'sport')),
  label TEXT,
  muscle_groups TEXT[],
  duration_minutes INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── MODULE 5: COGNITIVE CHALLENGE ───────────────────────────────────────────

CREATE TABLE cognitive_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('leetcode', 'project_euler', 'generated')),
  title TEXT,
  external_url TEXT,
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  timer_seconds INTEGER,
  completed BOOLEAN DEFAULT FALSE,
  ai_help_used BOOLEAN DEFAULT FALSE,
  time_spent_seconds INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── MODULE 6: MENTAL HEALTH ─────────────────────────────────────────────────

CREATE TABLE mental_health_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL UNIQUE,
  mood_score INTEGER CHECK (mood_score BETWEEN 1 AND 10),
  energy_score INTEGER CHECK (energy_score BETWEEN 1 AND 10),
  stress_score INTEGER CHECK (stress_score BETWEEN 1 AND 10),
  journal_text TEXT,
  journal_embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── MODULE 7: BODY METRICS ───────────────────────────────────────────────────

CREATE TABLE body_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  weight_kg DECIMAL(5,2),
  height_cm DECIMAL(5,1),
  body_fat_pct DECIMAL(4,1),
  water_pct DECIMAL(4,1),
  muscle_kg DECIMAL(5,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── MODULE 8: NUTRITION ──────────────────────────────────────────────────────

CREATE TABLE nutrition_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  description TEXT NOT NULL,
  estimated_protein_g INTEGER,
  estimated_calories INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── MODULE 9: DEEP WORK ──────────────────────────────────────────────────────

CREATE TABLE deep_work_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  project TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration_minutes INTEGER,
  focus_quality INTEGER CHECK (focus_quality BETWEEN 1 AND 5),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── MODULE 10: LEARNING ──────────────────────────────────────────────────────

CREATE TABLE learning_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  type TEXT CHECK (type IN ('book', 'podcast', 'course', 'article', 'video')),
  title TEXT NOT NULL,
  author TEXT,
  duration_minutes INTEGER,
  key_takeaways TEXT,
  quiz_score INTEGER CHECK (quiz_score BETWEEN 0 AND 100),
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── MODULE 11: DAILY INTELLIGENCE ───────────────────────────────────────────

CREATE TABLE daily_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL UNIQUE,
  news_items JSONB,
  quote TEXT,
  quote_author TEXT,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── MODULE 12: PERIODIC REVIEWS ─────────────────────────────────────────────

CREATE TABLE periodic_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('weekly', 'monthly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  avg_potential_score DECIMAL(4,1),
  review_markdown TEXT,
  context_snapshot TEXT,
  highlights JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── AI MEMORY ────────────────────────────────────────────────────────────────

CREATE TABLE agent_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── STREAKS ──────────────────────────────────────────────────────────────────

CREATE TABLE streak_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE,
  length_days INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INDEXES ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_daily_summaries_date ON daily_summaries(date);
CREATE INDEX idx_goals_date ON goals(date);
CREATE INDEX idx_sleep_entries_date ON sleep_entries(date);
CREATE INDEX idx_workout_sessions_date ON workout_sessions(date);
CREATE INDEX idx_cognitive_challenges_date ON cognitive_challenges(date);
CREATE INDEX idx_mental_health_logs_date ON mental_health_logs(date);
CREATE INDEX idx_body_metrics_date ON body_metrics(date);
CREATE INDEX idx_nutrition_logs_date ON nutrition_logs(date);
CREATE INDEX idx_deep_work_sessions_date ON deep_work_sessions(date);
CREATE INDEX idx_learning_logs_date ON learning_logs(date);
CREATE INDEX idx_daily_intelligence_date ON daily_intelligence(date);
CREATE INDEX idx_periodic_reviews_type_period ON periodic_reviews(type, period_start);
