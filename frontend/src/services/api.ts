import type {
  CognitiveChallenge,
  DailyIntelligence,
  DailySummary,
  PeriodicReview,
  SleepLogPayload,
  StreakInfo,
  UserProfile,
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
};
