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

// ─── Goals module ────────────────────────────────────────────────────────────

export interface LifeArea {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string | null;
  sort_order: number;
  active: boolean;
}

export type ProjectStatus = 'active' | 'paused' | 'completed' | 'dropped';
export type Priority = 1 | 2 | 3;

export interface ProjectLifeAreaNested {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface Project {
  id: string;
  life_area_id: string | null;
  life_area: ProjectLifeAreaNested | null;
  title: string;
  description: string | null;
  why: string | null;
  status: ProjectStatus;
  priority: Priority;
  target_date: string | null;
  progress_pct: number;
  last_task_date: string | null;
  stalled_flag: boolean;
  created_at: string | null;
}

export type TaskSource = 'manual' | 'agent' | 'google_calendar';

export interface TaskProjectNested {
  id: string;
  title: string;
  life_area_id: string | null;
}

export interface DailyTask {
  id: string;
  project_id: string | null;
  project: TaskProjectNested | null;
  life_area_id: string | null;
  life_area: ProjectLifeAreaNested | null;
  date: string;
  title: string;
  notes: string | null;
  priority: Priority;
  estimated_minutes: number | null;
  source: TaskSource;
  completed: boolean;
  completed_at: string | null;
  postponed_count: number;
  postponed_reason: string | null;
  agent_justification: string | null;
}

export interface AgentTaskSuggestion {
  title: string;
  project_id: string | null;
  life_area_id: string | null;
  priority: Priority;
  estimated_minutes: number;
  justification: string;
  how_to_start: string;
}

export interface DailyPlan {
  id: string;
  date: string;
  generated_at: string | null;
  tasks_suggested: AgentTaskSuggestion[];
  plan_summary: string;
  energy_context: string;
  accepted: boolean;
  modified: boolean;
}

export interface GoalsSummary {
  total: number;
  completed: number;
  p1_completed: number;
  p1_total: number;
  has_agent_plan: boolean;
}

export interface CreateProjectPayload {
  title: string;
  life_area_id: string | null;
  description?: string | null;
  why?: string | null;
  status?: ProjectStatus;
  priority?: Priority;
  target_date?: string | null;
}

export interface CreateTaskPayload {
  title: string;
  date: string;
  project_id: string | null;
  life_area_id: string | null;
  notes?: string | null;
  priority: Priority;
  estimated_minutes?: number | null;
}

export interface PostponePayload {
  reason: string;
  new_date?: string | null;
}

// ─── KRONOS — Discipline & Consistency agent ────────────────────────────────

export type TaskCategory =
  | 'vitality'
  | 'intellect'
  | 'discipline'
  | 'wealth'
  | 'charisma'
  | 'willpower';

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'skipped';
export type TrendDirection = 'up' | 'down' | 'stable';
export type AnalysisType = 'weekly' | 'category_deep_dive' | 'crisis_intervention';
export type AnalysisStatus = 'complete' | 'incomplete';

export interface StreakData {
  category: TaskCategory;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
  streak_broken_on: string[];
  trend: TrendDirection;
}

export interface PatternData {
  category: TaskCategory;
  by_day_of_week: Record<string, number>;
  by_hour_of_day: Record<number, number>;
  peak_zones: string[];
  dead_zones: string[];
  sample_size: number;
  insufficient_data: boolean;
}

export interface DailyPvE {
  date: string;
  planned: number;
  completed: number;
  ratio: number;
}

export interface PvEScore {
  category: TaskCategory;
  overall_ratio: number;
  daily_breakdown: DailyPvE[];
  zero_execution_days: string[];
  best_day: string | null;
  worst_day: string | null;
}

export type KronosAlertType = 'dead_zone' | 'streak_at_risk' | 'zero_execution';

export interface KronosAlert {
  type: KronosAlertType;
  category: TaskCategory | null;
  message: string;
}

export interface KronosDashboard {
  global_consistency_score: number | null;
  streaks: StreakData[];
  patterns: PatternData[];
  pve_scores: PvEScore[];
  last_analysis_at: string | null;
  alerts: KronosAlert[];
}

export interface KronosAnalysis {
  id: string;
  analysis_text: string;
  triggered_by: AnalysisType | 'manual';
  focus_category: TaskCategory | null;
  status: AnalysisStatus;
  created_at: string;
}

export interface KronosAnalysisRequest {
  analysis_type?: AnalysisType;
  focus_category?: TaskCategory | null;
}

// ─── Task System ────────────────────────────────────────────────────────────
//
// Distinct from `DailyTask` (goals module) — this is the new, KRONOS-aware
// shape served by `/api/v1/tasks/*`. The two coexist on the same DB table
// (`daily_tasks`) but expose different views.

export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  user_id: string;
  title: string;
  category: TaskCategory | null;
  status: TaskStatus;
  priority: TaskPriority;
  scheduled_date: string | null;
  completed_at: string | null;
  estimated_minutes: number | null;
  notes: string | null;
  created_at: string;
}

export interface TaskCreatePayload {
  title: string;
  category: TaskCategory;
  priority?: TaskPriority;
  scheduled_date?: string | null;
  estimated_minutes?: number | null;
  notes?: string | null;
}

export interface TaskUpdatePayload {
  title?: string;
  category?: TaskCategory;
  status?: TaskStatus;
  priority?: TaskPriority;
  scheduled_date?: string | null;
  estimated_minutes?: number | null;
  notes?: string | null;
}

export interface CategoryDaySummary {
  category: TaskCategory;
  planned: number;
  completed: number;
  xp_earned: number;
}

export interface DailyTaskList {
  date: string;
  tasks: Task[];
  by_category: Record<string, CategoryDaySummary>;
  total_planned: number;
  total_completed: number;
  completion_rate: number;
}

export interface WeeklyTaskList {
  week_start: string;
  week_end: string;
  days: DailyTaskList[];
  total_xp: number;
  best_day: string | null;
  worst_day: string | null;
}

export type TaskBonusReason = 'early_bird' | 'on_schedule' | 'streak_bonus';

export interface TaskCompletionResult {
  task: Task;
  xp_earned: number;
  streak_updated: boolean;
  new_streak: number;
  bonus_reasons: TaskBonusReason[];
}

export interface TaskListFilters {
  date?: string;
  category?: TaskCategory;
  status?: TaskStatus;
  limit?: number;
  offset?: number;
}
