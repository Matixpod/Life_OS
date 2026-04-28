# 🗄️ DATA_MODELS.md — Life OS v2

## 16 Database Tables

All tables have `user_id UUID FK` referencing `users.id`. System is single-user.

---

### `users`
| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | — |
| `name` | TEXT | Display name |
| `avatar_url` | TEXT | Optional |
| `system_start_date` | DATE | Day 1 in Life OS |
| `current_streak_days` | INTEGER | Consecutive days scored |
| `longest_streak_days` | INTEGER | All-time best streak |
| `created_at` | TIMESTAMPTZ | — |

---

### `daily_summaries`
One row per day. `potential_score` calculated by AI agent.
| Field | Type | Notes |
|---|---|---|
| `date` | DATE UNIQUE | — |
| `potential_score` | INTEGER 0–100 | AI-calculated |
| `score_breakdown` | JSONB | `{ goals: 15, sleep: 12, workout: 18, cognitive: 10, mental: 12, deep_work: 8, nutrition: 5, learning: 8, body: 5, supplements: 7 }` |
| `agent_notes` | TEXT | Agent's commentary |

---

### `sleep_entries` — Module 2
| Field | Type | Notes |
|---|---|---|
| `date` | DATE UNIQUE | — |
| `duration_minutes` | INTEGER | e.g. 450 = 7h30m |
| `quality_score` | INTEGER 1–5 | Star rating |
| `energy_score` | INTEGER 0–100 | Slider value |
| `morning_mood` | INTEGER 1–10 | Emoji mapped: 😴=2 😕=4 😐=5 🙂=7 ⚡=10 |
| `source` | TEXT | `'manual'` (default) / `'health_connect'` (future) |

**Example:**
```json
{ "date": "2026-04-27", "duration_minutes": 450, "quality_score": 4, "energy_score": 78, "morning_mood": 7 }
```

---

### `goals` — Module 1 (future: Google Calendar sync)
| Field | Type | Notes |
|---|---|---|
| `date` | DATE | — |
| `title` | TEXT | — |
| `completed` | BOOLEAN | — |
| `source` | TEXT | `'manual'` / `'google_calendar'` |
| `google_event_id` | TEXT | For deduplication on re-sync |

---

### `cognitive_challenges` — Module 5
| Field | Type | Notes |
|---|---|---|
| `date` | DATE UNIQUE | One challenge per day |
| `type` | TEXT | `'leetcode'` / `'project_euler'` / `'generated'` |
| `title` | TEXT | Challenge name |
| `external_url` | TEXT | Opens in new tab |
| `difficulty` | TEXT | `'easy'` / `'medium'` / `'hard'` |
| `timer_seconds` | INTEGER | 900 / 1800 / 2700 |
| `completed` | BOOLEAN | — |
| `ai_help_used` | BOOLEAN | Was AI unlocked? |
| `time_spent_seconds` | INTEGER | Actual time on task |

---

### `mental_health_logs` — Module 6
| Field | Type | Notes |
|---|---|---|
| `date` | DATE UNIQUE | — |
| `mood_score` | INTEGER 1–10 | — |
| `energy_score` | INTEGER 1–10 | — |
| `stress_score` | INTEGER 1–10 | — |
| `journal_text` | TEXT | Free-form entry |
| `journal_embedding` | VECTOR(1536) | For semantic search across time |

---

### `body_metrics` — Module 7
| Field | Type | Notes |
|---|---|---|
| `date` | DATE | Not unique — can log multiple times |
| `weight_kg` | DECIMAL(5,2) | e.g. 78.50 |
| `height_cm` | DECIMAL(5,1) | Set once in profile, copied here |
| `body_fat_pct` | DECIMAL(4,1) | e.g. 18.5 |
| `water_pct` | DECIMAL(4,1) | e.g. 55.2 |
| `muscle_kg` | DECIMAL(5,2) | e.g. 38.20 |
| `notes` | TEXT | Optional |

**Derived metric (computed in service, not stored):**
`bmi = weight_kg / (height_cm/100)^2`

---

### `nutrition_logs` — Module 8
Lightweight — text-first, no strict macro counting required.
| Field | Type | Notes |
|---|---|---|
| `date` | DATE | — |
| `meal_type` | TEXT | `'breakfast'` / `'lunch'` / `'dinner'` / `'snack'` |
| `description` | TEXT | e.g. "Chicken breast 200g, rice 150g, broccoli, olive oil" |
| `estimated_protein_g` | INTEGER | Optional, user can leave null |
| `estimated_calories` | INTEGER | Optional |

---

### `deep_work_sessions` — Module 9
| Field | Type | Notes |
|---|---|---|
| `date` | DATE | — |
| `project` | TEXT | What was being worked on |
| `start_time` | TIMESTAMPTZ | Optional (if using built-in timer) |
| `end_time` | TIMESTAMPTZ | Optional |
| `duration_minutes` | INTEGER | Manual or calculated from start/end |
| `focus_quality` | INTEGER 1–5 | Self-rated concentration |
| `notes` | TEXT | What was accomplished |

---

### `learning_logs` — Module 10
| Field | Type | Notes |
|---|---|---|
| `date` | DATE | — |
| `type` | TEXT | `'book'` / `'podcast'` / `'course'` / `'article'` / `'video'` |
| `title` | TEXT | — |
| `author` | TEXT | Optional |
| `duration_minutes` | INTEGER | Time spent |
| `key_takeaways` | TEXT | User's notes |
| `quiz_score` | INTEGER 0–100 | AI-generated comprehension quiz result |
| `embedding` | VECTOR(1536) | Semantic search across learned content |

