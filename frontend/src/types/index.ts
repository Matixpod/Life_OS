export interface UserProfile {
  id: string;
  name: string;
  avatar_url: string | null;
  system_start_date: string;
  current_streak_days: number;
  longest_streak_days: number;
}

export interface StreakRange {
  start_date: string;
  end_date: string | null;
  length_days: number;
}

export interface StreakInfo {
  current_streak_days: number;
  longest_streak_days: number;
  history: StreakRange[];
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

export interface ModuleSummaries {
  goals: { total: number; completed: number };
  sleep: { duration_minutes: number | null; energy_score: number | null; quality_score: number | null };
  supplements: { total: number; taken: number };
  workout: { completed: boolean; label: string | null; muscle_groups: string[] };
  cognitive: {
    completed: boolean;
    title: string | null;
    difficulty: ChallengeDifficulty | null;
    ai_help_used: boolean;
  };
  mental_health: { mood_score: number | null; logged: boolean };
  body: { weight_kg: number | null; logged: boolean };
  nutrition: { meals_logged: number };
  deep_work: { total_minutes: number };
  learning: { items_logged: number; avg_quiz_score: number | null };
  intelligence: { loaded: boolean };
  review: { last_review_date: string | null; type: 'weekly' | 'monthly' | null };
}

export interface DailySummary {
  date: string;
  potential_score: number;
  score_breakdown: ScoreBreakdown | null;
  modules: ModuleSummaries;
}

export type MorningMoodEmoji = '😴' | '😕' | '😐' | '🙂' | '⚡';
export type MoodScore = 2 | 4 | 5 | 7 | 10;

export const MOOD_MAP: Record<MorningMoodEmoji, MoodScore> = {
  '😴': 2,
  '😕': 4,
  '😐': 5,
  '🙂': 7,
  '⚡': 10,
};

export type ChallengeDifficulty = 'easy' | 'medium' | 'hard';

export const TIMER_SECONDS: Record<ChallengeDifficulty, number> = {
  easy: 900,
  medium: 1800,
  hard: 2700,
};

export interface CognitiveChallenge {
  date: string;
  type: string;
  title: string | null;
  external_url: string | null;
  difficulty: ChallengeDifficulty | null;
  timer_seconds: number | null;
  completed: boolean;
  ai_help_used: boolean;
  time_spent_seconds: number | null;
}

export type NewsCategory = 'health' | 'science' | 'psychology' | 'tech' | 'productivity';

export interface NewsItem {
  title: string;
  summary: string;
  source_url: string;
  category: NewsCategory;
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
  avg_potential_score: number | null;
  review_markdown: string;
  context_snapshot: string | null;
  created_at: string;
}

export interface SleepLogPayload {
  date: string;
  duration_minutes: number;
  quality_score: number;
  energy_score: number;
  morning_mood: number;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}
