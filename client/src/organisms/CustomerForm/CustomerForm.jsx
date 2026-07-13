import { useTranslation } from 'react-i18next';
import Input from '../../atoms/Input';
import Button from '../../atoms/Button';

const emptyValues = {
  name: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
  isActive: true,
};

export default function CustomerForm({
  initialValues = emptyValues,
  onSubmit,
  onCancel,
  isSubmitting,
  submitLabel,
  errorMessage,
  compact = false,
}) {
  const { t } = useTranslation();

  function handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    onSubmit({
      name: String(formData.get('name') || '').trim(),
      phone: String(formData.get('phone') || '').trim(),
      email: String(formData.get('email') || '').trim(),
      address: String(formData.get('address') || '').trim(),
      notes: String(formData.get('notes') || '').trim(),
      isActive: formData.get('isActive') === 'true',
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={
        compact
          ? 'space-y-3'
          : 'space-y-4 rounded-xl border border-border bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.05)]'
      }
    >
      <div className={compact ? 'space-y-3' : 'grid grid-cols-2 gap-4'}>
        <div className={compact ? '' : 'col-span-2'}>
          <label htmlFor="customerName" className="mb-1.5 block text-[13px] font-medium">
            {t('customers.form.name')}
          </label>
          <Input
            id="customerName"
            name="name"
            defaultValue={initialValues.name}
            placeholder={t('customers.form.namePlaceholder')}
            required
            disabled={isSubmitting}
          />
        </div>
        <div>
          <label htmlFor="customerPhone" className="mb-1.5 block text-[13px] font-medium">
            {t('customers.form.phone')}
          </label>
          <Input
            id="customerPhone"
            name="phone"
            defaultValue={initialValues.phone || ''}
            placeholder={t('customers.form.phonePlaceholder')}
            disabled={isSubmitting}
          />
        </div>
        <div>
          <label htmlFor="customerEmail" className="mb-1.5 block text-[13px] font-medium">
            {t('customers.form.email')}
          </label>
          <Input
            id="customerEmail"
            name="email"
            type="email"
            defaultValue={initialValues.email || ''}
            placeholder={t('customers.form.emailPlaceholder')}
            disabled={isSubmitting}
          />
        </div>
        {!compact ? (
          <>
            <div className="col-span-2">
              <label htmlFor="customerAddress" className="mb-1.5 block text-[13px] font-medium">
                {t('customers.form.address')}
              </label>
              <Input
                id="customerAddress"
                name="address"
                defaultValue={initialValues.address || ''}
                placeholder={t('customers.form.addressPlaceholder')}
                disabled={isSubmitting}
              />
            </div>
            <div className="col-span-2">
              <label htmlFor="customerNotes" className="mb-1.5 block text-[13px] font-medium">
                {t('customers.form.notes')}
              </label>
              <Input
                id="customerNotes"
                name="notes"
                defaultValue={initialValues.notes || ''}
                placeholder={t('customers.form.notesPlaceholder')}
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label htmlFor="customerStatus" className="mb-1.5 block text-[13px] font-medium">
                {t('customers.form.status')}
              </label>
              <select
                id="customerStatus"
                name="isActive"
                defaultValue={initialValues.isActive === false ? 'false' : 'true'}
                disabled={isSubmitting}
                className="h-10 w-full rounded-lg border border-border bg-white px-3 text-[14px] outline-none focus:border-primary"
              >
                <option value="true">{t('customers.status.active')}</option>
                <option value="false">{t('customers.status.inactive')}</option>
              </select>
            </div>
          </>
        ) : null}
      </div>
      {errorMessage ? (
        <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[13px] text-danger">
          {errorMessage}
        </div>
      ) : null}
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={onCancel}>
            {t('customers.form.cancel')}
          </Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t('customers.form.saving') : submitLabel}
        </Button>
      </div>
    </form>
  );
}
