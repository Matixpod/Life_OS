import type { Task } from '../../types';

/**
 * Walks tasks in render order and finds the first index whose cumulative
 * AP cost exceeds `staminaPool`. Uses the priority-weighted `ap_cost`
 * (migration 013) when available so the line matches what the backend
 * actually drains; falls back to `estimated_minutes` otherwise.
 * Regenerative tasks are skipped (they restore AP, never push us closer
 * to the cutoff) and completed/skipped tasks are excluded (already
 * accounted for in `StaminaStatus.ap_used`).
 *
 * Returns -1 when the planned work fits inside the pool.
 */
export function computeCutoff(tasks: Task[], staminaPool: number): number {
  if (staminaPool <= 0) return -1;
  let cumulative = 0;
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    if (t.is_regenerative || t.status === 'done' || t.status === 'skipped') continue;
    const cost = t.ap_cost ?? t.estimated_minutes ?? 0;
    cumulative += cost;
    if (cumulative > staminaPool) return i;
  }
  return -1;
}
