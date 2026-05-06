import { useCallback, useEffect, useState } from 'react';

import { dailySystemApi } from '../api/dailySystem';
import type { DailyLog } from '../types';

interface UseDailyInit {
  log: DailyLog | null;
  isLoading: boolean;
  error: string | null;
  needsBriefing: boolean;
  refresh: () => Promise<void>;
  /** Mark as initialised optimistically (called by the briefing modal on submit). */
  setLog: (log: DailyLog) => void;
}

/**
 * Single source of truth for "has the user run their morning briefing yet?".
 *
 * Mounts once at the App level — consumers read `needsBriefing` to decide
 * whether to show the blocking `DailyBriefingModal`, and the modal calls
 * `setLog(...)` on successful submit so the rest of the app can react
 * without a network round-trip.
 */
export function useDailyInit(): UseDailyInit {
  const [log, setLogState] = useState<DailyLog | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await dailySystemApi.fetchToday();
      setLogState(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const setLog = useCallback((next: DailyLog) => {
    setLogState(next);
  }, []);

  return {
    log,
    isLoading,
    error,
    needsBriefing: !isLoading && log === null && error === null,
    refresh,
    setLog,
  };
}
