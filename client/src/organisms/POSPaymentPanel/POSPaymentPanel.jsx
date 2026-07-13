import { useTranslation } from 'react-i18next';
import {
  Banknote,
  CreditCard,
  Smartphone,
  Building2,
  Wallet,
  Check,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatMoney } from '../../lib/format';
import Button from '../../atoms/Button';
import POSNumpad from '../../molecules/POSNumpad';

const paymentMethods = [
  { id: 'cash', icon: Banknote, labelKey: 'pos.payment.cash' },
  { id: 'card', icon: CreditCard, labelKey: 'pos.payment.card' },
  { id: 'jazzcash', icon: Smartphone, labelKey: 'pos.payment.jazzcash' },
  { id: 'easypaisa', icon: Wallet, labelKey: 'pos.payment.easypaisa' },
  { id: 'bank_transfer', icon: Building2, labelKey: 'pos.payment.bankTransfer' },
];

export default function POSPaymentPanel({
  totals,
  taxRateLabel,
  paymentMethod,
  onPaymentMethodChange,
  tenderedInput,
  onTenderedInputChange,
  changeAmount,
  onCompleteSale,
  isCompleting,
  isPreviewLoading,
  canCheckout,
  registerBlocked,
}) {
  const { t } = useTranslation();
  const isCash = paymentMethod === 'cash';
  const total = totals?.total ?? 0;
  const displayAmount = isCash ? tenderedInput || '0' : String(total);

  return (
    <section className="flex w-[420px] shrink-0 flex-col bg-[#fafafa] lg:w-[480px]">
      <div className="grid grid-cols-2 gap-4 border-b border-border bg-white px-5 py-5 lg:grid-cols-4">
        <div>
          <p className="text-[12px] text-muted">{t('pos.subtotal')}</p>
          <p className="mt-1 text-[18px] font-semibold">
            {formatMoney(totals?.subtotal ?? 0)}
          </p>
        </div>
        <div>
          <p className="text-[12px] text-muted">{t('pos.discount')}</p>
          <p className="mt-1 text-[18px] font-semibold text-success">
            -{formatMoney(totals?.discountTotal ?? 0)}
          </p>
        </div>
        <div>
          <p className="text-[12px] text-muted">
            {t('pos.tax')}
            {taxRateLabel ? ` (${taxRateLabel})` : ''}
          </p>
          <p className="mt-1 text-[18px] font-semibold">
            {formatMoney(totals?.taxTotal ?? 0)}
          </p>
        </div>
        <div>
          <p className="text-[12px] text-muted">{t('pos.total')}</p>
          <p className="mt-1 text-[22px] font-bold text-primary">
            {formatMoney(total)}
          </p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <p className="mb-3 text-[13px] font-medium text-muted">{t('pos.paymentMethod')}</p>
        <div className="mb-5 grid grid-cols-3 gap-2">
          {paymentMethods.slice(0, 3).map(({ id, icon: Icon, labelKey }) => (
            <button
              key={id}
              type="button"
              onClick={() => onPaymentMethodChange(id)}
              className={cn(
                'flex flex-col items-center justify-center gap-2 rounded-xl border px-3 py-4 text-[13px] font-medium transition-colors',
                paymentMethod === id
                  ? 'border-primary bg-primary text-white shadow-sm'
                  : 'border-border bg-white text-foreground hover:bg-[#f4f4f8]'
              )}
            >
              <Icon size={20} strokeWidth={1.75} />
              {t(labelKey)}
            </button>
          ))}
        </div>
        <div className="mb-5 flex flex-wrap gap-2">
          {paymentMethods.slice(3).map(({ id, icon: Icon, labelKey }) => (
            <button
              key={id}
              type="button"
              onClick={() => onPaymentMethodChange(id)}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] font-medium transition-colors',
                paymentMethod === id
                  ? 'border-primary bg-[#eef2ff] text-primary'
                  : 'border-border bg-white text-muted hover:bg-[#f4f4f8]'
              )}
            >
              <Icon size={14} />
              {t(labelKey)}
            </button>
          ))}
        </div>
        <div className="mb-4 rounded-xl border border-border bg-white px-4 py-3">
          <p className="text-[12px] text-muted">
            {isCash ? t('pos.amountTendered') : t('pos.amountDue')}
          </p>
          <p className="mt-1 text-[28px] font-bold tracking-tight">
            {formatMoney(Number(displayAmount) || 0)}
          </p>
          {isCash && changeAmount > 0 ? (
            <p className="mt-1 text-[13px] font-medium text-success">
              {t('pos.change')}: {formatMoney(changeAmount)}
            </p>
          ) : null}
        </div>
        {isCash ? (
          <POSNumpad
            value={tenderedInput}
            onChange={onTenderedInputChange}
            disabled={!canCheckout || isCompleting}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-white px-4 py-8 text-center text-[13px] text-muted">
            {t('pos.digitalPaymentHint')}
          </div>
        )}
      </div>
      <div className="border-t border-border bg-white p-5">
        {registerBlocked ? (
          <p className="mb-3 text-center text-[12px] text-danger">
            {t('cashRegister.errors.sessionRequired')}
          </p>
        ) : null}
        <Button
          size="lg"
          className="h-12 w-full text-[15px] font-semibold"
          onClick={onCompleteSale}
          disabled={!canCheckout || isCompleting || isPreviewLoading}
        >
          <Check size={18} />
          {isCompleting ? t('pos.completing') : t('pos.completeSale')}
        </Button>
      </div>
    </section>
  );
}
