import { useTranslation } from 'react-i18next';
import { X, Play, Trash2 } from 'lucide-react';
import Button from '../../atoms/Button';
import { formatMoney } from '../../lib/format';
import { cn } from '../../lib/utils';

export default function POSHoldCartDrawer({ open, carts, onClose, onResume, onDiscard, isLoading }) {
  const { t } = useTranslation();

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <button type="button" className="flex-1" onClick={onClose} aria-label={t('pos.close')} />
      <aside className="flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-[16px] font-semibold">{t('pos.heldCarts')}</h2>
            <p className="text-[13px] text-muted">{t('pos.heldCartsSubtitle')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-[#f4f4f8]"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <p className="text-[13px] text-muted">{t('pos.loading')}</p>
          ) : carts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
              <p className="text-[14px] font-medium text-muted">{t('pos.noHeldCarts')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {carts.map((cart) => (
                <div
                  key={cart.id}
                  className={cn('rounded-xl border border-border bg-[#fafafa] p-4')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[14px] font-semibold">
                        {cart.label || t('pos.unnamedHold')}
                      </p>
                      <p className="mt-1 text-[12px] text-muted">
                        {cart.lineCount} {t('pos.items')} · {cart.user?.name}
                      </p>
                    </div>
                    <p className="text-[15px] font-bold text-primary">{formatMoney(cart.total)}</p>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" className="flex-1" onClick={() => onResume(cart.id)}>
                      <Play size={14} />
                      {t('pos.resume')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDiscard(cart.id)}
                      className="text-danger hover:text-danger"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