---

### `daily_intelligence` — Module 11
| Field | Type | Notes |
|---|---|---|
| `date` | DATE UNIQUE | — |
| `news_items` | JSONB | `[{ title, summary, source_url, category }]` — 3 items |
| `quote` | TEXT | — |
| `quote_author` | TEXT | — |
| `generated_at` | TIMESTAMPTZ | — |

**news_items JSONB structure:**
```json
[
  {
    "title": "Exercise shown to reverse cognitive aging by up to 10 years",
    "summary": "A meta-analysis of 47 studies found that 150 min/week of aerobic exercise significantly improves working memory and processing speed in adults over 30.",
    "source_url": "https://nature.com/...",
    "category": "health"
  }
]
```

---

### `periodic_reviews` — Module 12
| Field | Type | Notes |
|---|---|---|
| `type` | TEXT | `'weekly'` / `'monthly'` |
| `period_start` | DATE | — |
| `period_end` | DATE | — |
| `avg_potential_score` | DECIMAL(4,1) | — |
| `review_markdown` | TEXT | Full rich review for user (~2000 tokens) |
| `context_snapshot` | TEXT | Compressed JSON for agents (<400 tokens) |
| `highlights` | JSONB | `{ achievements: [...], concerns: [...], best_day, worst_day }` |

**context_snapshot JSON structure (example):**
```json
{
  "key_facts": [
    "Averaged 7.2h sleep, significantly above baseline",
    "Completed cognitive challenge 6/7 days — strong consistency",
    "Missed workouts on days with poor sleep (<6h)"
  ],
  "patterns": [
    "Sleep quality correlates strongly with next-day mood score (r≈0.81)",
    "Deep work is lowest on Fridays and after late nights"
  ],
  "concerns": [
    "Nutrition logging only 3/7 days — data gap affects scoring"
  ],
  "achievements": ["7-day cognitive challenge streak", "Personal best: 91/100 on Thursday"],
  "avg_metrics": {
    "sleep_hrs": 7.2, "energy": 74, "mood": 7.1,
    "score": 78, "workout_days": 5, "deep_work_hrs": 4.3
  }
}
```

---

### `agent_memories`
Long-term semantic memory for AI agents.
| Field | Type | Notes |
|---|---|---|
| `content` | TEXT | A fact, pattern, or observation about the user |
| `embedding` | VECTOR(1536) | For cosine similarity search |
| `metadata` | JSONB | `{ module, type, tags, confidence, date_range }` |

---

### `streak_history`
| Field | Type | Notes |
|---|---|---|
| `start_date` | DATE | Streak started |
| `end_date` | DATE | null if ongoing |
| `length_days` | INTEGER | — |

---

## TypeScript Types (`src/types/index.ts`)

```typescript
export interface UserProfile {
  id: string;
  name: string;
  avatar_url: string | null;
  system_start_date: string;
  current_streak_days: number;
  longest_streak_days: number;
}

export interface ScoreBreakdown {
  goals: number;
  sleep: number;
  workout: number;
  cognitive: number;
  mental_health: number;
  deep_work: number;
  nutrition: number;
  learning: number;
  body: number;
  supplements: number;
}

export interface DailySummary {
  date: string;
  potential_score: number;
  score_breakdown: ScoreBreakdown | null;
  modules: {
    goals: { total: number; completed: number };
    sleep: { duration_minutes: number | null; energy_score: number | null; quality_score: number | null };
    supplements: { total: number; taken: number };
    workout: { completed: boolean; label: string | null; muscle_groups: string[] };
    cognitive: { completed: boolean; title: string | null; difficulty: 'easy' | 'medium' | 'hard' | null; ai_help_used: boolean };
    mental_health: { mood_score: number | null; logged: boolean };
    body: { weight_kg: number | null; logged: boolean };
    nutrition: { meals_logged: number };
    deep_work: { total_minutes: number };
    learning: { items_logged: number; avg_quiz_score: number | null };
    intelligence: { loaded: boolean };
    review: { last_review_date: string | null; type: string | null };
  };
}

export type MorningMoodEmoji = '😴' | '😕' | '😐' | '🙂' | '⚡';
export type MoodScore = 2 | 4 | 5 | 7 | 10;

export const MOOD_MAP: Record<MorningMoodEmoji, MoodScore> = {
  '😴': 2, '😕': 4, '😐': 5, '🙂': 7, '⚡': 10
};

export type ChallengeDifficulty = 'easy' | 'medium' | 'hard';
export const TIMER_SECONDS: Record<ChallengeDifficulty, number> = {
  easy: 900, medium: 1800, hard: 2700
};

export interface NewsItem {
  title: string;
  summary: string;
  source_url: string;
  category: 'health' | 'science' | 'psychology' | 'tech' | 'productivity';
}

export interface DailyIntelligence {
  date: string;
  news_items: NewsItem[];
  quote: string;
  quote_author: string;
}

export interface PeriodicReview {
  id: string;
  type: 'weekly' | 'monthly';
  period_start: string;
  period_end: string;
  avg_potential_score: number;
  review_markdown: string;
  context_snapshot: string | null;
  highlights: {
    achievements: string[];
    concerns: string[];
    best_day: string | null;
    worst_day: string | null;
  };
  created_at: string;
}
```
