import { createContext } from 'react';
import type { DailyTaskList, Task, WeeklyTaskList } from '../types';

/**
 * Pure context object — kept in its own file so `TaskContext.tsx` only
 * exports React components (required by react-refresh).
 */

export interface TaskContextValue {
  today: DailyTaskList | null;
  week: WeeklyTaskList | null;
  backlog: Task[];
  loading: boolean;
  error: string | null;

  refreshToday: () => Promise<void>;
  refreshWeek: (weekStart?: string) => Promise<void>;
  refreshBacklog: () => Promise<void>;
  refreshAll: () => Promise<void>;

  patchToday: (updater: (prev: DailyTaskList | null) => DailyTaskList | null) => void;

  refreshKronos: () => void;
  setKronosListener: (listener: (() => void) | null) => void;
}

export const TaskContext = createContext<TaskContextValue | null>(null);
