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
  | 'health'
  | 'work'
  | 'knowledge'
  | 'relationships'
  | 'other';

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
  task_type?: 'task' | 'habit_entry' | 'project_task';
  habit_id?: string | null;
  project_task_id?: string | null;
  is_main_quest?: boolean;
  is_regenerative?: boolean;
  ap_cost?: number | null;
}

export interface TaskCreatePayload {
  title: string;
  category: TaskCategory;
  priority?: TaskPriority;
  scheduled_date?: string | null;
  estimated_minutes?: number | null;
  notes?: string | null;
  is_main_quest?: boolean;
  is_regenerative?: boolean;
}

export interface TaskUpdatePayload {
  title?: string;
  category?: TaskCategory;
  status?: TaskStatus;
  priority?: TaskPriority;
  scheduled_date?: string | null;
  estimated_minutes?: number | null;
  notes?: string | null;
  is_main_quest?: boolean;
  is_regenerative?: boolean;
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

// ─── AI Provider Selector ──────────────────────────────────────────────────

export type AIProvider = 'claude' | 'gemini' | 'deepseek' | 'ollama';

export interface AIModelInfo {
  id: string;
  name: string;
  recommended: boolean;
  vram_gb: number | null;
}

export interface AIAvailableModels {
  claude: AIModelInfo[];
  gemini: AIModelInfo[];
  deepseek: AIModelInfo[];
  ollama: AIModelInfo[];
}

export interface AIModelPreference {
  user_id: string;
  agent_id: string;
  provider: AIProvider;
  model_name: string;
  temperature: number;
  updated_at: string | null;
}

export interface AIPreferencesResponse {
  preferences: AIModelPreference[];
}

export interface AIProviderHealthStatus {
  provider: AIProvider;
  online: boolean;
  error_message: string | null;
}

export interface AIHealthResponse {
  providers: AIProviderHealthStatus[];
}

export interface AISetPreferencePayload {
  provider: AIProvider;
  model_name: string;
  temperature?: number;
}

// ─── ARES — Vitality & Physical Health agent ───────────────────────────────

export type VitalitySubcategory = 'activity' | 'nutrition' | 'sleep' | 'hydration';
export type AresToneMode = 'peak' | 'good' | 'needs_work' | 'crisis';

export interface AresSubcategoryScore {
  subcategory: VitalitySubcategory;
  score: number;
  tasks_detected: number;
  days_active: number;
  days_analyzed: number;
  weight: number;
}

export interface AresScoreResult {
  user_id: string;
  health_score: number;
  subcategory_scores: AresSubcategoryScore[];
  score_delta: number | null;
  tone_mode: AresToneMode;
  computed_at: string;
}

export interface AresScoreHistoryPoint {
  date: string;
  score: number | null;
}

export interface AresAnalysis {
  id: string;
  analysis_text: string;
  health_score: number;
  score_delta: number | null;
  analysis_type: string;
  status: 'complete' | 'incomplete';
  created_at: string;
}

export interface AresDashboard {
  current_score: AresScoreResult;
  score_history: AresScoreHistoryPoint[];
  last_analysis: AresAnalysis | null;
  last_analysis_at: string | null;
}

export interface AresContext {
  user_id: string;
  generated_at: string;
  score: AresScoreResult;
  kronos_available: boolean;
  prompt_text: string;
}

export interface AresAnalysisRequest {
  analysis_type?: 'weekly' | 'crisis' | 'progress';
}

// ─── Redesign: Habits / Projects / Calendar / Proposals ─────────────────────

export type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'selected_days' | 'custom';

export interface CustomRecurrenceRule {
  interval?: number;
  unit?: 'days' | 'weeks' | 'months';
  times_per?: number | null;
  per?: 'week' | 'month' | null;
}

export interface Habit {
  id: string;
  user_id: string;
  title: string;
  category: TaskCategory;
  priority: TaskPriority;
  recurrence_type: RecurrenceType;
  selected_days: number[] | null;
  monthly_day: number | null;
  custom_rule: CustomRecurrenceRule | null;
  is_active: boolean;
  start_date: string;
  end_date: string | null;
  estimated_minutes: number | null;
  is_regenerative: boolean;
  streak: number;
  longest_streak: number;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
  completed_today: boolean;
}

export interface HabitCreatePayload {
  title: string;
  category: TaskCategory;
  priority?: TaskPriority;
  recurrence_type?: RecurrenceType;
  selected_days?: number[] | null;
  monthly_day?: number | null;
  custom_rule?: CustomRecurrenceRule | null;
  start_date?: string;
  end_date?: string | null;
  estimated_minutes?: number | null;
  is_regenerative?: boolean;
  notes?: string | null;
}

export interface HabitUpdatePayload {
  title?: string;
  category?: TaskCategory;
  priority?: TaskPriority;
  recurrence_type?: RecurrenceType;
  selected_days?: number[] | null;
  monthly_day?: number | null;
  custom_rule?: CustomRecurrenceRule | null;
  start_date?: string;
  end_date?: string | null;
  estimated_minutes?: number | null;
  is_regenerative?: boolean;
  is_active?: boolean;
  notes?: string | null;
}

export interface HabitCompletionResult {
  habit: Habit;
  daily_task: Task;
  streak_updated: boolean;
  new_streak: number;
}

export type ProjectV2Status = 'active' | 'paused' | 'completed' | 'dropped' | 'archived' | 'on_hold';

export interface ProjectV2 {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: TaskCategory | null;
  status: ProjectV2Status;
  priority: TaskPriority;
  due_date: string | null;
  color: string;
  created_at: string;
  updated_at: string | null;
}

export interface ProjectV2CreatePayload {
  title: string;
  description?: string | null;
  category: TaskCategory;
  priority?: TaskPriority;
  due_date?: string | null;
  color?: string;
}

export interface ProjectV2UpdatePayload {
  title?: string;
  description?: string | null;
  category?: TaskCategory;
  priority?: TaskPriority;
  due_date?: string | null;
  color?: string;
  status?: ProjectV2Status;
}

export interface ProjectSection {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  position: number;
  created_at: string;
}

export interface ProjectTask {
  id: string;
  project_id: string;
  section_id: string | null;
  user_id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  completed_at: string | null;
  estimated_minutes: number | null;
  notes: string | null;
  position: number;
  created_at: string;
}

export interface ProjectSectionWithTasks extends ProjectSection {
  tasks: ProjectTask[];
}

export interface ProjectProgress {
  total_tasks: number;
  completed_tasks: number;
  completion_percentage: number;
  overdue_count: number;
}

export interface ProjectFull extends ProjectV2 {
  sections: ProjectSectionWithTasks[];
  progress: ProjectProgress;
}

export interface ProjectSectionCreatePayload {
  title: string;
  position?: number;
}

export interface ProjectTaskCreatePayload {
  title: string;
  section_id?: string | null;
  priority?: TaskPriority;
  due_date?: string | null;
  estimated_minutes?: number | null;
  notes?: string | null;
}

export interface ProjectTaskUpdatePayload {
  title?: string;
  section_id?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string | null;
  estimated_minutes?: number | null;
  notes?: string | null;
  position?: number;
}

export type ProposalType = 'task' | 'habit';
export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface AgentTaskProposal {
  id: string;
  user_id: string;
  agent_id: string;
  proposed_title: string;
  proposed_category: TaskCategory;
  proposed_date: string;
  proposed_priority: TaskPriority;
  proposed_type: ProposalType;
  reason: string;
  status: ProposalStatus;
  expires_at: string;
  created_at: string;
}

export interface ProposalApproveResult {
  proposal: AgentTaskProposal;
  kind: ProposalType;
  task_id: string | null;
  habit_id: string | null;
}

export type CalendarItemType = 'task' | 'habit_entry' | 'project_task';

export interface CalendarItem {
  id: string;
  type: CalendarItemType;
  title: string;
  category: TaskCategory | null;
  status: TaskStatus;
  priority: TaskPriority;
  scheduled_date: string;
  habit_id: string | null;
  project_id: string | null;
  project_title: string | null;
  project_task_id: string | null;
  agent_route: string;
  is_main_quest?: boolean;
}

export interface CalendarDay {
  date: string;
  items: CalendarItem[];
  proposals: AgentTaskProposal[];
  completion_rate: number;
}

export interface CalendarRange {
  start: string;
  end: string;
  days: CalendarDay[];
}

export interface ReorderRequest {
  ids: string[];
}

// Color tokens shared across Calendar / Habits / Projects.
export const CATEGORY_COLORS: Record<TaskCategory, { hex: string; bg: string; text: string; border: string }> = {
  health: { hex: '#10b981', bg: 'bg-green-500', text: 'text-green-500', border: 'border-green-500' },
  work: { hex: '#f59e0b', bg: 'bg-amber-500', text: 'text-amber-500', border: 'border-amber-500' },
  knowledge: { hex: '#3b82f6', bg: 'bg-blue-500', text: 'text-blue-500', border: 'border-blue-500' },
  relationships: { hex: '#f97316', bg: 'bg-orange-500', text: 'text-orange-500', border: 'border-orange-500' },
  other: { hex: '#64748b', bg: 'bg-slate-500', text: 'text-slate-500', border: 'border-slate-500' },
};

export const CATEGORY_LABELS_PL: Record<TaskCategory, string> = {
  health: 'Zdrowie & fizyczność',
  work: 'Praca & finanse',
  knowledge: 'Wiedza & rozwój',
  relationships: 'Relacje & społeczność',
  other: 'Inne',
};

export const ISO_DOW_LABELS_PL: Record<number, string> = {
  1: 'Pon',
  2: 'Wt',
  3: 'Śr',
  4: 'Czw',
  5: 'Pt',
  6: 'Sob',
  7: 'Nd',
};

// ─── Daily System (migration 009) ──────────────────────────────────────────

export type BoostType =
  | 'coffee'
  | 'power_nap'
  | 'nap'
  | 'walk'
  | 'water'
  | 'meditation';

export interface DailyLog {
  id: string;
  date: string;
  sleep_score: number;
  energy_score: number;
  stamina_pool: number;
  notes: string | null;
  created_at: string;
}

export interface TaskAPItem {
  task_id: string;
  title: string;
  ap_cost: number;
  is_completed: boolean;
  is_regenerative: boolean;
}

export interface StaminaStatus {
  date: string;
  base_pool: number;
  boosts_total: number;
  ap_used: number;
  ap_restored: number;
  ap_available: number;
  percentage: number;
  tasks_breakdown: TaskAPItem[];
  is_initialized: boolean;
}

export interface BoostAvailability {
  boost_type: BoostType;
  label: string;
  ap_restored: number;
  is_available: boolean;
  cooldown_remaining_min: number | null;
  uses_today: number;
  max_per_day: number | null;
}

export interface BoostResult {
  boost_type: BoostType;
  ap_restored: number;
  new_ap_available: number;
  cooldown_until: string;
}

export interface DailyLogPayload {
  sleep_score: number;
  energy_score: number;
  notes?: string | null;
}
