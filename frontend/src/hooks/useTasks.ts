import { useContext } from 'react';
import { tasksApi } from '../api/tasks';
import { TaskContext, type TaskContextValue } from '../context/taskContext';
import type {
  DailyTaskList,
  Task,
  TaskCompletionResult,
  TaskCreatePayload,
  TaskStatus,
  TaskUpdatePayload,
} from '../types';

/**
 * High-level Task System actions backed by `TaskContext`.
 *
 * Mutating actions apply an optimistic update to the today list before
 * hitting the API. On failure they re-fetch to restore truth, and bubble
 * the error to the caller (component decides how to surface it).
 *
 * Every successful mutation calls `refreshKronos()` so any mounted KRONOS
 * widget can re-fetch — Phase 5 of the system requires this side-effect.
 */

interface UseTasksApi extends TaskContextValue {
  createTask: (payload: TaskCreatePayload) => Promise<Task>;
  updateTask: (id: string, payload: TaskUpdatePayload) => Promise<Task>;
  completeTask: (id: string) => Promise<TaskCompletionResult>;
  uncompleteTask: (id: string) => Promise<Task>;
  skipTask: (id: string) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;
}

function patchTaskInDay(
  day: DailyTaskList | null,
  id: string,
  fn: (t: Task) => Task,
): DailyTaskList | null {
  if (!day) return day;
  const tasks = day.tasks.map((t) => (t.id === id ? fn(t) : t));
  return { ...day, tasks };
}

function removeTaskFromDay(
  day: DailyTaskList | null,
  id: string,
): DailyTaskList | null {
  if (!day) return day;
  return { ...day, tasks: day.tasks.filter((t) => t.id !== id) };
}

function setStatusOptimistic(status: TaskStatus) {
  return (t: Task): Task => ({
    ...t,
    status,
    completed_at: status === 'done' ? new Date().toISOString() : t.completed_at,
  });
}

export function useTasks(): UseTasksApi {
  const ctx = useContext(TaskContext);
  if (!ctx) {
    throw new Error('useTasks must be used inside <TaskProvider>');
  }

  const {
    patchToday,
    refreshToday,
    refreshKronos,
  } = ctx;

  const createTask = async (payload: TaskCreatePayload): Promise<Task> => {
    const task = await tasksApi.createTask(payload);
    await refreshToday();
    refreshKronos();
    return task;
  };

  const completeTask = async (id: string): Promise<TaskCompletionResult> => {
    patchToday((day) => patchTaskInDay(day, id, setStatusOptimistic('done')));
    try {
      const result = await tasksApi.completeTask(id);
      // Replace the optimistic row with the authoritative server row.
      patchToday((day) => patchTaskInDay(day, id, () => result.task));
      refreshKronos();
      return result;
    } catch (e) {
      await refreshToday();
      throw e;
    }
  };

  const uncompleteTask = async (id: string): Promise<Task> => {
    patchToday((day) =>
      patchTaskInDay(day, id, (t) => ({ ...t, status: 'todo', completed_at: null })),
    );
    try {
      const task = await tasksApi.uncompleteTask(id);
      patchToday((day) => patchTaskInDay(day, id, () => task));
      refreshKronos();
      return task;
    } catch (e) {
      await refreshToday();
      throw e;
    }
  };

  const skipTask = async (id: string): Promise<Task> => {
    patchToday((day) => patchTaskInDay(day, id, setStatusOptimistic('skipped')));
    try {
      const task = await tasksApi.skipTask(id);
      patchToday((day) => patchTaskInDay(day, id, () => task));
      refreshKronos();
      return task;
    } catch (e) {
      await refreshToday();
      throw e;
    }
  };

  const updateTask = async (id: string, payload: TaskUpdatePayload): Promise<Task> => {
    const task = await tasksApi.updateTask(id, payload);
    patchToday((day) => patchTaskInDay(day, id, () => task));
    refreshKronos();
    return task;
  };

  const deleteTask = async (id: string): Promise<void> => {
    // Soft delete on the server (status=skipped). Remove from the today list
    // optimistically so it disappears from view; if the call fails, refresh.
    patchToday((day) => removeTaskFromDay(day, id));
    try {
      await tasksApi.deleteTask(id);
      refreshKronos();
    } catch (e) {
      await refreshToday();
      throw e;
    }
  };

  return {
    ...ctx,
    createTask,
    updateTask,
    completeTask,
    uncompleteTask,
    skipTask,
    deleteTask,
  };
}
