import type { CalendarItem, DayPart } from '../../types';

export const DAY_PART_LABEL: Record<DayPart, string> = {
  morning: 'Rano',
  day: 'Dzień',
  evening: 'Wieczór',
};

export const DAY_PART_ORDER: DayPart[] = ['morning', 'day', 'evening'];

/**
 * Map a wall-clock time (HH:mm or HH:mm:ss) to the canonical day part.
 * Windows: 05:00–11:59 morning · 12:00–17:59 day · 18:00–04:59 evening.
 * Mirrors `_infer_day_part` in `backend/services/task_service.py`.
 */
export function inferDayPart(timeStr: string | null | undefined): DayPart | null {
  if (!timeStr) return null;
  const hour = Number(timeStr.slice(0, 2));
  if (Number.isNaN(hour)) return null;
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'day';
  return 'evening';
}

function dayPartRank(dp: DayPart | null | undefined): number {
  if (dp === 'morning') return 0;
  if (dp === 'day') return 1;
  if (dp === 'evening') return 2;
  return 3;
}

/**
 * Chronological sort within a single day:
 *   1. Day phase: Rano → Dzień → Wieczór → unphased
 *   2. Within phase: Główny Quest first
 *   3. Then timed tasks chronologically (by start_time HH:mm)
 *   4. Floating (no start_time) tasks last within the phase
 */
export function sortCalendarItems(items: CalendarItem[]): CalendarItem[] {
  return [...items].sort((a, b) => {
    const phaseDiff = dayPartRank(a.day_part) - dayPartRank(b.day_part);
    if (phaseDiff !== 0) return phaseDiff;

    const aQuest = a.is_main_quest ? 0 : 1;
    const bQuest = b.is_main_quest ? 0 : 1;
    if (aQuest !== bQuest) return aQuest - bQuest;

    const aTimed = a.start_time ? 0 : 1;
    const bTimed = b.start_time ? 0 : 1;
    if (aTimed !== bTimed) return aTimed - bTimed;

    if (a.start_time && b.start_time) {
      return a.start_time.localeCompare(b.start_time);
    }
    return 0;
  });
}
