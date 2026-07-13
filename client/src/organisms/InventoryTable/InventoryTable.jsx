import { useTranslation } from 'react-i18next';
import { Boxes } from 'lucide-react';
import Badge from '../../atoms/Badge';
import Button from '../../atoms/Button';
import { formatVariantAttributes } from '../../lib/inventory';

export default function InventoryTable({
  items,
  isLoading,
  canAdjust,
  onAdjust,
  onEditThreshold,
}) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-white py-16 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#eef2ff] text-primary">
          <Boxes size={22} strokeWidth={1.75} />
        </div>
        <p className="text-[14px] font-medium">{t('inventory.emptyTitle')}</p>
        <p className="mt-1 max-w-sm text-[13px] text-muted">{t('inventory.emptySubtitle')}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
      <table className="w-full min-w-[900px] text-left">
        <thead>
          <tr className="border-b border-border bg-[#fafafa] text-[12px] font-medium uppercase tracking-wide text-muted">
            <th className="px-4 py-3">{t('inventory.table.product')}</th>
            <th className="px-4 py-3">{t('inventory.table.variant')}</th>
            <th className="px-4 py-3">{t('inventory.table.sku')}</th>
            <th className="px-4 py-3">{t('inventory.table.barcode')}</th>
            <th className="px-4 py-3">{t('inventory.table.quantity')}</th>
            <th className="px-4 py-3">{t('inventory.table.threshold')}</th>
            <th className="px-4 py-3">{t('inventory.table.status')}</th>
            {canAdjust ? <th className="px-4 py-3">{t('inventory.table.actions')}</th> : null}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.variantId} className="border-b border-border last:border-b-0 hover:bg-[#fafafa]">
              <td className="px-4 py-3">
                <div className="text-[13px] font-medium">{item.product.name}</div>
                <div className="text-[12px] text-muted">
                  {item.product.categoryName || t('products.noCategory')}
                </div>
              </td>
              <td className="px-4 py-3 text-[13px]">{formatVariantAttributes(item.attributes)}</td>
              <td className="px-4 py-3 text-[13px] font-medium">{item.sku}</td>
              <td className="px-4 py-3 text-[13px] tabular-nums">{item.barcode}</td>
              <td className="px-4 py-3 text-[13px] font-semibold tabular-nums">{item.quantityOnHand}</td>
              <td className="px-4 py-3 text-[13px] tabular-nums">{item.reorderThreshold}</td>
              <td className="px-4 py-3">
                {item.isLowStock ? (
                  <Badge variant="warning">{t('inventory.lowStock')}</Badge>
                ) : (
                  <Badge variant="success">{t('inventory.inStock')}</Badge>
                )}
              </td>
              {canAdjust ? (
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => onAdjust(item)}>
                      {t('inventory.adjust')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onEditThreshold(item)}
                    >
                      {t('inventory.threshold')}
                    </Button>
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
