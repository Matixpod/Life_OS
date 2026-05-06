import type {
  AIAvailableModels,
  AIHealthResponse,
  AIModelPreference,
  AIPreferencesResponse,
  AIProvider,
  AIProviderHealthStatus,
  AISetPreferencePayload,
} from '../types';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

async function readError(res: Response, method: string, path: string): Promise<string> {
  // FastAPI returns {"detail": "..."} on errors; surface that to the user
  // rather than a bare status code.
  let detail: string | null = null;
  try {
    const body = (await res.json()) as { detail?: unknown };
    if (typeof body?.detail === 'string') detail = body.detail;
    else if (body?.detail) detail = JSON.stringify(body.detail);
  } catch {
    try {
      detail = await res.text();
    } catch {
      detail = null;
    }
  }
  return `${method} ${path} → ${res.status}${detail ? `: ${detail}` : ''}`;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(await readError(res, 'GET', path));
  return (await res.json()) as T;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res, 'POST', path));
  return (await res.json()) as T;
}

export const aiSettingsApi = {
  getModels: (): Promise<AIAvailableModels> => get('/api/v1/ai/models'),
  getPreferences: (): Promise<AIPreferencesResponse> => get('/api/v1/ai/preferences'),
  setPreference: (
    agentId: string,
    payload: AISetPreferencePayload,
  ): Promise<AIModelPreference> =>
    post(`/api/v1/ai/preferences/${encodeURIComponent(agentId)}`, payload),
  getHealth: (): Promise<AIHealthResponse> => get('/api/v1/ai/health'),
  getProviderHealth: (provider: AIProvider): Promise<AIProviderHealthStatus> =>
    get(`/api/v1/ai/health/${provider}`),
};
