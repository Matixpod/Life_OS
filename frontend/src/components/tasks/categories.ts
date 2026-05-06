import { Brain, Briefcase, Heart, Target, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { TaskCategory, TaskPriority } from '../../types';

/**
 * Shared metadata for the categories.
 */
export const CATEGORY_META: Record<
  TaskCategory,
  { label: string; icon: LucideIcon; color: string }
> = {
  health: { label: 'Zdrowie & fizyczność', icon: Heart, color: '#10b981' },
  work: { label: 'Praca & finanse', icon: Briefcase, color: '#f59e0b' },
  knowledge: { label: 'Wiedza & rozwój', icon: Brain, color: '#3b82f6' },
  relationships: { label: 'Relacje & społeczność', icon: Users, color: '#f97316' },
  other: { label: 'Inne', icon: Target, color: '#64748b' },
};

export const CATEGORIES: TaskCategory[] = [
  'health',
  'work',
  'knowledge',
  'relationships',
  'other',
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
