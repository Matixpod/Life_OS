import type {
  CognitiveChallenge,
  CreateProjectPayload,
  CreateTaskPayload,
  DailyIntelligence,
  DailyPlan,
  DailySummary,
  DailyTask,
  DailyTaskList,
  GoalsSummary,
  KronosAnalysis,
  KronosAnalysisRequest,
  KronosDashboard,
  LifeArea,
  PeriodicReview,
  PostponePayload,
  Project,
  ProjectStatus,
  SleepLogPayload,
  StreakInfo,
  Task,
  TaskCompletionResult,
  TaskCreatePayload,
  TaskListFilters,
  TaskUpdatePayload,
  UserProfile,
  WeeklyTaskList,
} from '../types';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return (await res.json()) as T;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`);
  return (await res.json()) as T;
}

async function putJson<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`PUT ${path} → ${res.status}`);
  return (await res.json()) as T;
}

async function deleteJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`DELETE ${path} → ${res.status}`);
  return (await res.json()) as T;
}

async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${path} → ${res.status}`);
  return (await res.json()) as T;
}

async function deleteVoid(path: string): Promise<void> {
  const res = await fetch(`${BASE_URL}${path}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`DELETE ${path} → ${res.status}`);
}

function tasksQuery(filters: TaskListFilters): string {
  const p = new URLSearchParams();
  if (filters.date) p.set('date', filters.date);
  if (filters.category) p.set('category', filters.category);
  if (filters.status) p.set('status', filters.status);
  if (filters.limit !== undefined) p.set('limit', String(filters.limit));
  if (filters.offset !== undefined) p.set('offset', String(filters.offset));
  const q = p.toString();
  return q ? `?${q}` : '';
}

export const api = {
  health: () => getJson<{ status: string; version: string; timestamp: string }>('/health'),
  getUserProfile: () => getJson<UserProfile>('/api/v1/user/profile'),
  getStreak: () => getJson<StreakInfo>('/api/v1/user/streak'),

  getDailySummary: (date?: string) => {
    const q = date ? `?date=${date}` : '';
    return getJson<DailySummary>(`/api/v1/dashboard/daily-summary${q}`);
  },

  logSleep: (payload: SleepLogPayload) =>
    postJson<{ success: boolean; data: unknown }>('/api/v1/sleep/log', payload),

  getCognitiveToday: () => getJson<CognitiveChallenge | null>('/api/v1/cognitive/today'),
  completeCognitive: (payload: { date: string; time_spent_seconds: number; ai_help_used: boolean }) =>
    postJson<{ success: boolean; data: unknown }>('/api/v1/cognitive/complete', payload),

  /** Streaming explanation; returns Response for the caller to read body. */
  explainCognitive: async (challenge_title: string, user_question: string): Promise<Response> => {
    const res = await fetch(`${BASE_URL}/api/v1/cognitive/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challenge_title, user_question }),
    });
    if (!res.ok || !res.body) throw new Error(`POST /cognitive/explain → ${res.status}`);
    return res;
  },

  getIntelligence: () => getJson<DailyIntelligence>('/api/v1/intelligence/today'),

  generateReview: (type: 'weekly' | 'monthly' = 'weekly') =>
    postJson<PeriodicReview>('/api/v1/review/generate', { type }),
  listReviews: (type?: 'weekly' | 'monthly') => {
    const q = type ? `?type=${type}` : '';
    return getJson<PeriodicReview[]>(`/api/v1/review/list${q}`);
  },

  // ─── Goals module ──────────────────────────────────────────────────────
  getLifeAreas: () => getJson<LifeArea[]>('/api/v1/goals/areas'),

  getProjects: (status?: ProjectStatus) => {
    const q = status ? `?status=${status}` : '';
    return getJson<Project[]>(`/api/v1/goals/projects${q}`);
  },
  createProject: (payload: CreateProjectPayload) =>
    postJson<Project>('/api/v1/goals/projects', payload),
  updateProject: (id: string, payload: Partial<CreateProjectPayload> & { progress_pct?: number }) =>
    putJson<Project>(`/api/v1/goals/projects/${id}`, payload),
  getStalledProjects: () =>
    getJson<Project[]>('/api/v1/goals/projects/stalled'),

  getTasks: (date?: string) => {
    const q = date ? `?date=${date}` : '';
    return getJson<DailyTask[]>(`/api/v1/goals/tasks${q}`);
  },
  createTask: (payload: CreateTaskPayload) =>
    postJson<DailyTask>('/api/v1/goals/tasks', payload),
  completeTask: (id: string) =>
    putJson<DailyTask>(`/api/v1/goals/tasks/${id}/complete`),
  postponeTask: (id: string, payload: PostponePayload) =>
    putJson<DailyTask>(`/api/v1/goals/tasks/${id}/postpone`, payload),
  deleteTask: (id: string) =>
    deleteJson<{ success: boolean }>(`/api/v1/goals/tasks/${id}`),

  getPlan: (date?: string) => {
    const q = date ? `?date=${date}` : '';
    return getJson<DailyPlan | null>(`/api/v1/goals/plan${q}`);
  },
  generatePlan: (date?: string, force_regenerate = false) =>
    postJson<DailyPlan>('/api/v1/goals/plan/generate', { date, force_regenerate }),

  getGoalsSummary: (date?: string) => {
    const q = date ? `?date=${date}` : '';
    return getJson<GoalsSummary>(`/api/v1/goals/summary${q}`);
  },

  // ─── KRONOS ────────────────────────────────────────────────────────────
  getKronosDashboard: () => getJson<KronosDashboard>('/api/v1/kronos/dashboard'),
  getKronosHistory: (limit = 20) =>
    getJson<KronosAnalysis[]>(`/api/v1/kronos/analysis/history?limit=${limit}`),

  /** Open an SSE stream of KRONOS analysis. Caller reads the body. */
  streamKronosAnalysis: async (payload: KronosAnalysisRequest = {}): Promise<Response> => {
    const res = await fetch(`${BASE_URL}/api/v1/kronos/analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok || !res.body) throw new Error(`POST /kronos/analysis → ${res.status}`);
    return res;
  },

  // ─── Task System ────────────────────────────────────────────────────────
  // Distinct from the goals-module `getTasks` above — these hit /api/v1/tasks/*
  // and serve the KRONOS-aware Task System surface.
  getTodayTasks: () => getJson<DailyTaskList>('/api/v1/tasks/today'),
  getWeekTasks: (weekStart?: string) => {
    const q = weekStart ? `?week_start=${weekStart}` : '';
    return getJson<WeeklyTaskList>(`/api/v1/tasks/week${q}`);
  },
  getBacklogTasks: () => getJson<Task[]>('/api/v1/tasks/backlog'),
  listTasksFiltered: (filters: TaskListFilters = {}) =>
    getJson<Task[]>(`/api/v1/tasks${tasksQuery(filters)}`),
  createTaskV2: (payload: TaskCreatePayload) => postJson<Task>('/api/v1/tasks', payload),
  updateTaskV2: (id: string, payload: TaskUpdatePayload) =>
    patchJson<Task>(`/api/v1/tasks/${id}`, payload),
  deleteTaskV2: (id: string) => deleteVoid(`/api/v1/tasks/${id}`),
  completeTaskV2: (id: string) =>
    postJson<TaskCompletionResult>(`/api/v1/tasks/${id}/complete`, {}),
  uncompleteTaskV2: (id: string) =>
    postJson<Task>(`/api/v1/tasks/${id}/uncomplete`, {}),
  skipTaskV2: (id: string) => postJson<Task>(`/api/v1/tasks/${id}/skip`, {}),
};
