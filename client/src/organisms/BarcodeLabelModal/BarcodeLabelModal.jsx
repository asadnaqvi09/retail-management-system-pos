import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Printer, X } from 'lucide-react';
import { toast } from 'sonner';
import Button from '../../atoms/Button';
import Input from '../../atoms/Input';
import { formatCurrency } from '../../lib/format';
import { getErrorMessage } from '../../lib/errors';
import { printPdfBlob } from '../../lib/printInvoice';
import {
  useGetVariantLabelPdfMutation,
  usePrintBulkLabelsMutation,
} from '../../store/barcodesApi';

const TEMPLATE_OPTIONS = ['40x30', '50x25', 'a4_sheet'];

function buildInitialRows(items) {
  return items.map((item) => ({
    variantId: item.variantId,
    label: item.label,
    copies: item.copies ?? 1,
  }));
}

export default function BarcodeLabelModal({ open, items = [], onClose }) {
  const { t } = useTranslation();
  const [template, setTemplate] = useState('40x30');
  const [rows, setRows] = useState([]);
  const [getVariantLabelPdf, { isLoading: isPrintingSingle }] = useGetVariantLabelPdfMutation();
  const [printBulkLabels, { isLoading: isPrintingBulk }] = usePrintBulkLabelsMutation();
  const isSingle = items.length === 1;
  const isPrinting = isPrintingSingle || isPrintingBulk;

  useEffect(() => {
    if (open) {
      setRows(buildInitialRows(items));
      setTemplate('40x30');
    }
  }, [open, items]);

  const totalLabels = useMemo(
    () => rows.reduce((sum, row) => sum + (Number(row.copies) || 0), 0),
    [rows]
  );

  if (!open) {
    return null;
  }

  function updateCopies(variantId, copies) {
    setRows((current) =>
      current.map((row) =>
        row.variantId === variantId ? { ...row, copies: Math.max(Number(copies) || 1, 1) } : row
      )
    );
  }

  function applyStockCopies() {
    setRows((current) =>
      current.map((row) => ({
        ...row,
        copies: Math.max(row.label?.stockOnHand ?? row.copies ?? 1, 1),
      }))
    );
  }

  async function handlePrint() {
    if (!rows.length || totalLabels < 1) {
      return;
    }
    try {
      let result;
      if (isSingle) {
        result = await getVariantLabelPdf({
          variantId: rows[0].variantId,
          template,
          copies: rows[0].copies,
        }).unwrap();
      } else {
        result = await printBulkLabels({
          template,
          items: rows.map((row) => ({
            variantId: row.variantId,
            copies: row.copies,
          })),
        }).unwrap();
      }
      await printPdfBlob(result.blob, `labels-${result.template}.pdf`);
      toast.success(t('barcodes.printSuccess', { count: result.labelCount }));
      onClose();
    } catch (error) {
      if (error?.message === 'POPUP_BLOCKED') {
        toast.error(t('barcodes.errors.popupBlocked'));
        return;
      }
      toast.error(getErrorMessage(error, t('barcodes.errors.printFailed')));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-[18px] font-semibold">
              {isSingle ? t('barcodes.singleTitle') : t('barcodes.bulkTitle')}
            </h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{t('barcodes.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted hover:bg-[#f4f4f8]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <label htmlFor="labelTemplate" className="mb-1.5 block text-[13px] font-medium">
              {t('barcodes.template')}
            </label>
            <select
              id="labelTemplate"
              value={template}
              onChange={(event) => setTemplate(event.target.value)}
              className="h-10 w-full rounded-lg border border-border px-3 text-[13px]"
            >
              {TEMPLATE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {t(`barcodes.templates.${option}`)}
                </option>
              ))}
            </select>
          </div>

          {isSingle ? (
            <div>
              <label htmlFor="labelCopies" className="mb-1.5 block text-[13px] font-medium">
                {t('barcodes.copies')}
              </label>
              <Input
                id="labelCopies"
                type="number"
                min="1"
                max="100"
                value={rows[0]?.copies ?? 1}
                onChange={(event) => updateCopies(rows[0].variantId, event.target.value)}
              />
              {rows[0]?.label ? (
                <div className="mt-3 rounded-lg border border-border bg-background p-3 text-[13px]">
                  <p className="font-medium">{rows[0].label.productName}</p>
                  <p className="mt-1 text-muted-foreground">
                    {rows[0].label.sku} · {rows[0].label.barcode}
                  </p>
                  <p className="mt-1 font-semibold text-primary">
                    {formatCurrency(rows[0].label.price)}
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-medium">{t('barcodes.variantList')}</p>
                <Button type="button" variant="outline" size="sm" onClick={applyStockCopies}>
                  {t('barcodes.useStockCounts')}
                </Button>
              </div>
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-left text-[13px]">
                  <thead className="border-b border-border bg-background text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">{t('barcodes.table.variant')}</th>
                      <th className="px-3 py-2 font-medium">{t('barcodes.table.sku')}</th>
                      <th className="px-3 py-2 font-medium">{t('barcodes.table.copies')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.variantId} className="border-b border-border/70 last:border-b-0">
                        <td className="px-3 py-2">{row.label?.productName || '—'}</td>
                        <td className="px-3 py-2 tabular-nums">{row.label?.sku || '—'}</td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            min="1"
                            max="100"
                            value={row.copies}
                            onChange={(event) => updateCopies(row.variantId, event.target.value)}
                            className="h-8 w-20"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <p className="text-[12px] text-muted-foreground">
            {t('barcodes.totalLabels', { count: totalLabels })}
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <Button variant="outline" onClick={onClose} disabled={isPrinting}>
            {t('barcodes.cancel')}
          </Button>
          <Button onClick={handlePrint} disabled={isPrinting || totalLabels < 1}>
            <Printer size={16} />
            {isPrinting ? t('barcodes.printing') : t('barcodes.print')}
          </Button>
        </div>
      </div>
    </div>
  );
}
