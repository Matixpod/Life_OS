import type {
  BoostAvailability,
  BoostResult,
  BoostType,
  DailyLog,
  DailyLogPayload,
  StaminaStatus,
} from '../types';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

/**
 * Error thrown when a boost is requested while still on cooldown or after
 * its daily cap. The router replies with a structured 429 — the FE can
 * inspect `kind` to render the right disabled state.
 */
export class BoostUnavailableError extends Error {
  readonly kind: 'cooldown' | 'max_reached';
  readonly boostType: BoostType;
  readonly cooldownRemainingMin?: number;
  readonly maxPerDay?: number;

  constructor(detail: {
    error: 'cooldown' | 'max_reached';
    boost_type: BoostType;
    cooldown_remaining_min?: number;
    max_per_day?: number;
  }) {
    super(`Boost ${detail.boost_type} unavailable: ${detail.error}`);
    this.kind = detail.error;
    this.boostType = detail.boost_type;
    this.cooldownRemainingMin = detail.cooldown_remaining_min;
    this.maxPerDay = detail.max_per_day;
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return (await res.json()) as T;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    if (res.status === 429) {
      const data = (await res.json()) as { detail: unknown };
      const detail = data.detail as {
        error: 'cooldown' | 'max_reached';
        boost_type: BoostType;
        cooldown_remaining_min?: number;
        max_per_day?: number;
      };
      throw new BoostUnavailableError(detail);
    }
    throw new Error(`POST ${path} → ${res.status}`);
  }
  return (await res.json()) as T;
}

export const dailySystemApi = {
  /** Today's daily log; null if the user hasn't initialised the day yet. */
  fetchToday: (): Promise<DailyLog | null> => get('/api/v1/daily/log'),

  fetchByDate: (date: string): Promise<DailyLog | null> =>
    get(`/api/v1/daily/log/${date}`),

  /** Submit / overwrite today's morning briefing. */
  createLog: (payload: DailyLogPayload): Promise<DailyLog> =>
    post('/api/v1/daily/log', payload),

  fetchStamina: (): Promise<StaminaStatus> => get('/api/v1/daily/stamina'),

  fetchBoosts: (): Promise<BoostAvailability[]> => get('/api/v1/daily/boosts'),

  /** Use a boost. Throws `BoostUnavailableError` on a 429 response. */
  useBoost: (type: BoostType): Promise<BoostResult> =>
    post(`/api/v1/daily/boosts/${type}`),

  fetchHistory: (): Promise<DailyLog[]> => get('/api/v1/daily/history'),
};
