import {
  electronIsOnline,
  electronPendingSyncCount,
  electronSyncNow,
  hasElectronBridge,
  onElectronConnectivityChange,
} from './electronBridge';
import { getAuthToken } from './authToken';

let online = typeof navigator !== 'undefined' ? navigator.onLine : true;
const listeners = new Set();
let syncInFlight = false;

function emit(next) {
  online = Boolean(next);
  listeners.forEach((listener) => listener(online));
}

export function getConnectivitySnapshot() {
  return online;
}

export async function refreshConnectivity() {
  const next = await electronIsOnline();
  emit(next);
  return next;
}

export function subscribeConnectivity(listener) {
  if (typeof listener !== 'function') {
    return () => {};
  }
  listeners.add(listener);
  listener(online);
  refreshConnectivity();
  const unsubscribeBridge = onElectronConnectivityChange((next) => {
    const wasOffline = !online;
    emit(next);
    if (next && wasOffline) {
      triggerBackgroundSync();
    }
  });
  return () => {
    listeners.delete(listener);
    unsubscribeBridge();
  };
}

export async function triggerBackgroundSync() {
  if (!hasElectronBridge() || syncInFlight || !online) {
    return null;
  }
  const token = getAuthToken();
  if (!token) {
    return null;
  }
  syncInFlight = true;
  try {
    return await electronSyncNow(token);
  } catch {
    return null;
  } finally {
    syncInFlight = false;
  }
}

export async function fetchPendingSyncCount() {
  if (!hasElectronBridge()) {
    return 0;
  }
  try {
    return await electronPendingSyncCount();
  } catch {
    return 0;
  }
}
