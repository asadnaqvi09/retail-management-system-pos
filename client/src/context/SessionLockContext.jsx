import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useUnlockSessionMutation } from '../store/authApi';
import { useGetShortcutsQuery } from '../store/settingsApi';
import { buildShortcutMap, matchesKeyboardShortcut } from '../lib/keyboardShortcuts';

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'wheel'];

const SessionLockContext = createContext(null);

export function SessionLockProvider({ user, children }) {
  const [isLocked, setIsLocked] = useState(false);
  const [unlockSession, unlockState] = useUnlockSessionMutation();
  const { data: shortcuts = [] } = useGetShortcutsQuery(undefined, { skip: !user });
  const idleTimerRef = useRef(null);
  const isLockedRef = useRef(false);

  const lock = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    isLockedRef.current = true;
    setIsLocked(true);
  }, []);

  const resetIdleTimer = useCallback(() => {
    if (!user || isLockedRef.current) {
      return;
    }
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    idleTimerRef.current = setTimeout(() => {
      isLockedRef.current = true;
      setIsLocked(true);
    }, IDLE_TIMEOUT_MS);
  }, [user]);

  const unlock = useCallback(
    async (credentials) => {
      await unlockSession(credentials).unwrap();
      isLockedRef.current = false;
      setIsLocked(false);
      resetIdleTimer();
    },
    [unlockSession, resetIdleTimer]
  );

  useEffect(() => {
    isLockedRef.current = isLocked;
  }, [isLocked]);

  useEffect(() => {
    if (!isLocked) {
      return undefined;
    }
    function blockBackgroundKeys(event) {
      if (event.target.closest('[data-session-lock-overlay]')) {
        return;
      }
      event.stopPropagation();
      event.preventDefault();
    }
    window.addEventListener('keydown', blockBackgroundKeys, true);
    return () => window.removeEventListener('keydown', blockBackgroundKeys, true);
  }, [isLocked]);

  useEffect(() => {
    if (!user) {
      isLockedRef.current = false;
      setIsLocked(false);
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      return undefined;
    }
    resetIdleTimer();
    function handleActivity() {
      resetIdleTimer();
    }
    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, handleActivity, { passive: true });
    }
    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, handleActivity);
      }
    };
  }, [user, resetIdleTimer]);

  useEffect(() => {
    if (!user) {
      return undefined;
    }
    const shortcutMap = buildShortcutMap(shortcuts);
    const lockShortcut = shortcutMap.get('lock_session') || 'Ctrl+L';
    function onKeyDown(event) {
      if (matchesKeyboardShortcut(event, lockShortcut)) {
        event.preventDefault();
        lock();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [user, shortcuts, lock]);

  const value = useMemo(
    () => ({
      isLocked,
      lock,
      unlock,
      isUnlocking: unlockState.isLoading,
    }),
    [isLocked, lock, unlock, unlockState.isLoading]
  );

  return <SessionLockContext.Provider value={value}>{children}</SessionLockContext.Provider>;
}

export function useSessionLock() {
  const context = useContext(SessionLockContext);
  if (!context) {
    throw new Error('useSessionLock must be used within SessionLockProvider');
  }
  return context;
}
