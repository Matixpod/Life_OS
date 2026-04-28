-- Life OS — Seed Data
-- Run AFTER 001_initial_schema.sql
-- Replace 'Your Name' with your actual name

-- ─── INSERT USER ──────────────────────────────────────────────────────────────

INSERT INTO users (name, system_start_date, current_streak_days, longest_streak_days)
VALUES ('Your Name', CURRENT_DATE, 1, 1)
RETURNING id;

-- ─── HELPER: get user id ──────────────────────────────────────────────────────
-- Store this for the queries below. Replace the UUID after running the INSERT above.
-- Example: copy the returned id and replace 'USER_ID_HERE' in all queries below.

DO $$
DECLARE
  uid UUID;
BEGIN
  SELECT id INTO uid FROM users LIMIT 1;

  -- ─── MOCK DAILY SUMMARY ─────────────────────────────────────────────────────
  INSERT INTO daily_summaries (user_id, date, potential_score, score_breakdown, agent_notes)
  VALUES (
    uid,
    CURRENT_DATE,
    74,
    '{"goals": 15, "sleep": 12, "workout": 18, "cognitive": 8, "mental_health": 10, "deep_work": 6, "nutrition": 0, "learning": 5, "body": 0, "supplements": 0}'::JSONB,
    'Solid day. Good sleep and workout. Cognitive challenge pending.'
  );

  -- ─── MOCK SLEEP ENTRY ───────────────────────────────────────────────────────
  INSERT INTO sleep_entries (user_id, date, duration_minutes, quality_score, energy_score, morning_mood)
  VALUES (uid, CURRENT_DATE, 450, 4, 78, 7);

  -- ─── MOCK COGNITIVE CHALLENGE ────────────────────────────────────────────────
  INSERT INTO cognitive_challenges (user_id, date, type, title, external_url, difficulty, timer_seconds, completed)
  VALUES (
    uid,
    CURRENT_DATE,
    'leetcode',
    'Two Sum',
    'https://leetcode.com/problems/two-sum/',
    'easy',
    900,
    false
  );

  -- ─── MOCK SUPPLEMENT ITEMS ──────────────────────────────────────────────────
  INSERT INTO supplement_items (user_id, name, dosage, time_of_day, active) VALUES
    (uid, 'NMN', '500mg', 'morning', true),
    (uid, 'Vitamin D3', '5000 IU', 'morning', true),
    (uid, 'Omega-3', '2g', 'morning', true),
    (uid, 'Magnesium Glycinate', '400mg', 'evening', true),
    (uid, 'Creatine', '5g', 'morning', true),
    (uid, 'Vitamin K2', '100mcg', 'morning', true);

  -- ─── MOCK BODY METRICS ──────────────────────────────────────────────────────
  INSERT INTO body_metrics (user_id, date, weight_kg, height_cm, body_fat_pct, water_pct, muscle_kg)
  VALUES (uid, CURRENT_DATE, 78.5, 182.0, 16.5, 58.2, 38.4);

  -- ─── MOCK STREAK HISTORY ────────────────────────────────────────────────────
  INSERT INTO streak_history (user_id, start_date, length_days)
  VALUES (uid, CURRENT_DATE, 1);

END $$;
