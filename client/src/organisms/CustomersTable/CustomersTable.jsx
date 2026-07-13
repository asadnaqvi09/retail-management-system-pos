import { useTranslation } from 'react-i18next';
import { Users } from 'lucide-react';
import Badge from '../../atoms/Badge';
import Button from '../../atoms/Button';
import { formatMoney } from '../../lib/format';

export default function CustomersTable({
  customers,
  isLoading,
  canManage,
  onEdit,
  onView,
  onDeactivate,
}) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  if (!customers.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-white py-16 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#eef2ff] text-primary">
          <Users size={22} strokeWidth={1.75} />
        </div>
        <p className="text-[14px] font-medium">{t('customers.emptyTitle')}</p>
        <p className="mt-1 max-w-sm text-[13px] text-muted">{t('customers.emptySubtitle')}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-border bg-[#fafafa] text-[12px] font-medium uppercase tracking-wide text-muted">
            <th className="px-4 py-3">{t('customers.table.customer')}</th>
            <th className="px-4 py-3">{t('customers.table.contact')}</th>
            <th className="px-4 py-3">{t('customers.table.purchases')}</th>
            <th className="px-4 py-3">{t('customers.table.totalSpent')}</th>
            <th className="px-4 py-3">{t('customers.table.status')}</th>
            <th className="px-4 py-3">{t('customers.table.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((customer) => (
            <tr
              key={customer.id}
              className="border-b border-border last:border-b-0 hover:bg-[#fafafa]"
            >
              <td className="px-4 py-3">
                <div className="text-[13px] font-medium">{customer.name}</div>
                {customer.loyaltyPoints > 0 ? (
                  <div className="mt-0.5 text-[12px] text-muted">
                    {t('customers.loyaltyPoints', { count: customer.loyaltyPoints })}
                  </div>
                ) : null}
              </td>
              <td className="px-4 py-3 text-[13px] text-muted">
                <div>{customer.phone || '—'}</div>
                <div>{customer.email || '—'}</div>
              </td>
              <td className="px-4 py-3 text-[13px] tabular-nums">{customer.saleCount}</td>
              <td className="px-4 py-3 text-[13px] font-medium tabular-nums">
                {formatMoney(customer.totalSpent)}
              </td>
              <td className="px-4 py-3">
                {customer.isActive ? (
                  <Badge variant="success">{t('customers.status.active')}</Badge>
                ) : (
                  <Badge variant="warning">{t('customers.status.inactive')}</Badge>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => onView(customer)}>
                    {t('customers.view')}
                  </Button>
                  {canManage ? (
                    <>
                      <Button type="button" variant="outline" size="sm" onClick={() => onEdit(customer)}>
                        {t('customers.edit')}
                      </Button>
                      {customer.isActive ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onDeactivate(customer)}
                        >
                          {t('customers.deactivate')}
                        </Button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
