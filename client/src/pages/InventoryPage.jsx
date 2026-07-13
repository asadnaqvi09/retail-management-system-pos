import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import Button from '../atoms/Button';
import Input from '../atoms/Input';
import InventoryTable from '../organisms/InventoryTable';
import MovementHistoryTable from '../organisms/MovementHistoryTable';
import StockAdjustmentForm from '../organisms/StockAdjustmentForm';
import { useAuth } from '../hooks/useAuth';
import { getErrorMessage } from '../lib/errors';
import { cn } from '../lib/utils';
import {
  useAdjustStockMutation,
  useListInventoryQuery,
  useListStockMovementsQuery,
  useUpdateReorderThresholdMutation,
} from '../store/inventoryApi';

const viewModes = ['stock', 'movements'];

export default function InventoryPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const canAdjust = hasPermission('inventory.adjust');
  const [viewMode, setViewMode] = useState('stock');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [movementPage, setMovementPage] = useState(1);
  const [formMode, setFormMode] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [formError, setFormError] = useState('');
  const inventoryParams = useMemo(
    () => ({
      page,
      limit: 20,
      search,
      ...(lowStockOnly ? { lowStockOnly: true } : {}),
    }),
    [page, search, lowStockOnly]
  );
  const movementParams = useMemo(
    () => ({
      page: movementPage,
      limit: 20,
    }),
    [movementPage]
  );
  const {
    data: inventoryData,
    isLoading: isInventoryLoading,
    isFetching: isInventoryFetching,
    error: inventoryError,
  } = useListInventoryQuery(inventoryParams, { skip: viewMode !== 'stock' });
  const {
    data: movementData,
    isLoading: isMovementsLoading,
    isFetching: isMovementsFetching,
    error: movementError,
  } = useListStockMovementsQuery(movementParams, { skip: viewMode !== 'movements' });
  const [adjustStock, { isLoading: isAdjusting }] = useAdjustStockMutation();
  const [updateThreshold, { isLoading: isUpdatingThreshold }] = useUpdateReorderThresholdMutation();

  function handleSearchSubmit(event) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function openAdjustForm(item) {
    setSelectedItem(item);
    setFormMode('adjust');
    setFormError('');
  }

  function openThresholdForm(item) {
    setSelectedItem(item);
    setFormMode('threshold');
    setFormError('');
  }

  function closeForm() {
    setSelectedItem(null);
    setFormMode(null);
    setFormError('');
  }

  async function handleFormSubmit(values) {
    setFormError('');
    try {
      if (formMode === 'threshold') {
        await updateThreshold({
          variantId: selectedItem.variantId,
          reorderThreshold: values.reorderThreshold,
        }).unwrap();
        toast.success(t('inventory.thresholdSuccess'));
      } else {
        await adjustStock({
          variantId: selectedItem.variantId,
          body: values,
        }).unwrap();
        toast.success(t('inventory.adjustSuccess'));
      }
      closeForm();
    } catch (submitError) {
      setFormError(getErrorMessage(submitError, t('inventory.errors.saveFailed')));
    }
  }

  const inventoryItems = inventoryData?.items ?? [];
  const inventoryMeta = inventoryData?.meta;
  const movementItems = movementData?.items ?? [];
  const movementMeta = movementData?.meta;
  const loadError = viewMode === 'stock' ? inventoryError : movementError;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-semibold">{t('inventory.title')}</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{t('inventory.subtitle')}</p>
        </div>
        <div className="flex gap-1 rounded-lg bg-[#f4f4f8] p-1">
          {viewModes.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={cn(
                'rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors',
                viewMode === mode
                  ? 'bg-white text-foreground shadow-sm'
                  : 'text-muted hover:text-foreground'
              )}
            >
              {mode === 'stock' ? t('inventory.viewStock') : t('inventory.viewMovements')}
            </button>
          ))}
        </div>
      </div>
      {!canAdjust ? (
        <div className="mb-4 rounded-lg border border-border bg-[#fafafa] px-3 py-2 text-[13px] text-muted">
          {t('inventory.readOnly')}
        </div>
      ) : null}
      {formMode && selectedItem ? (
        <div className="mb-4">
          <h2 className="mb-3 text-[15px] font-medium">
            {formMode === 'adjust' ? t('inventory.adjustTitle') : t('inventory.thresholdTitle')}
          </h2>
          <StockAdjustmentForm
            item={selectedItem}
            mode={formMode}
            onSubmit={handleFormSubmit}
            onCancel={closeForm}
            isSubmitting={isAdjusting || isUpdatingThreshold}
            errorMessage={formError}
          />
        </div>
      ) : null}
      {viewMode === 'stock' ? (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="relative min-w-[260px] flex-1 max-w-md">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={t('inventory.searchPlaceholder')}
              className="pl-9"
            />
          </form>
          <button
            type="button"
            onClick={() => {
              setLowStockOnly((current) => !current);
              setPage(1);
            }}
            className={cn(
              'rounded-lg border px-3 py-2 text-[12px] font-medium transition-colors',
              lowStockOnly
                ? 'border-[#fde68a] bg-[#fef3c7] text-warning'
                : 'border-border bg-white text-muted hover:bg-[#fafafa]'
            )}
          >
            {t('inventory.lowStockOnly')}
          </button>
        </div>
      ) : null}
      {loadError ? (
        <div className="mb-4 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[13px] text-danger">
          {getErrorMessage(loadError, t('inventory.errors.loadFailed'))}
        </div>
      ) : null}
      {viewMode === 'stock' ? (
        <>
          <InventoryTable
            items={inventoryItems}
            isLoading={isInventoryLoading || isInventoryFetching}
            canAdjust={canAdjust}
            onAdjust={openAdjustForm}
            onEditThreshold={openThresholdForm}
          />
          {inventoryMeta && inventoryMeta.totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-[12px] text-muted">
                {t('inventory.pagination.summary', {
                  from: (inventoryMeta.page - 1) * inventoryMeta.limit + 1,
                  to: Math.min(inventoryMeta.page * inventoryMeta.limit, inventoryMeta.total),
                  total: inventoryMeta.total,
                })}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={inventoryMeta.page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  {t('inventory.pagination.previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={inventoryMeta.page >= inventoryMeta.totalPages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  {t('inventory.pagination.next')}
                </Button>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <MovementHistoryTable
            movements={movementItems}
            isLoading={isMovementsLoading || isMovementsFetching}
          />
          {movementMeta && movementMeta.totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-[12px] text-muted">
                {t('inventory.pagination.summary', {
                  from: (movementMeta.page - 1) * movementMeta.limit + 1,
                  to: Math.min(movementMeta.page * movementMeta.limit, movementMeta.total),
                  total: movementMeta.total,
                })}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={movementMeta.page <= 1}
                  onClick={() => setMovementPage((current) => current - 1)}
                >
                  {t('inventory.pagination.previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={movementMeta.page >= movementMeta.totalPages}
                  onClick={() => setMovementPage((current) => current + 1)}
                >
                  {t('inventory.pagination.next')}
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
