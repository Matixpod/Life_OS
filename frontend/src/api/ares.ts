import type {
  AresAnalysis,
  AresAnalysisRequest,
  AresContext,
  AresDashboard,
  AresScoreHistoryPoint,
  AresScoreResult,
} from '../types';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return (await res.json()) as T;
}

export const aresApi = {
  getDashboard: (): Promise<AresDashboard> => get('/api/v1/ares/dashboard'),
  getScore: (): Promise<AresScoreResult> => get('/api/v1/ares/score'),
  getScoreHistory: (days = 14): Promise<{ history: AresScoreHistoryPoint[] }> =>
    get(`/api/v1/ares/score/history?days=${days}`),
  getContext: (): Promise<AresContext> => get('/api/v1/ares/context'),
  getAnalysisHistory: (limit = 20): Promise<AresAnalysis[]> =>
    get(`/api/v1/ares/analysis/history?limit=${limit}`),

  streamAnalysis: async (
    payload: AresAnalysisRequest = {},
  ): Promise<Response> => {
    const res = await fetch(`${BASE_URL}/api/v1/ares/analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok || !res.body) throw new Error(`POST /ares/analysis → ${res.status}`);
    return res;
  },
};
