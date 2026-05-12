import type {
  CardioProfile,
  CardioSession,
  CardioSessionCreate,
  ChatMessage,
  Exercise,
  ExerciseSet,
  FatSummary,
  GymSession,
  ParsedExercise,
  RecoveryMap,
  SessionCreate,
  SessionUpdatePayload,
  WeeklyReport,
  WorkoutTemplate,
  WorkoutTemplateCreatePayload,
  WorkoutTemplateUpdatePayload,
} from '../types/prometheus';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
const ROOT = '/api/v1/prometheus';
const TEMPLATES_ROOT = '/api/v1/workout-templates';

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

async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${path} → ${res.status}`);
  return (await res.json()) as T;
}

async function putJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT ${path} → ${res.status}`);
  return (await res.json()) as T;
}

async function delVoid(path: string): Promise<void> {
  const res = await fetch(`${BASE_URL}${path}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`DELETE ${path} → ${res.status}`);
}

async function postSSE(path: string, body: unknown): Promise<Response> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) throw new Error(`POST ${path} → ${res.status}`);
  return res;
}

export interface SSEChatEvent {
  chunk?: string;
  done?: boolean;
  error?: string;
}

export interface SSEReportEvent {
  chunk?: string;
  done?: boolean;
  report?: Omit<WeeklyReport, 'week_start'>;
  week_start?: string;
  error?: string;
}

export async function* readSSE<T>(res: Response): AsyncGenerator<T> {
  const reader = res.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';
    for (const block of parts) {
      const line = block.split('\n').find((l) => l.startsWith('data: '));
      if (!line) continue;
      try {
        yield JSON.parse(line.slice(6)) as T;
      } catch {
        /* ignore malformed */
      }
    }
  }
}

export const prometheusApi = {
  getExercises: (search?: string): Promise<Exercise[]> =>
    getJson<Exercise[]>(`${ROOT}/exercises${search ? `?search=${encodeURIComponent(search)}` : ''}`),

  parseExercise: (text: string): Promise<ParsedExercise> =>
    postJson<ParsedExercise>(`${ROOT}/exercises/parse`, { text }),

  createSession: (payload: SessionCreate): Promise<GymSession> =>
    postJson<GymSession>(`${ROOT}/sessions`, payload),

  getSessions: (daysBack = 30): Promise<GymSession[]> =>
    getJson<GymSession[]>(`${ROOT}/sessions?days_back=${daysBack}`),

  getRecovery: (): Promise<RecoveryMap> =>
    getJson<RecoveryMap>(`${ROOT}/recovery`),

  chatStream: (messages: ChatMessage[]): Promise<Response> =>
    postSSE(`${ROOT}/chat`, { messages }),

  getReport: (weekStart: string): Promise<WeeklyReport | null> =>
    getJson<WeeklyReport | null>(`${ROOT}/report?week_start=${weekStart}`),

  generateReport: (weekStart: string): Promise<Response> =>
    postSSE(`${ROOT}/report/generate?week_start=${weekStart}`, {}),

  deleteExercise: (id: string): Promise<void> =>
    delVoid(`${ROOT}/exercises/${id}`),

  getLastSets: (exerciseId: string): Promise<{ sets: ExerciseSet[] }> =>
    getJson<{ sets: ExerciseSet[] }>(`${ROOT}/exercises/${exerciseId}/last-sets`),

  deleteSession: (id: string): Promise<void> =>
    delVoid(`${ROOT}/sessions/${id}`),

  updateSession: (id: string, payload: SessionUpdatePayload): Promise<GymSession> =>
    patchJson<GymSession>(`${ROOT}/sessions/${id}`, payload),

  // ─── Cardio ──────────────────────────────────────────────────────────
  getCardioProfile: async (): Promise<CardioProfile | null> => {
    const res = await fetch(`${BASE_URL}${ROOT}/cardio/profile`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GET /cardio/profile → ${res.status}`);
    return (await res.json()) as CardioProfile;
  },

  upsertCardioProfile: (profile: CardioProfile): Promise<CardioProfile> =>
    putJson<CardioProfile>(`${ROOT}/cardio/profile`, profile),

  createCardioSession: (payload: CardioSessionCreate): Promise<CardioSession> =>
    postJson<CardioSession>(`${ROOT}/cardio/sessions`, payload),

  getCardioSessions: (daysBack = 90): Promise<CardioSession[]> =>
    getJson<CardioSession[]>(`${ROOT}/cardio/sessions?days_back=${daysBack}`),

  deleteCardioSession: (id: string): Promise<void> =>
    delVoid(`${ROOT}/cardio/sessions/${id}`),

  getCardioSummary: (): Promise<FatSummary> =>
    getJson<FatSummary>(`${ROOT}/cardio/summary`),
};

// ─── Workout templates ─────────────────────────────────────────────────────

interface DailyTaskRow {
  id: string;
  date: string;
  title: string;
  workout_template_id?: string | null;
  workout_template_label?: string | null;
  [key: string]: unknown;
}

export const workoutTemplatesApi = {
  list: (): Promise<WorkoutTemplate[]> =>
    getJson<WorkoutTemplate[]>(`${TEMPLATES_ROOT}`),

  get: (id: string): Promise<WorkoutTemplate> =>
    getJson<WorkoutTemplate>(`${TEMPLATES_ROOT}/${id}`),

  create: (payload: WorkoutTemplateCreatePayload): Promise<WorkoutTemplate> =>
    postJson<WorkoutTemplate>(`${TEMPLATES_ROOT}`, payload),

  update: (id: string, payload: WorkoutTemplateUpdatePayload): Promise<WorkoutTemplate> =>
    patchJson<WorkoutTemplate>(`${TEMPLATES_ROOT}/${id}`, payload),

  remove: (id: string): Promise<void> =>
    delVoid(`${TEMPLATES_ROOT}/${id}`),

  schedule: (id: string, dates: string[]): Promise<DailyTaskRow[]> =>
    postJson<DailyTaskRow[]>(`${TEMPLATES_ROOT}/${id}/schedule`, { dates }),

  startToday: (id: string): Promise<DailyTaskRow> =>
    postJson<DailyTaskRow>(`${TEMPLATES_ROOT}/${id}/start-today`, {}),
};
