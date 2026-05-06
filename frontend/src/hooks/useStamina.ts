import { useCallback, useEffect, useState } from 'react';

import { dailySystemApi } from '../api/dailySystem';
import type { BoostAvailability, StaminaStatus } from '../types';

interface UseStamina {
  status: StaminaStatus | null;
  boosts: BoostAvailability[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Combined fetch for the StaminaBar + StaminaDetailsPanel.
 *
 * Both pieces of UI need the same two payloads (`/stamina` and `/boosts`),
 * and they update together (using a boost recomputes the stamina total).
 * Co-locating the fetches avoids drift between the bar and the panel.
 */
export function useStamina(): UseStamina {
  const [status, setStatus] = useState<StaminaStatus | null>(null);
  const [boosts, setBoosts] = useState<BoostAvailability[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [s, b] = await Promise.all([
        dailySystemApi.fetchStamina(),
        dailySystemApi.fetchBoosts(),
      ]);
      setStatus(s);
      setBoosts(b);
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

  return { status, boosts, isLoading, error, refresh };
}
