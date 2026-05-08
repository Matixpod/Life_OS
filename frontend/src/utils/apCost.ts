import type { TaskPriority } from '../types';

const PRIORITY_MULTIPLIER: Record<TaskPriority, number> = {
  high: 1.5,
  medium: 1.0,
  low: 0.7,
};

export function previewApCost(
  minutes: number,
  priority: TaskPriority,
  isRegenerative: boolean,
): number {
  if (minutes <= 0) return 0;
  if (isRegenerative) return minutes;
  return Math.max(1, Math.round(minutes * PRIORITY_MULTIPLIER[priority]));
}
