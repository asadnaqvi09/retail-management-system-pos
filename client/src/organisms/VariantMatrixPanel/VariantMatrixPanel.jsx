import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Grid3X3, Printer } from 'lucide-react';
import { toast } from 'sonner';
import Badge from '../../atoms/Badge';
import Button from '../../atoms/Button';
import Input from '../../atoms/Input';
import BarcodeLabelModal from '../BarcodeLabelModal';
import { useAuth } from '../../hooks/useAuth';
import { getErrorMessage } from '../../lib/errors';
import { formatCurrency } from '../../lib/format';
import { cn } from '../../lib/utils';
import {
  useDeactivateVariantMutation,
  useGenerateVariantMatrixMutation,
  useGetVariantAttributesQuery,
  useListProductVariantsQuery,
  useUpdateVariantMutation,
} from '../../store/variantsApi';

function getAttributeValue(variant, attributeName) {
  return variant.attributes.find((item) => item.attributeName === attributeName);
}

function ValueCheckbox({ item, checked, disabled, onToggle }) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[13px] transition-colors',
        checked ? 'border-primary bg-[#eef2ff]' : 'border-border bg-white hover:bg-[#fafafa]',
        disabled && 'cursor-not-allowed opacity-60'
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
        className="accent-primary"
      />
      {item.swatchHex ? (
        <span
          className="h-4 w-4 rounded-full border border-border"
          style={{ backgroundColor: item.swatchHex }}
        />
      ) : null}
      <span>{item.value}</span>
    </label>
  );
}

