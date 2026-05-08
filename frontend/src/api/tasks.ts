import { api } from '../services/api';
import type {
  DailyTaskList,
  Task,
  TaskCompletionResult,
  TaskCreatePayload,
  TaskListFilters,
  TaskUpdatePayload,
  WeeklyTaskList,
  WorkoutCompleteMeta,
} from '../types';

/**
 * Typed Task System API client.
 *
 * Mirrors the `kronosApi` pattern — a thin wrapper around `services/api.ts`
 * so consumers can import a single namespaced object instead of remembering
 * which `api.*` method serves which surface.
 *
 * Method names follow the Phase 6 CHECKLIST exactly (`fetchTodayTasks`,
 * `completeTask`, ...). The underlying `api.*Task*V2` methods carry the
 * `V2` suffix to avoid colliding with the legacy goals-module `getTasks` /
 * `createTask` / `completeTask` / `deleteTask` already exported there.
 */
export const tasksApi = {
  fetchTodayTasks: (): Promise<DailyTaskList> => api.getTodayTasks(),
  fetchWeekTasks: (weekStart?: string): Promise<WeeklyTaskList> =>
    api.getWeekTasks(weekStart),
  fetchBacklog: (): Promise<Task[]> => api.getBacklogTasks(),
  listTasks: (filters: TaskListFilters = {}): Promise<Task[]> =>
    api.listTasksFiltered(filters),

  createTask: (payload: TaskCreatePayload): Promise<Task> => api.createTaskV2(payload),
  updateTask: (id: string, payload: TaskUpdatePayload): Promise<Task> =>
    api.updateTaskV2(id, payload),
  deleteTask: (id: string): Promise<void> => api.deleteTaskV2(id),
  completeTask: (
    id: string,
    meta?: WorkoutCompleteMeta,
  ): Promise<TaskCompletionResult> => api.completeTaskV2(id, meta),
  uncompleteTask: (id: string): Promise<Task> => api.uncompleteTaskV2(id),
  skipTask: (id: string): Promise<Task> => api.skipTaskV2(id),
};
