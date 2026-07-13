import { useTranslation } from 'react-i18next';
import Input from '../../atoms/Input';
import Button from '../../atoms/Button';

const defaultValues = {
  name: '',
  description: '',
  baseSku: '',
  defaultSellingPrice: 0,
  defaultCostPrice: 0,
  status: 'active',
  categoryId: '',
  brandId: '',
};

export default function ProductForm({
  initialValues = defaultValues,
  categoryOptions = [],
  brandOptions = [],
  onSubmit,
  isSubmitting,
  submitLabel,
  errorMessage,
}) {
  const { t } = useTranslation();

  function handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const categoryValue = String(formData.get('categoryId') || '').trim();
    const brandValue = String(formData.get('brandId') || '').trim();
    onSubmit({
      name: String(formData.get('name') || '').trim(),
      description: String(formData.get('description') || '').trim(),
      baseSku: String(formData.get('baseSku') || '').trim().toUpperCase(),
      defaultSellingPrice: Number(formData.get('defaultSellingPrice') || 0),
      defaultCostPrice: Number(formData.get('defaultCostPrice') || 0),
      status: formData.get('status'),
      categoryId: categoryValue || null,
      brandId: brandValue || null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label htmlFor="name" className="mb-1.5 block text-[13px] font-medium">
            {t('products.form.name')}
          </label>
          <Input
            id="name"
            name="name"
            defaultValue={initialValues.name}
            placeholder={t('products.form.namePlaceholder')}
            required
            disabled={isSubmitting}
          />
        </div>
        <div className="col-span-2">
          <label htmlFor="description" className="mb-1.5 block text-[13px] font-medium">
            {t('products.form.description')}
          </label>
          <textarea
            id="description"
            name="description"
            defaultValue={initialValues.description || ''}
            rows={3}
            disabled={isSubmitting}
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-[14px] outline-none transition-colors focus:border-primary"
            placeholder={t('products.form.descriptionPlaceholder')}
          />
        </div>
        <div>
          <label htmlFor="baseSku" className="mb-1.5 block text-[13px] font-medium">
            {t('products.form.baseSku')}
          </label>
          <Input
            id="baseSku"
            name="baseSku"
            defaultValue={initialValues.baseSku}
            placeholder={t('products.form.baseSkuPlaceholder')}
            required
            disabled={isSubmitting}
          />
        </div>
        <div>
          <label htmlFor="status" className="mb-1.5 block text-[13px] font-medium">
            {t('products.form.status')}
          </label>
          <select
            id="status"
            name="status"
            defaultValue={initialValues.status}
            disabled={isSubmitting}
            className="h-10 w-full rounded-lg border border-border bg-white px-3 text-[14px] outline-none focus:border-primary"
          >
            <option value="active">{t('products.status.active')}</option>
            <option value="draft">{t('products.status.draft')}</option>
            <option value="inactive">{t('products.status.inactive')}</option>
          </select>
        </div>
        <div>
          <label htmlFor="categoryId" className="mb-1.5 block text-[13px] font-medium">
            {t('products.form.category')}
          </label>
          <select
            id="categoryId"
            name="categoryId"
            defaultValue={initialValues.categoryId || ''}
            disabled={isSubmitting}
            className="h-10 w-full rounded-lg border border-border bg-white px-3 text-[14px] outline-none focus:border-primary"
          >
            <option value="">{t('products.noCategory')}</option>
            {categoryOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {`${'— '.repeat(option.depth)}${option.name}`}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="brandId" className="mb-1.5 block text-[13px] font-medium">
            {t('products.form.brand')}
          </label>
          <select
            id="brandId"
            name="brandId"
            defaultValue={initialValues.brandId || ''}
            disabled={isSubmitting}
            className="h-10 w-full rounded-lg border border-border bg-white px-3 text-[14px] outline-none focus:border-primary"
          >
            <option value="">{t('products.noBrand')}</option>
            {brandOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="defaultSellingPrice" className="mb-1.5 block text-[13px] font-medium">
            {t('products.form.sellingPrice')}
          </label>
          <Input
            id="defaultSellingPrice"
            name="defaultSellingPrice"
            type="number"
            min="0"
            step="1"
            defaultValue={initialValues.defaultSellingPrice}
            disabled={isSubmitting}
          />
        </div>
        <div>
          <label htmlFor="defaultCostPrice" className="mb-1.5 block text-[13px] font-medium">
            {t('products.form.costPrice')}
          </label>
          <Input
            id="defaultCostPrice"
            name="defaultCostPrice"
            type="number"
            min="0"
            step="1"
            defaultValue={initialValues.defaultCostPrice}
            disabled={isSubmitting}
          />
        </div>
      </div>
      {errorMessage ? (
        <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[13px] text-danger">
          {errorMessage}
        </div>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t('products.form.saving') : submitLabel}
        </Button>
      </div>
    </form>
  );
}
