import { useTranslation } from 'react-i18next';
import { Pencil, Trash2 } from 'lucide-react';
import Badge from '../../atoms/Badge';
import Button from '../../atoms/Button';

function formatDiscount(t, promotion) {
  if (promotion.promotionType === 'percentage') {
    return `${promotion.discountValue}%`;
  }
  return t('promotions.fixedValue', { value: promotion.discountValue });
}

function formatDateRange(startAt, endAt) {
  const start = new Date(startAt).toLocaleString('en-PK', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const end = new Date(endAt).toLocaleString('en-PK', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${start} – ${end}`;
}

function statusVariant(status) {
  switch (status) {
    case 'active':
      return 'success';
    case 'scheduled':
      return 'warning';
    default:
      return 'default';
  }
}

export default function PromotionsTable({
  promotions,
  canManage,
  onEdit,
  onDelete,
  isDeletingId,
}) {
  const { t } = useTranslation();

  if (!promotions.length) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-white px-6 py-12 text-center">
        <p className="text-[15px] font-medium">{t('promotions.emptyTitle')}</p>
        <p className="mt-1 text-[13px] text-muted-foreground">{t('promotions.emptySubtitle')}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-[13px]">
          <thead className="border-b border-border bg-background text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">{t('promotions.table.name')}</th>
              <th className="px-4 py-3 font-medium">{t('promotions.table.scope')}</th>
              <th className="px-4 py-3 font-medium">{t('promotions.table.discount')}</th>
              <th className="px-4 py-3 font-medium">{t('promotions.table.status')}</th>
              <th className="px-4 py-3 font-medium">{t('promotions.table.dates')}</th>
              <th className="px-4 py-3 font-medium">{t('promotions.table.usage')}</th>
              {canManage ? (
                <th className="px-4 py-3 font-medium">{t('promotions.table.actions')}</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {promotions.map((promotion) => (
              <tr key={promotion.id} className="border-b border-border/70">
                <td className="px-4 py-3 font-medium">{promotion.name}</td>
                <td className="px-4 py-3">
                  <div>{t(`promotions.scopes.${promotion.scopeType}`)}</div>
                  {promotion.scopeName ? (
                    <div className="text-[12px] text-muted-foreground">{promotion.scopeName}</div>
                  ) : null}
                </td>
                <td className="px-4 py-3">{formatDiscount(t, promotion)}</td>
                <td className="px-4 py-3">
                  <Badge variant={statusVariant(promotion.status)}>
                    {t(`promotions.status.${promotion.status}`)}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatDateRange(promotion.startAt, promotion.endAt)}
                </td>
                <td className="px-4 py-3">{promotion.usageCount}</td>
                {canManage ? (
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => onEdit(promotion)}>
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(promotion)}
                        disabled={isDeletingId === promotion.id}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
