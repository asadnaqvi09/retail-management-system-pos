import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, Bell, LogOut, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../hooks/useAuth';
import { useSessionLock } from '../../context/SessionLockContext';
import { clearAuthToken } from '../../lib/authToken';
import { getErrorMessage } from '../../lib/errors';
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

export default function TopBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, logout, logoutState } = useAuth();
  const { lock } = useSessionLock();

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
      <div className="relative max-w-sm flex-1">
        <Search
          size={15}
          strokeWidth={1.75}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          placeholder={t('topbar.searchPlaceholder')}
          className="h-8 w-full rounded-lg border border-transparent bg-[#f4f4f8] pl-8 pr-3 text-[13px] placeholder-[#a0a0b0] outline-none transition-all focus:border-primary focus:bg-white"
        />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <ConnectivityStatus />
        <button
          type="button"
          onClick={handleLock}
          title={t('sessionLock.lock')}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-[#f4f4f8] hover:text-primary"
        >
          <Lock size={17} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-[#f4f4f8] hover:text-primary"
        >
          <Bell size={17} strokeWidth={1.75} />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full border border-white bg-primary" />
        </button>
        <div className="flex items-center gap-1 rounded-lg px-1 py-1 hover:bg-[#f4f4f8]">
          <div className="flex items-center gap-2 px-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-white">
              {getInitials(user?.name)}
            </div>
            <span className="max-w-[120px] truncate text-[13px] font-medium">{user?.name}</span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={logoutState.isLoading}
            title={t('auth.logout')}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-white hover:text-danger disabled:opacity-50"
          >
            <LogOut size={16} strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </header>
  );
}
