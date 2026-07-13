import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Lock, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import Button from '../../atoms/Button';
import Input from '../../atoms/Input';
import { useSessionLock } from '../../context/SessionLockContext';
import { useAuth } from '../../hooks/useAuth';
import { clearAuthToken } from '../../lib/authToken';
import { getErrorMessage } from '../../lib/errors';
import { cn } from '../../lib/utils';
import { baseApi } from '../../store/baseApi';
import { store } from '../../store';

function getInitials(name) {
  if (!name) {
    return '?';
  }
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function SessionLockOverlay() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, role, logout, logoutState } = useAuth();
  const { isLocked, unlock, isUnlocking } = useSessionLock();
  const [unlockMode, setUnlockMode] = useState('pin');
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [shake, setShake] = useState(false);
  const pinInputRef = useRef(null);
  const passwordInputRef = useRef(null);

  useEffect(() => {
    if (!isLocked) {
      setPin('');
      setPassword('');
      setFormError('');
      setUnlockMode('pin');
      return;
    }
    const timer = setTimeout(() => {
      if (unlockMode === 'password') {
        passwordInputRef.current?.focus();
        return;
      }
      pinInputRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [isLocked, unlockMode]);

  if (!isLocked || !user) {
    return null;
  }

  function showError(message) {
    setFormError(message);
    setShake(true);
    setTimeout(() => setShake(false), 450);
  }

  async function handleUnlock(event) {
    event.preventDefault();
    setFormError('');
    if (unlockMode === 'pin') {
      if (!pin) {
        showError(t('sessionLock.errors.pinRequired'));
        return;
      }
      try {
        await unlock({ pin });
        toast.success(t('sessionLock.unlocked'));
      } catch (error) {
        showError(getErrorMessage(error, t('sessionLock.errors.unlockFailed')));
      }
      return;
    }
    if (!password) {
      showError(t('sessionLock.errors.passwordRequired'));
      return;
    }
    try {
      await unlock({ password });
      toast.success(t('sessionLock.unlocked'));
    } catch (error) {
      showError(getErrorMessage(error, t('sessionLock.errors.unlockFailed')));
    }
  }

  async function handleSwitchUser() {
    try {
      await logout().unwrap();
      toast.success(t('auth.logoutSuccess'));
    } catch (error) {
      toast.error(getErrorMessage(error, t('auth.errors.logoutFailed')));
    } finally {
      clearAuthToken();
      store.dispatch(baseApi.util.resetApiState());
      navigate('/login', { replace: true });
    }
  }

  function switchUnlockMode(mode) {
    setUnlockMode(mode);
    setFormError('');
    setPin('');
    setPassword('');
  }

  return (
    <div
      data-session-lock-overlay
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-[#0f0f14]/55 p-4 backdrop-blur-sm"
    >
      <div
        className={cn(
          'w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-[0_24px_80px_rgba(15,15,20,0.18)]',
          shake && 'animate-[shake_0.45s_ease-in-out]'
        )}
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#eef2ff] text-primary">
            <Lock size={24} strokeWidth={1.75} />
          </div>
          <h2 className="text-[18px] font-semibold">{t('sessionLock.title')}</h2>
          <p className="mt-1 text-[13px] text-muted">{t('sessionLock.subtitle')}</p>
        </div>
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-border bg-[#f8f8fa] p-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-[12px] font-semibold text-white">
            {getInitials(user.name)}
          </div>
          <div className="min-w-0 text-left">
            <p className="truncate text-[14px] font-medium">{user.name}</p>
            <p className="text-[12px] text-muted">{role?.name}</p>
          </div>
        </div>
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-[#f4f4f8] p-1">
          <button
            type="button"
            onClick={() => switchUnlockMode('pin')}
            className={cn(
              'rounded-md py-2 text-[13px] font-medium transition-colors',
              unlockMode === 'pin'
                ? 'bg-white text-foreground shadow-sm'
                : 'text-muted hover:text-foreground'
            )}
          >
            {t('sessionLock.pinMode')}
          </button>
          <button
            type="button"
            onClick={() => switchUnlockMode('password')}
            className={cn(
              'rounded-md py-2 text-[13px] font-medium transition-colors',
              unlockMode === 'password'
                ? 'bg-white text-foreground shadow-sm'
                : 'text-muted hover:text-foreground'
            )}
          >
            {t('sessionLock.passwordMode')}
          </button>
        </div>
        <form onSubmit={handleUnlock} className="space-y-4">
          {unlockMode === 'pin' ? (
            <div>
              <label htmlFor="session-lock-pin" className="mb-1.5 block text-[13px] font-medium">
                {t('sessionLock.pin')}
              </label>
              <Input
                ref={pinInputRef}
                id="session-lock-pin"
                name="pin"
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder={t('sessionLock.pinPlaceholder')}
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))}
                error={Boolean(formError)}
                disabled={isUnlocking}
              />
            </div>
          ) : (
            <div>
              <label htmlFor="session-lock-password" className="mb-1.5 block text-[13px] font-medium">
                {t('sessionLock.password')}
              </label>
              <Input
                ref={passwordInputRef}
                id="session-lock-password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder={t('sessionLock.passwordPlaceholder')}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                error={Boolean(formError)}
                disabled={isUnlocking}
              />
            </div>
          )}
          {formError ? (
            <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[13px] text-danger">
              {formError}
            </div>
          ) : null}
          <Button type="submit" className="w-full" size="lg" disabled={isUnlocking}>
            {isUnlocking ? t('sessionLock.unlocking') : t('sessionLock.unlock')}
          </Button>
        </form>
        <div className="mt-4 border-t border-border pt-4">
          <button
            type="button"
            onClick={handleSwitchUser}
            disabled={logoutState.isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:bg-[#f4f4f8] hover:text-foreground disabled:opacity-50"
          >
            <LogOut size={15} strokeWidth={1.75} />
            {logoutState.isLoading ? t('sessionLock.switchingUser') : t('sessionLock.switchUser')}
          </button>
        </div>
      </div>
    </div>
  );
}
