import { useTranslation } from 'react-i18next';
import { History } from 'lucide-react';
import { formatVariantAttributes } from '../../lib/inventory';

function formatDelta(value) {
  if (value > 0) {
    return `+${value}`;
  }
  return String(value);
}

export default function MovementHistoryTable({ movements, isLoading }) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  if (!movements.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-white py-16 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#eef2ff] text-primary">
          <History size={22} strokeWidth={1.75} />
        </div>
        <p className="text-[14px] font-medium">{t('inventory.movements.emptyTitle')}</p>
        <p className="mt-1 max-w-sm text-[13px] text-muted">{t('inventory.movements.emptySubtitle')}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
      <table className="w-full min-w-[980px] text-left">
        <thead>
          <tr className="border-b border-border bg-[#fafafa] text-[12px] font-medium uppercase tracking-wide text-muted">
            <th className="px-4 py-3">{t('inventory.movements.table.date')}</th>
            <th className="px-4 py-3">{t('inventory.movements.table.product')}</th>
            <th className="px-4 py-3">{t('inventory.movements.table.variant')}</th>
            <th className="px-4 py-3">{t('inventory.movements.table.type')}</th>
            <th className="px-4 py-3">{t('inventory.movements.table.change')}</th>
            <th className="px-4 py-3">{t('inventory.movements.table.balance')}</th>
            <th className="px-4 py-3">{t('inventory.movements.table.reason')}</th>
            <th className="px-4 py-3">{t('inventory.movements.table.user')}</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((movement) => (
            <tr key={movement.id} className="border-b border-border last:border-b-0 hover:bg-[#fafafa]">
              <td className="px-4 py-3 text-[13px] text-muted">
                {new Date(movement.createdAt).toLocaleString()}
              </td>
              <td className="px-4 py-3 text-[13px] font-medium">{movement.variant.productName}</td>
              <td className="px-4 py-3 text-[13px]">
                {formatVariantAttributes(movement.variant.attributes)}
              </td>
              <td className="px-4 py-3 text-[13px]">
                {t(`inventory.movements.types.${movement.movementType}`, movement.movementType)}
              </td>
              <td
                className={`px-4 py-3 text-[13px] font-medium tabular-nums ${
                  movement.quantityDelta > 0 ? 'text-success' : 'text-danger'
                }`}
              >
                {formatDelta(movement.quantityDelta)}
              </td>
              <td className="px-4 py-3 text-[13px] tabular-nums">{movement.resultingBalance}</td>
              <td className="px-4 py-3 text-[13px]">{movement.reason || '—'}</td>
              <td className="px-4 py-3 text-[13px] text-muted">{movement.user?.name || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
