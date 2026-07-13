import { useCallback, useEffect, useState } from 'react';
import {
  fetchPendingSyncCount,
  getConnectivitySnapshot,
  subscribeConnectivity,
  triggerBackgroundSync,
} from '../lib/connectivity';

export function useConnectivity() {
  const [isOnline, setIsOnline] = useState(getConnectivitySnapshot);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  const refreshPendingCount = useCallback(async () => {
    const count = await fetchPendingSyncCount();
    setPendingSyncCount(count);
  }, []);

  useEffect(() => {
    return subscribeConnectivity(setIsOnline);
  }, []);

  useEffect(() => {
    refreshPendingCount();
    const timer = setInterval(refreshPendingCount, 5000);
    return () => clearInterval(timer);
  }, [isOnline, refreshPendingCount]);

  const syncNow = useCallback(async () => {
    const result = await triggerBackgroundSync();
    await refreshPendingCount();
    return result;
  }, [refreshPendingCount]);

  return {
    isOnline,
    pendingSyncCount,
    refreshPendingCount,
    syncNow,
  };
}
