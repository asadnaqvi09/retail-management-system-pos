import { useTranslation } from 'react-i18next';
import Input from '../../atoms/Input';
import Button from '../../atoms/Button';

const emptyValues = {
  name: '',
  description: '',
  parentCategoryId: '',
  isActive: true,
};

export default function CategoryForm({
  initialValues = emptyValues,
  parentOptions = [],
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
    const parentValue = String(formData.get('parentCategoryId') || '').trim();
    onSubmit({
      name: String(formData.get('name') || '').trim(),
      description: String(formData.get('description') || '').trim(),
      parentCategoryId: parentValue || null,
      isActive: formData.get('isActive') === 'true',
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label htmlFor="categoryName" className="mb-1.5 block text-[13px] font-medium">
            {t('categories.form.name')}
          </label>
          <Input
            id="categoryName"
            name="name"
            defaultValue={initialValues.name}
            placeholder={t('categories.form.namePlaceholder')}
            required
            disabled={isSubmitting}
          />
        </div>
        <div className="col-span-2">
          <label htmlFor="categoryDescription" className="mb-1.5 block text-[13px] font-medium">
            {t('categories.form.description')}
          </label>
          <textarea
            id="categoryDescription"
            name="description"
            defaultValue={initialValues.description || ''}
            rows={2}
            disabled={isSubmitting}
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-[14px] outline-none transition-colors focus:border-primary"
            placeholder={t('categories.form.descriptionPlaceholder')}
          />
        </div>
        <div>
          <label htmlFor="parentCategoryId" className="mb-1.5 block text-[13px] font-medium">
            {t('categories.form.parent')}
          </label>
          <select
            id="parentCategoryId"
            name="parentCategoryId"
            defaultValue={initialValues.parentCategoryId || ''}
            disabled={isSubmitting}
            className="h-10 w-full rounded-lg border border-border bg-white px-3 text-[14px] outline-none focus:border-primary"
          >
            <option value="">{t('categories.noParent')}</option>
            {parentOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {`${'— '.repeat(option.depth)}${option.name}`}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="categoryStatus" className="mb-1.5 block text-[13px] font-medium">
            {t('categories.form.status')}
          </label>
          <select
            id="categoryStatus"
            name="isActive"
            defaultValue={initialValues.isActive === false ? 'false' : 'true'}
            disabled={isSubmitting}
            className="h-10 w-full rounded-lg border border-border bg-white px-3 text-[14px] outline-none focus:border-primary"
          >
            <option value="true">{t('categories.status.active')}</option>
            <option value="false">{t('categories.status.inactive')}</option>
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
            {t('categories.form.cancel')}
          </Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t('categories.form.saving') : submitLabel}
        </Button>
      </div>
    </form>
  );
}
