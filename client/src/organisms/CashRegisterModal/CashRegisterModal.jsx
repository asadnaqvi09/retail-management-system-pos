import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Lock, Unlock } from 'lucide-react';
import { toast } from 'sonner';
import Button from '../../atoms/Button';
import Input from '../../atoms/Input';
import POSNumpad from '../../molecules/POSNumpad';
import { formatMoney } from '../../lib/format';
import { getErrorMessage } from '../../lib/errors';
import { cn } from '../../lib/utils';
import {
  useOpenSessionMutation,
  useCloseSessionMutation,
} from '../../store/cashRegisterApi';

export default function CashRegisterModal({
  open,
  onClose,
  session,
  currentUserId,
  canManage,
  onSessionChanged,
}) {
  const { t } = useTranslation();
  const [view, setView] = useState('open');
  const [openingInput, setOpeningInput] = useState('');
  const [closingInput, setClosingInput] = useState('');
  const [varianceNote, setVarianceNote] = useState('');
  const [openSession, { isLoading: isOpening }] = useOpenSessionMutation();
  const [closeSession, { isLoading: isClosing }] = useCloseSessionMutation();

  const isOwner = session?.user?.id === currentUserId;
  const isOpen = session?.status === 'open';
  const expectedClosing = useMemo(() => {
    if (!session) {
      return 0;
    }
    return Number(session.openingAmount) + Number(session.cashSalesTotal || 0);
  }, [session]);
  const previewVariance = useMemo(() => {
    const actual = Number(closingInput) || 0;
    return Math.round((actual - expectedClosing) * 100) / 100;
  }, [closingInput, expectedClosing]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (!session) {
      setView('open');
      setOpeningInput('');
      return;
    }
    if (isOpen && isOwner) {
      setView('active');
    } else if (isOpen) {
      setView('locked');
    } else {
      setView('open');
    }
    setClosingInput('');
    setVarianceNote('');
  }, [open, session, isOpen, isOwner]);

  if (!open) {
    return null;
  }

  async function handleOpenRegister() {
    const openingAmount = Number(openingInput) || 0;
    try {
      await openSession({ openingAmount }).unwrap();
      toast.success(t('cashRegister.openSuccess'));
      onSessionChanged?.();
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error, t('cashRegister.errors.openFailed')));
    }
  }

  async function handleCloseRegister() {
    if (!session?.id) {
      return;
    }
    try {
      await closeSession({
        id: session.id,
        body: {
          actualClosingAmount: Number(closingInput) || 0,
          varianceNote,
        },
      }).unwrap();
      toast.success(t('cashRegister.closeSuccess'));
      onSessionChanged?.();
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error, t('cashRegister.errors.closeFailed')));
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl text-white',
                isOpen ? 'bg-success' : 'bg-primary'
              )}
            >
              {isOpen ? <Unlock size={18} /> : <Lock size={18} />}
            </div>
            <div>
              <h2 className="text-[16px] font-semibold">{t('cashRegister.title')}</h2>
              <p className="text-[12px] text-muted">{t('cashRegister.subtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-[#f4f4f8]"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-5">
          {view === 'locked' ? (
            <div className="rounded-xl border border-warning/30 bg-[#fffbeb] px-4 py-5 text-[13px]">
              <p className="font-medium text-warning">{t('cashRegister.lockedTitle')}</p>
              <p className="mt-2 text-muted">
                {t('cashRegister.lockedSubtitle', { name: session?.user?.name })}
              </p>
            </div>
          ) : null}
          {view === 'open' ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-[#fafafa] px-4 py-3">
                <p className="text-[12px] text-muted">{t('cashRegister.openingAmount')}</p>
                <p className="mt-1 text-[28px] font-bold">{formatMoney(Number(openingInput) || 0)}</p>
              </div>
              <POSNumpad value={openingInput} onChange={setOpeningInput} disabled={!canManage || isOpening} />
            </div>
          ) : null}
          {view === 'active' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Stat label={t('cashRegister.openingAmount')} value={formatMoney(session.openingAmount)} />
                <Stat
                  label={t('cashRegister.transactions')}
                  value={String(session.totalTransactions)}
                />
                <Stat label={t('cashRegister.revenue')} value={formatMoney(session.totalRevenue)} />
                <Stat label={t('cashRegister.cashSales')} value={formatMoney(session.cashSalesTotal)} />
              </div>
              <div className="rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-[13px]">
                <p className="font-medium text-success">{t('cashRegister.sessionOpen')}</p>
                <p className="mt-1 text-muted">
                  {t('cashRegister.openedAt', {
                    time: new Date(session.openedAt).toLocaleString(),
                  })}
                </p>
              </div>
              <Button variant="outline" className="w-full" onClick={() => setView('close')}>
                {t('cashRegister.startClose')}
              </Button>
            </div>
          ) : null}
          {view === 'close' ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-[#fafafa] px-4 py-3">
                <p className="text-[12px] text-muted">{t('cashRegister.expectedClosing')}</p>
                <p className="mt-1 text-[22px] font-bold">{formatMoney(expectedClosing)}</p>
              </div>
              <div className="rounded-xl border border-border bg-white px-4 py-3">
                <p className="text-[12px] text-muted">{t('cashRegister.actualClosing')}</p>
                <p className="mt-1 text-[28px] font-bold">{formatMoney(Number(closingInput) || 0)}</p>
                <p
                  className={cn(
                    'mt-2 text-[13px] font-medium',
                    previewVariance === 0
                      ? 'text-success'
                      : previewVariance > 0
                        ? 'text-primary'
                        : 'text-danger'
                  )}
                >
                  {t('cashRegister.variance')}: {formatMoney(previewVariance)}
                </p>
              </div>
              <POSNumpad value={closingInput} onChange={setClosingInput} disabled={isClosing} />
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-muted">
                  {t('cashRegister.varianceNote')}
                </label>
                <Input
                  value={varianceNote}
                  onChange={(event) => setVarianceNote(event.target.value)}
                  placeholder={t('cashRegister.varianceNotePlaceholder')}
                />
              </div>
            </div>
          ) : null}
        </div>
        <div className="flex gap-2 border-t border-border px-5 py-4">
          {view === 'close' ? (
            <Button variant="outline" className="flex-1" onClick={() => setView('active')}>
              {t('cashRegister.back')}
            </Button>
          ) : (
            <Button variant="outline" className="flex-1" onClick={onClose}>
              {t('cashRegister.cancel')}
            </Button>
          )}
          {view === 'open' && canManage ? (
            <Button className="flex-1" disabled={isOpening} onClick={handleOpenRegister}>
              {isOpening ? t('cashRegister.opening') : t('cashRegister.openRegister')}
            </Button>
          ) : null}
          {view === 'close' && isOwner ? (
            <Button className="flex-1" disabled={isClosing || !closingInput} onClick={handleCloseRegister}>
              {isClosing ? t('cashRegister.closing') : t('cashRegister.closeRegister')}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-border bg-white px-3 py-3">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="mt-1 text-[15px] font-semibold">{value}</p>
    </div>
  );
}
