import { useTranslation } from 'react-i18next';
import { Pencil, Trash2 } from 'lucide-react';
import Button from '../../atoms/Button';
import { formatMoney } from '../../lib/format';
import { getExpenseReceiptUrl } from '../../store/expensesApi';

function formatPaymentMethod(t, method) {
  const key = method === 'bank_transfer' ? 'bankTransfer' : method;
  return t(`pos.payment.${key}`, { defaultValue: method });
}

export default function ExpensesTable({
  expenses,
  canManage,
  onEdit,
  onDelete,
  isDeletingId,
}) {
  const { t } = useTranslation();

  if (!expenses.length) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-white px-6 py-12 text-center">
        <p className="text-[15px] font-medium">{t('expenses.emptyTitle')}</p>
        <p className="mt-1 text-[13px] text-muted-foreground">{t('expenses.emptySubtitle')}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-left text-[13px]">
          <thead className="border-b border-border bg-background text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">{t('expenses.table.date')}</th>
              <th className="px-4 py-3 font-medium">{t('expenses.table.category')}</th>
              <th className="px-4 py-3 font-medium">{t('expenses.table.amount')}</th>
              <th className="px-4 py-3 font-medium">{t('expenses.table.payment')}</th>
              <th className="px-4 py-3 font-medium">{t('expenses.table.recordedBy')}</th>
              <th className="px-4 py-3 font-medium">{t('expenses.table.note')}</th>
              {canManage ? (
                <th className="px-4 py-3 font-medium">{t('expenses.table.actions')}</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense) => {
              const receiptUrl = getExpenseReceiptUrl(expense.attachmentPath);
              return (
                <tr key={expense.id} className="border-b border-border/70">
                  <td className="px-4 py-3">{expense.expenseDate}</td>
                  <td className="px-4 py-3 font-medium">{expense.category.name}</td>
                  <td className="px-4 py-3 font-medium">{formatMoney(expense.amount)}</td>
                  <td className="px-4 py-3">{formatPaymentMethod(t, expense.paymentMethod)}</td>
                  <td className="px-4 py-3">{expense.user.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {expense.note || '—'}
                    {receiptUrl ? (
                      <>
                        {' · '}
                        <a
                          href={receiptUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline"
                        >
                          {t('expenses.table.receipt')}
                        </a>
                      </>
                    ) : null}
                  </td>
                  {canManage ? (
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => onEdit(expense)}>
                          <Pencil size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(expense)}
                          disabled={isDeletingId === expense.id}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
