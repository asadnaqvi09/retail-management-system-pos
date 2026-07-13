import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, LogOut, Lock, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import Button from '../../atoms/Button';
import { useAuth } from '../../hooks/useAuth';
import { useSessionLock } from '../../context/SessionLockContext';
import { clearAuthToken } from '../../lib/authToken';
import { getErrorMessage } from '../../lib/errors';
import { cn } from '../../lib/utils';
import { baseApi } from '../../store/baseApi';
import { store } from '../../store';
import ConnectivityStatus from '../../molecules/ConnectivityStatus';

function getInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function POSNavbar({
  saleLabel,
  onHoldClick,
  canHoldCart,
  registerSession,
  currentUserId,
  onRegisterClick,
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, role, logout, logoutState } = useAuth();
  const { lock } = useSessionLock();
  const isRegisterOpen = registerSession?.status === 'open';
  const isOwner = registerSession?.user?.id === currentUserId;

  function handleLock() {
    lock();
    toast.message(t('sessionLock.locked'));
  }

  async function handleLogout() {
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

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-white px-5">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white">
          <ShoppingCart size={18} strokeWidth={2} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[15px] font-semibold">{t('pos.title')}</h1>
            {saleLabel ? (
              <span className="rounded-md bg-[#f4f4f8] px-2 py-0.5 text-[11px] font-medium text-muted">
                {saleLabel}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onRegisterClick}
        className={cn(
          'flex items-center gap-1.5 rounded-full border px-3 py-1 transition-colors',
          isRegisterOpen
            ? 'border-[#bbf7d0] bg-[#f0fdf4] hover:bg-[#dcfce7]'
            : 'border-[#fecaca] bg-[#fef2f2] hover:bg-[#fee2e2]'
        )}
      >
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            isRegisterOpen ? 'animate-pulse bg-success' : 'bg-danger'
          )}
        />
        <span
          className={cn(
            'text-[12px] font-medium',
            isRegisterOpen ? 'text-[#15803d]' : 'text-danger'
          )}
        >
          {isRegisterOpen
            ? isOwner
              ? t('topbar.registerOpen')
              : t('cashRegister.openByOther', { name: registerSession.user.name })
            : t('cashRegister.registerClosed')}
        </span>
      </button>
      <ConnectivityStatus />
      <div className="ml-auto flex items-center gap-3">
        {canHoldCart ? (
          <Button variant="outline" size="sm" onClick={onHoldClick}>
            {t('pos.holdCart')}
          </Button>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/')}
          className="gap-2 border-border"
        >
          <ArrowLeft size={15} />
          {t('pos.goToDashboard')}
        </Button>
        <div className="flex items-center gap-2 border-l border-border pl-3">
          <div className="text-right">
            <p className="text-[13px] font-medium leading-tight">{user?.name}</p>
            <p className="text-[11px] text-muted">{role?.name}</p>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-white">
            {getInitials(user?.name)}
          </div>
          <button
            type="button"
            onClick={handleLock}
            title={t('sessionLock.lock')}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-[#f4f4f8] hover:text-primary"
          >
            <Lock size={16} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={handleLogout}
            disabled={logoutState.isLoading}
            title={t('auth.logout')}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-[#f4f4f8] hover:text-danger disabled:opacity-50"
          >
            <LogOut size={16} strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </header>
  );
}
