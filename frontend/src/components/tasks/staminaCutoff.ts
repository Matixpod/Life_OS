import type { Task } from '../../types';

/**
 * Walks tasks in render order and finds the first index whose cumulative
 * `estimated_minutes` consumption exceeds `staminaPool`. Regenerative
 * tasks are skipped (they restore AP, never push us closer to the
 * cutoff) and completed/skipped tasks are excluded (already accounted
 * for in `StaminaStatus.ap_used`).
 *
 * Returns -1 when the planned work fits inside the pool.
 */
export function computeCutoff(tasks: Task[], staminaPool: number): number {
  if (staminaPool <= 0) return -1;
  let cumulative = 0;
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    if (t.is_regenerative || t.status === 'done' || t.status === 'skipped') continue;
    const minutes = t.estimated_minutes ?? 0;
    cumulative += minutes;
    if (cumulative > staminaPool) return i;
  }
  return -1;
}
