import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

interface FocusItem {
  id: string;
  type?: string;
}

/**
 * Reads `location.state.focusItemId` set by Calendar navigation.
 * Returns it once and clears it on navigation, so re-mounts won't re-flash.
 */
export function useFocusItem(): FocusItem | null {
  const location = useLocation();
  const [item, setItem] = useState<FocusItem | null>(null);

  useEffect(() => {
    const state = location.state as { focusItemId?: string; itemType?: string } | null;
    if (state?.focusItemId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItem({ id: state.focusItemId, type: state.itemType });
      // Clear so a back/forward to this URL doesn't re-trigger the highlight.
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  return item;
}
