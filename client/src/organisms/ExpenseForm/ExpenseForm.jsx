import { useTranslation } from 'react-i18next';
import Input from '../../atoms/Input';
import Button from '../../atoms/Button';

const paymentMethods = ['cash', 'card', 'jazzcash', 'easypaisa', 'bank_transfer'];

const emptyValues = {
  categoryId: '',
  amount: '',
  expenseDate: new Date().toISOString().slice(0, 10),
  paymentMethod: 'cash',
  note: '',
};

export default function ExpenseForm({
  categories = [],
  initialValues = emptyValues,
  onSubmit,
  onCancel,
  isSubmitting,
  submitLabel,
  errorMessage,
  receiptFile,
  onReceiptChange,
  existingReceiptUrl,
}) {
  const { t } = useTranslation();
  const activeCategories = categories.filter((category) => category.isActive);

  function handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    onSubmit({
      categoryId: String(formData.get('categoryId') || ''),
      amount: Number(formData.get('amount')),
      expenseDate: String(formData.get('expenseDate') || ''),
      paymentMethod: String(formData.get('paymentMethod') || 'cash'),
      note: String(formData.get('note') || '').trim(),
      receiptFile,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-border bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.05)]"
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label htmlFor="expenseCategory" className="mb-1.5 block text-[13px] font-medium">
            {t('expenses.form.category')}
          </label>
          <select
            id="expenseCategory"
            name="categoryId"
            defaultValue={initialValues.categoryId || ''}
            required
            disabled={isSubmitting}
            className="h-10 w-full rounded-lg border border-border px-3 text-[13px]"
          >
            <option value="">{t('expenses.form.categoryPlaceholder')}</option>
            {activeCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="expenseAmount" className="mb-1.5 block text-[13px] font-medium">
            {t('expenses.form.amount')}
          </label>
          <Input
            id="expenseAmount"
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            defaultValue={initialValues.amount ?? ''}
            placeholder={t('expenses.form.amountPlaceholder')}
            required
            disabled={isSubmitting}
          />
        </div>
        <div>
          <label htmlFor="expenseDate" className="mb-1.5 block text-[13px] font-medium">
            {t('expenses.form.date')}
          </label>
          <Input
            id="expenseDate"
            name="expenseDate"
            type="date"
            defaultValue={initialValues.expenseDate || emptyValues.expenseDate}
            required
            disabled={isSubmitting}
          />
        </div>
        <div className="col-span-2">
          <label htmlFor="expensePaymentMethod" className="mb-1.5 block text-[13px] font-medium">
            {t('expenses.form.paymentMethod')}
          </label>
          <select
            id="expensePaymentMethod"
            name="paymentMethod"
            defaultValue={initialValues.paymentMethod || 'cash'}
            disabled={isSubmitting}
            className="h-10 w-full rounded-lg border border-border px-3 text-[13px]"
          >
            {paymentMethods.map((method) => (
              <option key={method} value={method}>
                {t(`pos.payment.${method === 'bank_transfer' ? 'bankTransfer' : method}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label htmlFor="expenseNote" className="mb-1.5 block text-[13px] font-medium">
            {t('expenses.form.note')}
          </label>
          <Input
            id="expenseNote"
            name="note"
            defaultValue={initialValues.note || ''}
            placeholder={t('expenses.form.notePlaceholder')}
            disabled={isSubmitting}
          />
        </div>
        {onReceiptChange ? (
          <div className="col-span-2">
            <label htmlFor="expenseReceipt" className="mb-1.5 block text-[13px] font-medium">
              {t('expenses.form.receipt')}
            </label>
            <Input
              id="expenseReceipt"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => onReceiptChange(event.target.files?.[0] || null)}
              disabled={isSubmitting}
            />
            {existingReceiptUrl ? (
              <a
                href={existingReceiptUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-[12px] text-primary hover:underline"
              >
                {t('expenses.form.viewReceipt')}
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
      {errorMessage ? (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger">{errorMessage}</p>
      ) : null}
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            {t('expenses.form.cancel')}
          </Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t('expenses.form.saving') : submitLabel}
        </Button>
      </div>
    </form>
  );
}
