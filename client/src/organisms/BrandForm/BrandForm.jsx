import { useTranslation } from 'react-i18next';
import Input from '../../atoms/Input';
import Button from '../../atoms/Button';

const emptyValues = {
  name: '',
  isActive: true,
};

export default function BrandForm({
  initialValues = emptyValues,
  onSubmit,
  onCancel,
  isSubmitting,
  submitLabel,
  errorMessage,
}) {
  const { t } = useTranslation();

  function handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    onSubmit({
      name: String(formData.get('name') || '').trim(),
      isActive: formData.get('isActive') === 'true',
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label htmlFor="brandName" className="mb-1.5 block text-[13px] font-medium">
            {t('brands.form.name')}
          </label>
          <Input
            id="brandName"
            name="name"
            defaultValue={initialValues.name}
            placeholder={t('brands.form.namePlaceholder')}
            required
            disabled={isSubmitting}
          />
        </div>
        <div>
          <label htmlFor="brandStatus" className="mb-1.5 block text-[13px] font-medium">
            {t('brands.form.status')}
          </label>
          <select
            id="brandStatus"
            name="isActive"
            defaultValue={initialValues.isActive === false ? 'false' : 'true'}
            disabled={isSubmitting}
            className="h-10 w-full rounded-lg border border-border bg-white px-3 text-[14px] outline-none focus:border-primary"
          >
            <option value="true">{t('brands.status.active')}</option>
            <option value="false">{t('brands.status.inactive')}</option>
          </select>
        </div>
      </div>
      {errorMessage ? (
        <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[13px] text-danger">
          {errorMessage}
        </div>
      ) : null}
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={onCancel}>
            {t('brands.form.cancel')}
          </Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t('brands.form.saving') : submitLabel}
        </Button>
      </div>
    </form>
  );
}
