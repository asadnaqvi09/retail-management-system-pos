import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowLeftRight, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import Button from '../atoms/Button';
import Input from '../atoms/Input';
import Badge from '../atoms/Badge';
import { useAuth } from '../hooks/useAuth';
import { formatMoney } from '../lib/format';
import { getErrorMessage } from '../lib/errors';
import { cn } from '../lib/utils';
import {
  useLazyLookupSaleForExchangeQuery,
  useGetEligibleSaleQuery,
  usePreviewExchangeMutation,
  useCreateExchangeMutation,
} from '../store/exchangesApi';
import { useLookupVariantMutation } from '../store/salesApi';

const STEPS = ['lookup', 'select', 'settlement'];

function formatAttributes(attributes) {
  if (!attributes?.length) return '—';
  return attributes.map((item) => item.value).join(' / ');
}

function buildReturnLines(selections, saleLines) {
  return saleLines
    .filter((line) => Number(selections[line.id]?.quantity) > 0)
    .map((line) => ({
      originalSaleLineId: line.id,
      quantity: Number(selections[line.id].quantity),
      disposition: selections[line.id].disposition || 'restock',
    }));
}

export default function ExchangeReturnPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('exchanges.manage');
  const [step, setStep] = useState('lookup');
  const [lookupMode, setLookupMode] = useState('invoice');
  const [lookupInput, setLookupInput] = useState('');
  const [selectedSaleId, setSelectedSaleId] = useState(null);
  const [selections, setSelections] = useState({});
  const [isExchange, setIsExchange] = useState(false);
  const [newLines, setNewLines] = useState([]);
  const [replacementSearch, setReplacementSearch] = useState('');
  const [preview, setPreview] = useState(null);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [tenderedInput, setTenderedInput] = useState('');
  const [lookupSale, { data: lookupResults = [], isFetching: isLookingUp }] =
    useLazyLookupSaleForExchangeQuery();
  const { data: eligibleSale, isLoading: isEligibleLoading } = useGetEligibleSaleQuery(
    selectedSaleId,
    { skip: !selectedSaleId }
  );
  const [previewExchange, { isLoading: isPreviewLoading }] = usePreviewExchangeMutation();
  const [createExchange, { isLoading: isSubmitting }] = useCreateExchangeMutation();
  const [lookupVariant, { isLoading: isSearchingVariant }] = useLookupVariantMutation();

  const returnLines = useMemo(
    () => (eligibleSale ? buildReturnLines(selections, eligibleSale.lines) : []),
    [selections, eligibleSale]
  );

  const settlementAmount = Math.abs(preview?.netAmount ?? 0);
  const tenderedAmount = Number(tenderedInput) || 0;
  const changeAmount =
    preview?.balanceDirection === 'customer_pays' &&
    paymentMethod === 'cash' &&
    tenderedAmount > settlementAmount
      ? Math.round((tenderedAmount - settlementAmount) * 100) / 100
      : 0;

  const needsOverride = eligibleSale?.policyStatus?.requiresOverride;
  const hasOverrideCredentials = adminUsername.trim() && adminPin.trim();

  const canProceedFromSelect = returnLines.length > 0 && (!isExchange || newLines.length > 0);

  const canSubmit =
    preview &&
    (!needsOverride || hasOverrideCredentials) &&
    (settlementAmount === 0 ||
      (preview.balanceDirection === 'customer_pays' &&
        paymentMethod !== 'cash' &&
        settlementAmount > 0) ||
      (preview.balanceDirection === 'customer_pays' &&
        paymentMethod === 'cash' &&
        tenderedAmount >= settlementAmount) ||
      (preview.balanceDirection === 'refund' && settlementAmount > 0));

  const refreshPreview = useCallback(async () => {
    if (!selectedSaleId || returnLines.length === 0) {
      setPreview(null);
      return;
    }
    try {
      const payload = {
        originalSaleId: selectedSaleId,
        returnLines,
        newLines: isExchange
          ? newLines.map((line) => ({ variantId: line.variantId, quantity: line.quantity }))
          : [],
        ...(needsOverride && hasOverrideCredentials
          ? { adminOverride: { username: adminUsername.trim(), pin: adminPin.trim() } }
          : {}),
      };
      const result = await previewExchange(payload).unwrap();
      setPreview(result);
    } catch (error) {
      setPreview(null);
      toast.error(getErrorMessage(error, t('exchanges.errors.previewFailed')));
    }
  }, [
    selectedSaleId,
    returnLines,
    isExchange,
    newLines,
    needsOverride,
    hasOverrideCredentials,
    adminUsername,
    adminPin,
    previewExchange,
    t,
  ]);

  useEffect(() => {
    if (step !== 'settlement') {
      return;
    }
    const timer = setTimeout(refreshPreview, 300);
    return () => clearTimeout(timer);
  }, [step, refreshPreview]);

  useEffect(() => {
    if (step === 'settlement' && preview?.balanceDirection === 'refund') {
      setPaymentMethod('store_credit');
    }
    if (step === 'settlement' && preview?.balanceDirection === 'customer_pays') {
      setPaymentMethod('cash');
    }
    if (step === 'settlement' && settlementAmount > 0 && paymentMethod !== 'cash') {
      setTenderedInput(String(settlementAmount));
    }
  }, [step, preview, settlementAmount, paymentMethod]);

  if (!canManage) {
    return <Navigate to="/" replace />;
  }

  function resetFlow() {
    setStep('lookup');
    setLookupInput('');
    setSelectedSaleId(null);
    setSelections({});
    setIsExchange(false);
    setNewLines([]);
    setReplacementSearch('');
    setPreview(null);
    setAdminUsername('');
    setAdminPin('');
    setPaymentMethod('cash');
    setTenderedInput('');
  }

  async function handleLookupSubmit(event) {
    event.preventDefault();
    const value = lookupInput.trim();
    if (!value) {
      return;
    }
    try {
      await lookupSale(
        lookupMode === 'phone' ? { customerPhone: value } : { code: value }
      ).unwrap();
    } catch (error) {
      toast.error(getErrorMessage(error, t('exchanges.errors.lookupFailed')));
    }
  }

  function handleSelectSale(saleId) {
    setSelectedSaleId(saleId);
    setSelections({});
    setIsExchange(false);
    setNewLines([]);
    setStep('select');
  }

  function updateSelection(lineId, patch) {
    setSelections((current) => ({
      ...current,
      [lineId]: { disposition: 'restock', ...current[lineId], ...patch },
    }));
  }

  async function handleAddReplacement() {
    const code = replacementSearch.trim();
    if (!code) {
      return;
    }
    try {
      const data = await lookupVariant(code).unwrap();
      setNewLines((current) => {
        const existing = current.find((line) => line.variantId === data.variantId);
        if (existing) {
          return current.map((line) =>
            line.variantId === data.variantId
              ? { ...line, quantity: line.quantity + 1 }
              : line
          );
        }
        return [
          ...current,
          {
            variantId: data.variantId,
            productName: data.product.name,
            sku: data.sku,
            barcode: data.barcode,
            unitPrice: data.unitPrice,
            quantity: 1,
            attributes: data.attributes,
            stock: data.stock.quantityOnHand,
          },
        ];
      });
      setReplacementSearch('');
    } catch (error) {
      toast.error(getErrorMessage(error, t('exchanges.errors.replacementFailed')));
    }
  }

  function updateNewLineQuantity(variantId, delta) {
    setNewLines((current) =>
      current
        .map((line) => {
          if (line.variantId !== variantId) {
            return line;
          }
          const nextQuantity = line.quantity + delta;
          return nextQuantity < 1 ? null : { ...line, quantity: nextQuantity };
        })
        .filter(Boolean)
    );
  }

  async function handleProceedToSettlement() {
    if (!canProceedFromSelect) {
      return;
    }
    setStep('settlement');
  }

  async function handleSubmitExchange() {
    if (!canSubmit || !selectedSaleId) {
      return;
    }
    try {
      const payload = {
        originalSaleId: selectedSaleId,
        returnLines,
        newLines: isExchange
          ? newLines.map((line) => ({ variantId: line.variantId, quantity: line.quantity }))
          : [],
        ...(needsOverride && hasOverrideCredentials
          ? { adminOverride: { username: adminUsername.trim(), pin: adminPin.trim() } }
          : {}),
        ...(settlementAmount > 0
          ? {
              settlementPayment: {
                method: paymentMethod,
                amount: settlementAmount,
                ...(preview.balanceDirection === 'customer_pays' && paymentMethod === 'cash'
                  ? { tenderedAmount, changeAmount }
                  : {}),
              },
            }
          : {}),
      };
      const result = await createExchange(payload).unwrap();
      toast.success(
        t('exchanges.success', {
          number: result.exchangeNumber,
          type: t(`exchanges.types.${result.exchangeType}`),
        })
      );
      resetFlow();
    } catch (error) {
      toast.error(getErrorMessage(error, t('exchanges.errors.submitFailed')));
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-semibold">{t('exchanges.title')}</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{t('exchanges.subtitle')}</p>
        </div>
        {step !== 'lookup' ? (
          <Button variant="ghost" onClick={resetFlow}>
            {t('exchanges.startOver')}
          </Button>
        ) : null}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {STEPS.map((item, index) => (
          <Badge
            key={item}
            className={cn(
              'px-3 py-1 text-[12px]',
              step === item ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
            )}
          >
            {index + 1}. {t(`exchanges.steps.${item}`)}
          </Badge>
        ))}
      </div>

      {step === 'lookup' ? (
        <div className="mx-auto max-w-3xl rounded-xl border border-border bg-white p-6">
          <div className="mb-4 flex gap-2">
            <Button
              variant={lookupMode === 'invoice' ? 'default' : 'outline'}
              onClick={() => setLookupMode('invoice')}
            >
              {t('exchanges.lookup.invoice')}
            </Button>
            <Button
              variant={lookupMode === 'phone' ? 'default' : 'outline'}
              onClick={() => setLookupMode('phone')}
            >
              {t('exchanges.lookup.phone')}
            </Button>
          </div>
          <form onSubmit={handleLookupSubmit} className="flex gap-3">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={lookupInput}
                onChange={(event) => setLookupInput(event.target.value)}
                placeholder={
                  lookupMode === 'phone'
                    ? t('exchanges.lookup.phonePlaceholder')
                    : t('exchanges.lookup.invoicePlaceholder')
                }
                className="h-11 pl-9"
                autoFocus
              />
            </div>
            <Button type="submit" disabled={isLookingUp}>
              {isLookingUp ? t('exchanges.lookup.searching') : t('exchanges.lookup.search')}
            </Button>
          </form>
          {lookupResults.length > 0 ? (
            <div className="mt-5 space-y-2">
              {lookupResults.map((sale) => (
                <button
                  key={sale.id}
                  type="button"
                  onClick={() => handleSelectSale(sale.id)}
                  className="flex w-full items-center justify-between rounded-lg border border-border px-4 py-3 text-left transition hover:border-primary/40 hover:bg-background"
                >
                  <div>
                    <p className="font-medium">{sale.invoiceNumber}</p>
                    <p className="text-[12px] text-muted-foreground">
                      {sale.customer?.name || t('sales.walkInCustomer')}
                      {sale.customer?.phone ? ` · ${sale.customer.phone}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatMoney(sale.total)}</p>
                    <p className="text-[12px] text-muted-foreground">
                      {new Date(sale.createdAt).toLocaleString()}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : lookupInput.trim() && !isLookingUp ? (
            <p className="mt-5 text-[13px] text-muted-foreground">{t('exchanges.lookup.empty')}</p>
          ) : null}
        </div>
      ) : null}

      {step === 'select' ? (
        <div className="space-y-6">
          {isEligibleLoading || !eligibleSale ? (
            <p className="text-[13px] text-muted-foreground">{t('exchanges.loadingSale')}</p>
          ) : (
            <>
              <div className="rounded-xl border border-border bg-white p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-[16px] font-semibold">{eligibleSale.invoiceNumber}</h2>
                    <p className="text-[12px] text-muted-foreground">
                      {new Date(eligibleSale.createdAt).toLocaleString()}
                      {eligibleSale.customer?.name ? ` · ${eligibleSale.customer.name}` : ''}
                    </p>
                  </div>
                  {eligibleSale.policyStatus.requiresOverride ? (
                    <Badge className="bg-warning/10 text-warning">{t('exchanges.policyExpired')}</Badge>
                  ) : (
                    <Badge className="bg-success/10 text-success">
                      {t('exchanges.policyOk', {
                        days: eligibleSale.policyStatus.returnPolicyDays,
                      })}
                    </Badge>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-[13px]">
                    <thead className="border-b border-border text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">{t('exchanges.table.product')}</th>
                        <th className="px-3 py-2 font-medium">{t('exchanges.table.variant')}</th>
                        <th className="px-3 py-2 font-medium">{t('exchanges.table.purchased')}</th>
                        <th className="px-3 py-2 font-medium">{t('exchanges.table.returnable')}</th>
                        <th className="px-3 py-2 font-medium">{t('exchanges.table.returnQty')}</th>
                        <th className="px-3 py-2 font-medium">{t('exchanges.table.disposition')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eligibleSale.lines.map((line) => (
                        <tr key={line.id} className="border-b border-border/70">
                          <td className="px-3 py-3">
                            <p className="font-medium">{line.productName}</p>
                            <p className="text-[12px] text-muted-foreground">{line.sku}</p>
                          </td>
                          <td className="px-3 py-3">{formatAttributes(line.attributes)}</td>
                          <td className="px-3 py-3">{line.quantity}</td>
                          <td className="px-3 py-3">{line.returnableQuantity}</td>
                          <td className="px-3 py-3">
                            <Input
                              type="number"
                              min={0}
                              max={line.returnableQuantity}
                              value={selections[line.id]?.quantity ?? ''}
                              onChange={(event) =>
                                updateSelection(line.id, {
                                  quantity: Math.min(
                                    Number(event.target.value) || 0,
                                    line.returnableQuantity
                                  ),
                                })
                              }
                              className="h-9 w-20"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <select
                              value={selections[line.id]?.disposition || 'restock'}
                              onChange={(event) =>
                                updateSelection(line.id, { disposition: event.target.value })
                              }
                              className="h-9 rounded-md border border-border px-2 text-[13px]"
                              disabled={!Number(selections[line.id]?.quantity)}
                            >
                              <option value="restock">{t('exchanges.disposition.restock')}</option>
                              <option value="damaged">{t('exchanges.disposition.damaged')}</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-white p-5">
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <Button
                    variant={!isExchange ? 'default' : 'outline'}
                    onClick={() => {
                      setIsExchange(false);
                      setNewLines([]);
                    }}
                  >
                    {t('exchanges.mode.return')}
                  </Button>
                  <Button
                    variant={isExchange ? 'default' : 'outline'}
                    onClick={() => setIsExchange(true)}
                  >
                    <ArrowLeftRight size={14} className="mr-1.5" />
                    {t('exchanges.mode.exchange')}
                  </Button>
                </div>

                {isExchange ? (
                  <div className="space-y-4">
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        handleAddReplacement();
                      }}
                      className="flex gap-3"
                    >
                      <Input
                        value={replacementSearch}
                        onChange={(event) => setReplacementSearch(event.target.value)}
                        placeholder={t('exchanges.replacementPlaceholder')}
                        className="h-10 flex-1"
                      />
                      <Button type="submit" disabled={isSearchingVariant}>
                        <Plus size={14} className="mr-1.5" />
                        {t('exchanges.addReplacement')}
                      </Button>
                    </form>
                    {newLines.length === 0 ? (
                      <p className="text-[13px] text-muted-foreground">
                        {t('exchanges.noReplacements')}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {newLines.map((line) => (
                          <div
                            key={line.variantId}
                            className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
                          >
                            <div>
                              <p className="font-medium">{line.productName}</p>
                              <p className="text-[12px] text-muted-foreground">
                                {line.sku} · {formatAttributes(line.attributes)} ·{' '}
                                {formatMoney(line.unitPrice)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateNewLineQuantity(line.variantId, -1)}
                              >
                                −
                              </Button>
                              <span className="min-w-[24px] text-center">{line.quantity}</span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateNewLineQuantity(line.variantId, 1)}
                              >
                                +
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setNewLines((current) =>
                                    current.filter((item) => item.variantId !== line.variantId)
                                  )
                                }
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep('lookup')}>
                  <ArrowLeft size={14} className="mr-1.5" />
                  {t('exchanges.back')}
                </Button>
                <Button onClick={handleProceedToSettlement} disabled={!canProceedFromSelect}>
                  {t('exchanges.continue')}
                </Button>
              </div>
            </>
          )}
        </div>
      ) : null}

      {step === 'settlement' && eligibleSale ? (
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-xl border border-border bg-white p-5">
            <h2 className="mb-4 text-[16px] font-semibold">{t('exchanges.settlement.title')}</h2>
            {isPreviewLoading ? (
              <p className="text-[13px] text-muted-foreground">{t('exchanges.previewing')}</p>
            ) : preview ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg bg-background p-3">
                    <p className="text-[12px] text-muted-foreground">{t('exchanges.settlement.returnValue')}</p>
                    <p className="text-[18px] font-semibold">{formatMoney(preview.returnSubtotal)}</p>
                  </div>
                  <div className="rounded-lg bg-background p-3">
                    <p className="text-[12px] text-muted-foreground">{t('exchanges.settlement.newValue')}</p>
                    <p className="text-[18px] font-semibold">{formatMoney(preview.newSubtotal)}</p>
                  </div>
                  <div className="rounded-lg bg-primary/5 p-3">
                    <p className="text-[12px] text-muted-foreground">{t('exchanges.settlement.net')}</p>
                    <p className="text-[18px] font-semibold text-primary">
                      {formatMoney(Math.abs(preview.netAmount))}
                    </p>
                  </div>
                </div>
                <div className="rounded-lg border border-border px-4 py-3">
                  {preview.balanceDirection === 'even' ? (
                    <p className="font-medium text-success">{t('exchanges.settlement.even')}</p>
                  ) : null}
                  {preview.balanceDirection === 'customer_pays' ? (
                    <p className="font-medium">{t('exchanges.settlement.customerPays', {
                      amount: formatMoney(settlementAmount),
                    })}</p>
                  ) : null}
                  {preview.balanceDirection === 'refund' ? (
                    <p className="font-medium">{t('exchanges.settlement.refund', {
                      amount: formatMoney(settlementAmount),
                    })}</p>
                  ) : null}
                </div>
                {needsOverride ? (
                  <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
                    <p className="mb-3 text-[13px] font-medium">{t('exchanges.override.title')}</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        value={adminUsername}
                        onChange={(event) => setAdminUsername(event.target.value)}
                        placeholder={t('exchanges.override.username')}
                      />
                      <Input
                        type="password"
                        value={adminPin}
                        onChange={(event) => setAdminPin(event.target.value)}
                        placeholder={t('exchanges.override.pin')}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground">{t('exchanges.previewUnavailable')}</p>
            )}
          </div>

          <div className="rounded-xl border border-border bg-white p-5">
            <h2 className="mb-4 text-[16px] font-semibold">{t('exchanges.payment.title')}</h2>
            {settlementAmount === 0 ? (
              <p className="text-[13px] text-muted-foreground">{t('exchanges.payment.notRequired')}</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {['cash', 'card', 'jazzcash', 'easypaisa', 'bank_transfer', 'store_credit'].map((method) => {
                    const disabled =
                      preview?.balanceDirection === 'customer_pays' && method === 'store_credit';
                    return (
                      <button
                        key={method}
                        type="button"
                        disabled={disabled}
                        onClick={() => setPaymentMethod(method)}
                        className={cn(
                          'rounded-lg border px-3 py-2 text-[12px] font-medium transition',
                          paymentMethod === method
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-border text-muted-foreground',
                          disabled && 'cursor-not-allowed opacity-40'
                        )}
                      >
                        {t(`pos.payment.${method === 'bank_transfer' ? 'bankTransfer' : method}`)}
                      </button>
                    );
                  })}
                </div>
                {preview?.balanceDirection === 'customer_pays' && paymentMethod === 'cash' ? (
                  <>
                    <Input
                      type="number"
                      value={tenderedInput}
                      onChange={(event) => setTenderedInput(event.target.value)}
                      placeholder={t('pos.amountTendered')}
                    />
                    {changeAmount > 0 ? (
                      <p className="text-[13px] text-muted-foreground">
                        {t('pos.change')}: {formatMoney(changeAmount)}
                      </p>
                    ) : null}
                  </>
                ) : null}
              </div>
            )}
            <div className="mt-6 flex flex-col gap-2">
              <Button variant="outline" onClick={() => setStep('select')}>
                {t('exchanges.back')}
              </Button>
              <Button onClick={handleSubmitExchange} disabled={!canSubmit || isSubmitting}>
                {isSubmitting ? t('exchanges.submitting') : t('exchanges.confirm')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