export default function VariantMatrixPanel({ productId, productName, canManage }) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const canPrintLabels = hasPermission('barcodes.print');
  const [selectedColorIds, setSelectedColorIds] = useState([]);
  const [selectedSizeIds, setSelectedSizeIds] = useState([]);
  const [editingVariantId, setEditingVariantId] = useState(null);
  const [editValues, setEditValues] = useState({ sellingPrice: 0, costPrice: 0, status: 'active' });
  const [labelModalOpen, setLabelModalOpen] = useState(false);
  const [labelModalItems, setLabelModalItems] = useState([]);
  const { data: attributeMatrix = [], isLoading: isAttributesLoading } = useGetVariantAttributesQuery();
  const {
    data: variants = [],
    isLoading: isVariantsLoading,
    isFetching: isVariantsFetching,
  } = useListProductVariantsQuery(productId);
  const [generateMatrix, { isLoading: isGenerating }] = useGenerateVariantMatrixMutation();
  const [updateVariant, { isLoading: isUpdating }] = useUpdateVariantMutation();
  const [deactivateVariant, { isLoading: isDeactivating }] = useDeactivateVariantMutation();
  const colorAttribute = useMemo(
    () => attributeMatrix.find((item) => item.name === 'Color'),
    [attributeMatrix]
  );
  const sizeAttribute = useMemo(
    () => attributeMatrix.find((item) => item.name === 'Size'),
    [attributeMatrix]
  );
  const isLoading = isAttributesLoading || isVariantsLoading || isVariantsFetching;

  function buildLabelItem(variant, copies = 1) {
    const color = getAttributeValue(variant, 'Color');
    const size = getAttributeValue(variant, 'Size');
    const variantLabel = [color?.value, size?.value].filter(Boolean).join(' / ');
    return {
      variantId: variant.id,
      copies,
      label: {
        productName: variantLabel ? `${productName} – ${variantLabel}` : productName,
        sku: variant.sku,
        barcode: variant.barcode,
        price: variant.discountOverride ?? variant.sellingPrice,
        stockOnHand: variant.stock.quantityOnHand,
      },
    };
  }

  function openSingleLabelModal(variant) {
    setLabelModalItems([buildLabelItem(variant)]);
    setLabelModalOpen(true);
  }

  function openBulkLabelModal() {
    const activeVariants = variants.filter((variant) => variant.status === 'active' && variant.barcode);
    if (!activeVariants.length) {
      toast.error(t('barcodes.errors.noPrintableVariants'));
      return;
    }
    setLabelModalItems(activeVariants.map((variant) => buildLabelItem(variant, 1)));
    setLabelModalOpen(true);
  }

  function toggleSelection(currentIds, valueId, setter) {
    setter(
      currentIds.includes(valueId)
        ? currentIds.filter((id) => id !== valueId)
        : [...currentIds, valueId]
    );
  }

  async function handleGenerate() {
    if (!selectedColorIds.length || !selectedSizeIds.length) {
      toast.error(t('variants.errors.selectionRequired'));
      return;
    }
    try {
      const summary = await generateMatrix({
        productId,
        body: {
          colorValueIds: selectedColorIds,
          sizeValueIds: selectedSizeIds,
        },
      }).unwrap();
      toast.success(
        t('variants.generateSuccess', {
          created: summary.created,
          skipped: summary.skipped,
        })
      );
    } catch (generateError) {
      toast.error(getErrorMessage(generateError, t('variants.errors.generateFailed')));
    }
  }

  function startEditing(variant) {
    setEditingVariantId(variant.id);
    setEditValues({
      sellingPrice: variant.sellingPrice,
      costPrice: variant.costPrice,
      status: variant.status,
    });
  }

  async function handleSaveVariant(variantId) {
    try {
      await updateVariant({
        variantId,
        productId,
        body: editValues,
      }).unwrap();
      toast.success(t('variants.updateSuccess'));
      setEditingVariantId(null);
    } catch (updateError) {
      toast.error(getErrorMessage(updateError, t('variants.errors.updateFailed')));
    }
  }

  async function handleDeactivate(variant) {
    const color = getAttributeValue(variant, 'Color')?.value || '';
    const size = getAttributeValue(variant, 'Size')?.value || '';
    if (!window.confirm(t('variants.deactivateConfirm', { color, size }))) {
      return;
    }
    try {
      await deactivateVariant({ variantId: variant.id, productId }).unwrap();
      toast.success(t('variants.deactivateSuccess'));
      if (editingVariantId === variant.id) {
        setEditingVariantId(null);
      }
    } catch (deactivateError) {
      toast.error(getErrorMessage(deactivateError, t('variants.errors.deactivateFailed')));
    }
  }

  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-semibold">{t('variants.title')}</h2>
          <p className="mt-0.5 text-[13px] text-muted">{t('variants.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {canPrintLabels && variants.length > 0 ? (
            <Button variant="outline" size="sm" onClick={openBulkLabelModal}>
              <Printer size={14} />
              {t('barcodes.printAll')}
            </Button>
          ) : null}
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#eef2ff] text-primary">
            <Grid3X3 size={18} />
          </div>
        </div>
      </div>
      {!canManage ? (
        <div className="mb-4 rounded-lg border border-border bg-[#fafafa] px-3 py-2 text-[13px] text-muted">
          {t('variants.readOnly')}
        </div>
      ) : null}
      {canManage && colorAttribute && sizeAttribute ? (
        <div className="mb-5 space-y-4 rounded-lg border border-border bg-[#fafafa] p-4">
          <div>
            <p className="mb-2 text-[13px] font-medium">{t('variants.colors')}</p>
            <div className="flex flex-wrap gap-2">
              {colorAttribute.values.map((item) => (
                <ValueCheckbox
                  key={item.id}
                  item={item}
                  checked={selectedColorIds.includes(item.id)}
                  disabled={isGenerating}
                  onToggle={() => toggleSelection(selectedColorIds, item.id, setSelectedColorIds)}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-[13px] font-medium">{t('variants.sizes')}</p>
            <div className="flex flex-wrap gap-2">
              {sizeAttribute.values.map((item) => (
                <ValueCheckbox
                  key={item.id}
                  item={item}
                  checked={selectedSizeIds.includes(item.id)}
                  disabled={isGenerating}
                  onToggle={() => toggleSelection(selectedSizeIds, item.id, setSelectedSizeIds)}
                />
              ))}
            </div>
          </div>
          <Button size="sm" disabled={isGenerating} onClick={handleGenerate}>
            {isGenerating ? t('variants.generating') : t('variants.generate')}
          </Button>
        </div>
      ) : null}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-primary" />
        </div>
      ) : !variants.length ? (
        <div className="rounded-lg border border-dashed border-border py-12 text-center">
          <p className="text-[14px] font-medium">{t('variants.emptyTitle')}</p>
          <p className="mt-1 text-[13px] text-muted">{t('variants.emptySubtitle')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr className="border-b border-border text-[12px] font-medium uppercase tracking-wide text-muted">
                <th className="px-3 py-2">{t('variants.table.color')}</th>
                <th className="px-3 py-2">{t('variants.table.size')}</th>
                <th className="px-3 py-2">{t('variants.table.sku')}</th>
                <th className="px-3 py-2">{t('variants.table.barcode')}</th>
                <th className="px-3 py-2">{t('variants.table.price')}</th>
                <th className="px-3 py-2">{t('variants.table.stock')}</th>
                <th className="px-3 py-2">{t('variants.table.status')}</th>
                {canPrintLabels ? <th className="px-3 py-2">{t('barcodes.table.print')}</th> : null}
                {canManage ? <th className="px-3 py-2">{t('variants.table.actions')}</th> : null}
              </tr>
            </thead>
            <tbody>
              {variants.map((variant) => {
                const color = getAttributeValue(variant, 'Color');
                const size = getAttributeValue(variant, 'Size');
                const isEditing = editingVariantId === variant.id;
                return (
                  <tr key={variant.id} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2 text-[13px]">
                        {color?.swatchHex ? (
                          <span
                            className="h-4 w-4 rounded-full border border-border"
                            style={{ backgroundColor: color.swatchHex }}
                          />
                        ) : null}
                        {color?.value || '—'}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-[13px]">{size?.value || '—'}</td>
                    <td className="px-3 py-3 text-[13px] font-medium">{variant.sku}</td>
                    <td className="px-3 py-3 text-[13px] tabular-nums">{variant.barcode}</td>
                    <td className="px-3 py-3 text-[13px]">
                      {isEditing ? (
                        <div className="space-y-2">
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={editValues.sellingPrice}
                            onChange={(event) =>
                              setEditValues((current) => ({
                                ...current,
                                sellingPrice: Number(event.target.value || 0),
                              }))
                            }
                          />
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={editValues.costPrice}
                            onChange={(event) =>
                              setEditValues((current) => ({
                                ...current,
                                costPrice: Number(event.target.value || 0),
                              }))
                            }
                          />
                        </div>
                      ) : (
                        <div>
                          <div className="font-medium">{formatCurrency(variant.sellingPrice)}</div>
                          <div className="text-[12px] text-muted">
                            {formatCurrency(variant.costPrice)}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-[13px] tabular-nums">
                      {variant.stock.quantityOnHand}
                    </td>
                    <td className="px-3 py-3">
                      {isEditing ? (
                        <select
                          value={editValues.status}
                          onChange={(event) =>
                            setEditValues((current) => ({ ...current, status: event.target.value }))
                          }
                          className="h-9 w-full rounded-lg border border-border bg-white px-2 text-[13px] outline-none focus:border-primary"
                        >
                          <option value="active">{t('variants.status.active')}</option>
                          <option value="inactive">{t('variants.status.inactive')}</option>
                        </select>
                      ) : variant.status === 'active' ? (
                        <Badge variant="success">{t('variants.status.active')}</Badge>
                      ) : (
                        <Badge variant="warning">{t('variants.status.inactive')}</Badge>
                      )}
                    </td>
                    {canPrintLabels ? (
                      <td className="px-3 py-3">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={variant.status !== 'active' || !variant.barcode}
                          onClick={() => openSingleLabelModal(variant)}
                        >
                          <Printer size={14} />
                        </Button>
                      </td>
                    ) : null}
                    {canManage ? (
                      <td className="px-3 py-3">
                        <div className="flex gap-2">
                          {isEditing ? (
                            <>
                              <Button
                                size="sm"
                                disabled={isUpdating}
                                onClick={() => handleSaveVariant(variant.id)}
                              >
                                {t('variants.save')}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingVariantId(null)}
                              >
                                {t('variants.cancel')}
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button size="sm" variant="outline" onClick={() => startEditing(variant)}>
                                {t('variants.edit')}
                              </Button>
                              {variant.status === 'active' ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={isDeactivating}
                                  onClick={() => handleDeactivate(variant)}
                                >
                                  {t('variants.deactivate')}
                                </Button>
                              ) : null}
                            </>
                          )}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <BarcodeLabelModal
        open={labelModalOpen}
        items={labelModalItems}
        onClose={() => setLabelModalOpen(false)}
      />
    </div>
  );
}
