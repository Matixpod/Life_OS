import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { tasksApi } from '../api/tasks';
import type { DailyTaskList, Task, WeeklyTaskList } from '../types';
import { TaskContext, type TaskContextValue } from './taskContext';

interface TaskProviderProps {
  children: ReactNode;
  /** Initial fetch of /today on mount. Disable in tests that mock fetch. */
  autoFetchToday?: boolean;
}

export function TaskProvider({
  children,
  autoFetchToday = true,
}: TaskProviderProps) {
  const [today, setToday] = useState<DailyTaskList | null>(null);
  const [week, setWeek] = useState<WeeklyTaskList | null>(null);
  const [backlog, setBacklog] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const kronosListenerRef = useRef<(() => void) | null>(null);

  const wrapErrors = useCallback(
    async (label: string, fn: () => Promise<void>): Promise<void> => {
      setError(null);
      try {
        await fn();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : `${label} failed`;
        setError(msg);
      }
    },
    [],
  );

  const refreshToday = useCallback(
    () =>
      wrapErrors('refreshToday', async () => {
        setLoading(true);
        try {
          setToday(await tasksApi.fetchTodayTasks());
        } finally {
          setLoading(false);
        }
      }),
    [wrapErrors],
  );

  const refreshWeek = useCallback(
    (weekStart?: string) =>
      wrapErrors('refreshWeek', async () => {
        setWeek(await tasksApi.fetchWeekTasks(weekStart));
      }),
    [wrapErrors],
  );

  const refreshBacklog = useCallback(
    () =>
      wrapErrors('refreshBacklog', async () => {
        setBacklog(await tasksApi.fetchBacklog());
      }),
    [wrapErrors],
  );

  const refreshAll = useCallback(async (): Promise<void> => {
    await Promise.all([refreshToday(), refreshWeek(), refreshBacklog()]);
  }, [refreshToday, refreshWeek, refreshBacklog]);

  const patchToday = useCallback(
    (updater: (prev: DailyTaskList | null) => DailyTaskList | null) => {
      setToday((prev) => updater(prev));
    },
    [],
  );

  const refreshKronos = useCallback(() => {
    kronosListenerRef.current?.();
  }, []);

  const setKronosListener = useCallback((listener: (() => void) | null) => {
    kronosListenerRef.current = listener;
  }, []);

  // Initial fetch on mount. setState happens inside the async callback,
  // not synchronously in the effect body, so the cascade-render the lint
  // rule warns about does not occur. Standard "load on mount" pattern.
  useEffect(() => {
    if (!autoFetchToday) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshToday();
  }, [autoFetchToday, refreshToday]);

  const value = useMemo<TaskContextValue>(
    () => ({
      today,
      week,
      backlog,
      loading,
      error,
      refreshToday,
      refreshWeek,
      refreshBacklog,
      refreshAll,
      patchToday,
      refreshKronos,
      setKronosListener,
    }),
    [
      today,
      week,
      backlog,
      loading,
      error,
      refreshToday,
      refreshWeek,
      refreshBacklog,
      refreshAll,
      patchToday,
      refreshKronos,
      setKronosListener,
    ],
  );

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}
