export function hasElectronBridge() {
  return typeof window !== 'undefined' && Boolean(window.electronAPI);
}

export async function electronIsOnline() {
  if (hasElectronBridge()) {
    return window.electronAPI.isOnline();
  }
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

export function onElectronConnectivityChange(callback) {
  if (hasElectronBridge() && typeof window.electronAPI.onConnectivityChange === 'function') {
    return window.electronAPI.onConnectivityChange(callback);
  }
  if (typeof window === 'undefined') {
    return () => {};
  }
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  callback(navigator.onLine);
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

export async function electronCacheGet(table, key) {
  if (!hasElectronBridge()) {
    return null;
  }
  return window.electronAPI.cacheGet(table, key);
}

export async function electronCacheSet(table, key, data) {
  if (!hasElectronBridge()) {
    return null;
  }
  return window.electronAPI.cacheSet(table, key, data);
}

export async function electronCacheQuery(table, query) {
  if (!hasElectronBridge()) {
    return null;
  }
  return window.electronAPI.cacheQuery(table, query || {});
}

export async function electronQueueWrite(entityType, operation, payload) {
  if (!hasElectronBridge()) {
    throw new Error('Offline queue is unavailable');
  }
  return window.electronAPI.queueWrite(entityType, operation, payload);
}

export async function electronSyncNow(token) {
  if (!hasElectronBridge()) {
    throw new Error('Sync is unavailable');
  }
  return window.electronAPI.syncNow(token);
}

export async function electronPullCache(token) {
  if (!hasElectronBridge()) {
    throw new Error('Cache pull is unavailable');
  }
  return window.electronAPI.pullCache(token);
}

export async function electronPendingSyncCount() {
  if (!hasElectronBridge()) {
    return 0;
  }
  return window.electronAPI.getPendingSyncCount();
}

export async function electronListHoldCartsLocal() {
  if (!hasElectronBridge()) {
    return [];
  }
  return window.electronAPI.listHoldCartsLocal();
}

export async function electronCreateHoldCartLocal(payload) {
  if (!hasElectronBridge()) {
    throw new Error('Offline hold carts are unavailable');
  }
  return window.electronAPI.createHoldCartLocal(payload);
}

export async function electronResumeHoldCartLocal(holdCartId) {
  if (!hasElectronBridge()) {
    throw new Error('Offline hold carts are unavailable');
  }
  return window.electronAPI.resumeHoldCartLocal(holdCartId);
}

export async function electronCancelHoldCartLocal(holdCartId) {
  if (!hasElectronBridge()) {
    throw new Error('Offline hold carts are unavailable');
  }
  return window.electronAPI.cancelHoldCartLocal(holdCartId);
}

export async function electronCreateLocalSale(payload) {
  if (!hasElectronBridge()) {
    throw new Error('Offline sales are unavailable');
  }
  return window.electronAPI.createLocalSale(payload);
}

export async function electronGetLocalInvoicePdf(localSaleId, format) {
  if (!hasElectronBridge()) {
    throw new Error('Offline invoices are unavailable');
  }
  return window.electronAPI.getLocalInvoicePdf(localSaleId, format);
}
