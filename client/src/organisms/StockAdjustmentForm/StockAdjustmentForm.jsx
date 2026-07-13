import { useTranslation } from 'react-i18next';
import Input from '../../atoms/Input';
import Button from '../../atoms/Button';
import { formatVariantAttributes } from '../../lib/inventory';

const movementTypes = ['adjustment', 'stock_receive', 'opening_stock', 'damage', 'loss'];

export default function StockAdjustmentForm({
  item,
  mode = 'adjust',
  onSubmit,
  onCancel,
  isSubmitting,
  errorMessage,
}) {
  const { t } = useTranslation();
  const isThresholdMode = mode === 'threshold';

  function handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (isThresholdMode) {
      onSubmit({
        reorderThreshold: Number(formData.get('reorderThreshold') || 0),
      });
      return;
    }
    const adjustmentMode = formData.get('adjustmentMode');
    const payload = {
      movementType: formData.get('movementType'),
      reason: String(formData.get('reason') || '').trim(),
      note: String(formData.get('note') || '').trim(),
    };
    if (adjustmentMode === 'target') {
      payload.targetQuantity = Number(formData.get('targetQuantity') || 0);
    } else {
      payload.quantityDelta = Number(formData.get('quantityDelta') || 0);
    }
    onSubmit(payload);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
      <div className="rounded-lg bg-[#fafafa] px-3 py-2 text-[13px]">
        <div className="font-medium">{item.product.name}</div>
        <div className="text-muted">
          {formatVariantAttributes(item.attributes)} · {item.sku}
        </div>
        <div className="mt-1 text-muted">
          {t('inventory.currentQuantity')}: {item.quantityOnHand}
        </div>
      </div>
      {isThresholdMode ? (
        <div>
          <label htmlFor="reorderThreshold" className="mb-1.5 block text-[13px] font-medium">
            {t('inventory.form.reorderThreshold')}
          </label>
          <Input
            id="reorderThreshold"
            name="reorderThreshold"
            type="number"
            min="0"
            step="1"
            defaultValue={item.reorderThreshold}
            required
            disabled={isSubmitting}
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="movementType" className="mb-1.5 block text-[13px] font-medium">
                {t('inventory.form.movementType')}
              </label>
              <select
                id="movementType"
                name="movementType"
                defaultValue="adjustment"
                disabled={isSubmitting}
                className="h-10 w-full rounded-lg border border-border bg-white px-3 text-[14px] outline-none focus:border-primary"
              >
                {movementTypes.map((type) => (
                  <option key={type} value={type}>
                    {t(`inventory.movements.types.${type}`, type)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="adjustmentMode" className="mb-1.5 block text-[13px] font-medium">
                {t('inventory.form.adjustmentMode')}
              </label>
              <select
                id="adjustmentMode"
                name="adjustmentMode"
                defaultValue="delta"
                disabled={isSubmitting}
                className="h-10 w-full rounded-lg border border-border bg-white px-3 text-[14px] outline-none focus:border-primary"
              >
                <option value="delta">{t('inventory.form.modeDelta')}</option>
                <option value="target">{t('inventory.form.modeTarget')}</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="quantityDelta" className="mb-1.5 block text-[13px] font-medium">
                {t('inventory.form.quantityDelta')}
              </label>
              <Input
                id="quantityDelta"
                name="quantityDelta"
                type="number"
                step="1"
                placeholder="-2 or +5"
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label htmlFor="targetQuantity" className="mb-1.5 block text-[13px] font-medium">
                {t('inventory.form.targetQuantity')}
              </label>
              <Input
                id="targetQuantity"
                name="targetQuantity"
                type="number"
                min="0"
                step="1"
                disabled={isSubmitting}
              />
            </div>
          </div>
          <div>
            <label htmlFor="reason" className="mb-1.5 block text-[13px] font-medium">
              {t('inventory.form.reason')}
            </label>
            <Input
              id="reason"
              name="reason"
              placeholder={t('inventory.form.reasonPlaceholder')}
              required
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label htmlFor="note" className="mb-1.5 block text-[13px] font-medium">
              {t('inventory.form.note')}
            </label>
            <textarea
              id="note"
              name="note"
              rows={2}
              disabled={isSubmitting}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-[14px] outline-none transition-colors focus:border-primary"
              placeholder={t('inventory.form.notePlaceholder')}
            />
          </div>
        </>
      )}
      {errorMessage ? (
        <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[13px] text-danger">
          {errorMessage}
        </div>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={isSubmitting} onClick={onCancel}>
          {t('inventory.form.cancel')}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t('inventory.form.saving') : t('inventory.form.save')}
        </Button>
      </div>
    </form>
  );
}
