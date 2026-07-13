import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Input from '../../atoms/Input';
import Button from '../../atoms/Button';

const scopeTypes = ['store_wide', 'product', 'category', 'brand'];
const promotionTypes = ['percentage', 'fixed'];
const precedenceRules = ['most_specific', 'highest_discount'];

function toDatetimeLocalValue(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function defaultEndAt() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString();
}

const emptyValues = {
  name: '',
  promotionType: 'percentage',
  discountValue: '',
  scopeType: 'store_wide',
  scopeId: '',
  startAt: new Date().toISOString(),
  endAt: defaultEndAt(),
  precedenceRule: 'most_specific',
};

export default function PromotionForm({
  initialValues = emptyValues,
  products = [],
  categories = [],
  brands = [],
  onSubmit,
  onCancel,
  isSubmitting,
  submitLabel,
  errorMessage,
}) {
  const { t } = useTranslation();
  const [scopeType, setScopeType] = useState(initialValues.scopeType || 'store_wide');

  function handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nextScopeType = String(formData.get('scopeType') || 'store_wide');
    onSubmit({
      name: String(formData.get('name') || '').trim(),
      promotionType: String(formData.get('promotionType') || 'percentage'),
      discountValue: Number(formData.get('discountValue')),
      scopeType: nextScopeType,
      scopeId: nextScopeType === 'store_wide' ? null : String(formData.get('scopeId') || ''),
      startAt: new Date(String(formData.get('startAt'))).toISOString(),
      endAt: new Date(String(formData.get('endAt'))).toISOString(),
      precedenceRule: String(formData.get('precedenceRule') || 'most_specific'),
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-border bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.05)]"
    >
      <div>
        <label htmlFor="promotionName" className="mb-1.5 block text-[13px] font-medium">
          {t('promotions.form.name')}
        </label>
        <Input
          id="promotionName"
          name="name"
          defaultValue={initialValues.name || ''}
          placeholder={t('promotions.form.namePlaceholder')}
          required
          disabled={isSubmitting}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="promotionType" className="mb-1.5 block text-[13px] font-medium">
            {t('promotions.form.type')}
          </label>
          <select
            id="promotionType"
            name="promotionType"
            defaultValue={initialValues.promotionType || 'percentage'}
            disabled={isSubmitting}
            className="h-10 w-full rounded-lg border border-border px-3 text-[13px]"
          >
            {promotionTypes.map((type) => (
              <option key={type} value={type}>
                {t(`promotions.types.${type}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="discountValue" className="mb-1.5 block text-[13px] font-medium">
            {t('promotions.form.discountValue')}
          </label>
          <Input
            id="discountValue"
            name="discountValue"
            type="number"
            min="0"
            step="0.01"
            defaultValue={initialValues.discountValue ?? ''}
            required
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="scopeType" className="mb-1.5 block text-[13px] font-medium">
            {t('promotions.form.scope')}
          </label>
          <select
            id="scopeType"
            name="scopeType"
            value={scopeType}
            onChange={(event) => setScopeType(event.target.value)}
            disabled={isSubmitting}
            className="h-10 w-full rounded-lg border border-border px-3 text-[13px]"
          >
            {scopeTypes.map((type) => (
              <option key={type} value={type}>
                {t(`promotions.scopes.${type}`)}
              </option>
            ))}
          </select>
        </div>
        {scopeType !== 'store_wide' ? (
          <div>
            <label htmlFor="scopeId" className="mb-1.5 block text-[13px] font-medium">
              {t('promotions.form.scopeTarget')}
            </label>
            <select
              id="scopeId"
              name="scopeId"
              defaultValue={initialValues.scopeId || ''}
              required
              disabled={isSubmitting}
              className="h-10 w-full rounded-lg border border-border px-3 text-[13px]"
            >
              <option value="">{t('promotions.form.scopeTargetPlaceholder')}</option>
              {scopeType === 'product'
                ? products.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))
                : null}
              {scopeType === 'category'
                ? categories.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))
                : null}
              {scopeType === 'brand'
                ? brands.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))
                : null}
            </select>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="startAt" className="mb-1.5 block text-[13px] font-medium">
            {t('promotions.form.startAt')}
          </label>
          <Input
            id="startAt"
            name="startAt"
            type="datetime-local"
            defaultValue={toDatetimeLocalValue(initialValues.startAt)}
            required
            disabled={isSubmitting}
          />
        </div>
        <div>
          <label htmlFor="endAt" className="mb-1.5 block text-[13px] font-medium">
            {t('promotions.form.endAt')}
          </label>
          <Input
            id="endAt"
            name="endAt"
            type="datetime-local"
            defaultValue={toDatetimeLocalValue(initialValues.endAt)}
            required
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div>
        <label htmlFor="precedenceRule" className="mb-1.5 block text-[13px] font-medium">
          {t('promotions.form.precedence')}
        </label>
        <select
          id="precedenceRule"
          name="precedenceRule"
          defaultValue={initialValues.precedenceRule || 'most_specific'}
          disabled={isSubmitting}
          className="h-10 w-full rounded-lg border border-border px-3 text-[13px]"
        >
          {precedenceRules.map((rule) => (
            <option key={rule} value={rule}>
              {t(`promotions.precedence.${rule}`)}
            </option>
          ))}
        </select>
      </div>

      {errorMessage ? <p className="text-[13px] text-danger">{errorMessage}</p> : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          {t('promotions.cancel')}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
