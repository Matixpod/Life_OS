import { Brain, Coins, Heart, Target, Users, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { TaskCategory, TaskPriority } from '../../types';

/**
 * Shared metadata for the 6 RPG categories. Identical color/icon mapping
 * to `kronos/StreakCard.tsx` — kept in sync by living in one place.
 */
export const CATEGORY_META: Record<
  TaskCategory,
  { label: string; icon: LucideIcon; color: string }
> = {
  vitality: { label: 'Vitality', icon: Heart, color: '#10b981' },
  intellect: { label: 'Intellect', icon: Brain, color: '#3b82f6' },
  discipline: { label: 'Discipline', icon: Target, color: '#f59e0b' },
  wealth: { label: 'Wealth', icon: Coins, color: '#eab308' },
  charisma: { label: 'Charisma', icon: Users, color: '#ec4899' },
  willpower: { label: 'Willpower', icon: Zap, color: '#a855f7' },
};

export const CATEGORIES: TaskCategory[] = [
  'vitality',
  'intellect',
  'discipline',
  'wealth',
  'charisma',
  'willpower',
];

/** Priority left-border colors per PROMPT spec. */
export const PRIORITY_BORDER: Record<TaskPriority, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#94a3b8',
};

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  high: 'H',
  medium: 'M',
  low: 'L',
};
