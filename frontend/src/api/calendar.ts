import type { CalendarDay, CalendarRange } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return (await res.json()) as T;
}

export const calendarApi = {
  day: (date: string): Promise<CalendarDay> => get(`/api/v1/calendar/${date}`),
  range: (start: string, end: string): Promise<CalendarRange> =>
    get(`/api/v1/calendar/range?start=${start}&end=${end}`),
};
