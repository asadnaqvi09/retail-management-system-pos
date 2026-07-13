import { useTranslation } from 'react-i18next';
import { CloudOff, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useConnectivity } from '../../hooks/useConnectivity';

export default function ConnectivityStatus({ className }) {
  const { t } = useTranslation();
  const { isOnline, pendingSyncCount, syncNow } = useConnectivity();

  if (isOnline && pendingSyncCount === 0) {
    return null;
  }

  async function handleSyncClick() {
    if (!isOnline) {
      return;
    }
    await syncNow();
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-full border px-3 py-1',
        isOnline
          ? 'border-[#fde68a] bg-[#fffbeb] text-[#92400e]'
          : 'border-[#fcd34d] bg-[#fff7ed] text-[#b45309]',
        className
      )}
    >
      <CloudOff size={13} strokeWidth={2} />
      <span className="text-[12px] font-medium">
        {isOnline ? t('connectivity.pendingSync', { count: pendingSyncCount }) : t('connectivity.offline')}
      </span>
      {pendingSyncCount > 0 ? (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#f59e0b] px-1.5 text-[10px] font-semibold text-white">
          {pendingSyncCount}
        </span>
      ) : null}
      {isOnline && pendingSyncCount > 0 ? (
        <button
          type="button"
          onClick={handleSyncClick}
          title={t('connectivity.syncNow')}
          className="flex h-5 w-5 items-center justify-center rounded-full text-[#92400e] transition-colors hover:bg-[#fde68a]"
        >
          <RefreshCw size={12} strokeWidth={2} />
        </button>
      ) : null}
    </div>
  );
}
