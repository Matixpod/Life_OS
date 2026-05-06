import type {
  Habit,
  HabitCompletionResult,
  HabitCreatePayload,
  HabitUpdatePayload,
  Task,
} from '../types';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

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
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`);
  return (await res.json()) as T;
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${path} → ${res.status}`);
  return (await res.json()) as T;
}

async function del(path: string): Promise<void> {
  const res = await fetch(`${BASE_URL}${path}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`DELETE ${path} → ${res.status}`);
}

export const habitsApi = {
  list: (includeInactive = false): Promise<Habit[]> =>
    get<Habit[]>(`/api/v1/habits${includeInactive ? '?include_inactive=true' : ''}`),
  create: (payload: HabitCreatePayload): Promise<Habit> => post('/api/v1/habits', payload),
  update: (id: string, payload: HabitUpdatePayload): Promise<Habit> =>
    patch(`/api/v1/habits/${id}`, payload),
  remove: (id: string): Promise<void> => del(`/api/v1/habits/${id}`),
  completeToday: (id: string): Promise<HabitCompletionResult> =>
    post(`/api/v1/habits/${id}/complete`),
  uncompleteToday: (id: string): Promise<HabitCompletionResult> =>
    post(`/api/v1/habits/${id}/uncomplete`),
  completeEntry: (dailyTaskId: string): Promise<HabitCompletionResult> =>
    post(`/api/v1/habits/entries/${dailyTaskId}/complete`),
  uncompleteEntry: (dailyTaskId: string): Promise<HabitCompletionResult> =>
    post(`/api/v1/habits/entries/${dailyTaskId}/uncomplete`),
  entriesFor: (date: string): Promise<Task[]> => get(`/api/v1/habits/entries/${date}`),
};
