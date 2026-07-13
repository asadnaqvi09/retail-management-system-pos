import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import Button from '../atoms/Button';
import Input from '../atoms/Input';
import PromotionForm from '../organisms/PromotionForm';
import PromotionsTable from '../organisms/PromotionsTable';
import { useAuth } from '../hooks/useAuth';
import { getErrorMessage } from '../lib/errors';
import { cn } from '../lib/utils';
import { useListProductsQuery } from '../store/productsApi';
import { useListCategoriesQuery } from '../store/categoriesApi';
import { useListBrandsQuery } from '../store/brandsApi';
import {
  useListPromotionsQuery,
  useCreatePromotionMutation,
  useUpdatePromotionMutation,
  useDeletePromotionMutation,
} from '../store/promotionsApi';

const statusFilters = ['', 'active', 'scheduled', 'expired'];

export default function SeasonalSalesPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('promotions.manage');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [formMode, setFormMode] = useState(null);
  const [editingPromotion, setEditingPromotion] = useState(null);
  const [formError, setFormError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const queryParams = useMemo(
    () => ({
      page,
      limit: 20,
      search,
      ...(statusFilter ? { status: statusFilter } : {}),
    }),
    [page, search, statusFilter]
  );

  const { data, isLoading, isFetching, error } = useListPromotionsQuery(queryParams, {
    skip: !canManage,
  });
  const { data: productsData } = useListProductsQuery(
    { page: 1, limit: 100, status: 'active' },
    { skip: !canManage || !formMode }
  );
  const { data: categoriesData } = useListCategoriesQuery(
    { page: 1, limit: 100, isActive: true },
    { skip: !canManage || !formMode }
  );
  const { data: brandsData } = useListBrandsQuery(
    { page: 1, limit: 100, isActive: true },
    { skip: !canManage || !formMode }
  );
  const [createPromotion, { isLoading: isCreating }] = useCreatePromotionMutation();
  const [updatePromotion, { isLoading: isUpdating }] = useUpdatePromotionMutation();
  const [deletePromotion] = useDeletePromotionMutation();

  const promotions = data?.items ?? [];
  const meta = data?.meta;
  const isSubmitting = isCreating || isUpdating;

  if (!canManage) {
    return <Navigate to="/" replace />;
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function openCreateForm() {
    setFormError('');
    setEditingPromotion(null);
    setFormMode('create');
  }

  function openEditForm(promotion) {
    setFormError('');
    setEditingPromotion(promotion);
    setFormMode('edit');
  }

  function closeForm() {
    setFormError('');
    setEditingPromotion(null);
    setFormMode(null);
  }

  async function handleSubmit(values) {
    setFormError('');
    try {
      if (formMode === 'edit' && editingPromotion) {
        await updatePromotion({
          promotionId: editingPromotion.id,
          body: values,
        }).unwrap();
        toast.success(t('promotions.updateSuccess'));
      } else {
        await createPromotion(values).unwrap();
        toast.success(t('promotions.createSuccess'));
      }
      closeForm();
    } catch (submitError) {
      const message = getErrorMessage(submitError, t('promotions.errors.saveFailed'));
      setFormError(message);
      toast.error(message);
    }
  }

  async function handleDelete(promotion) {
    if (!window.confirm(t('promotions.deleteConfirm'))) {
      return;
    }
    try {
      setDeletingId(promotion.id);
      await deletePromotion(promotion.id).unwrap();
      toast.success(t('promotions.deleteSuccess'));
      if (editingPromotion?.id === promotion.id) {
        closeForm();
      }
    } catch (deleteError) {
      toast.error(getErrorMessage(deleteError, t('promotions.errors.deleteFailed')));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-semibold">{t('promotions.title')}</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{t('promotions.subtitle')}</p>
        </div>
        <Button onClick={openCreateForm}>
          <Plus size={16} />
          {t('promotions.addPromotion')}
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="relative min-w-[240px] flex-1 max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t('promotions.searchPlaceholder')}
            className="h-10 pl-9"
          />
        </form>
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((status) => (
            <button
              key={status || 'all'}
              type="button"
              onClick={() => {
                setStatusFilter(status);
                setPage(1);
              }}
              className={cn(
                'rounded-lg border px-3 py-2 text-[12px] font-medium transition-colors',
                statusFilter === status
                  ? 'border-primary bg-[#eef2ff] text-primary'
                  : 'border-border bg-white text-muted hover:bg-[#f4f4f8]'
              )}
            >
              {status ? t(`promotions.status.${status}`) : t('promotions.filters.all')}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="text-[13px] text-muted-foreground">{t('promotions.loading')}</p>
      ) : error ? (
        <p className="text-[13px] text-danger">
          {getErrorMessage(error, t('promotions.errors.loadFailed'))}
        </p>
      ) : (
        <>
          <PromotionsTable
            promotions={promotions}
            canManage={canManage}
            onEdit={openEditForm}
            onDelete={handleDelete}
            isDeletingId={deletingId}
          />
          {meta?.totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-[12px] text-muted-foreground">
                {t('promotions.pagination.summary', { page: meta.page, total: meta.totalPages })}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.page <= 1 || isFetching}
                  onClick={() => setPage((current) => Math.max(current - 1, 1))}
                >
                  {t('promotions.pagination.previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.page >= meta.totalPages || isFetching}
                  onClick={() => setPage((current) => current + 1)}
                >
                  {t('promotions.pagination.next')}
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}

      {formMode ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/20">
          <div className="h-full w-full max-w-md overflow-y-auto bg-[#f8f8fa] p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[18px] font-semibold">
                {formMode === 'edit' ? t('promotions.editPromotion') : t('promotions.newPromotion')}
              </h2>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-lg p-2 text-muted hover:bg-white"
              >
                <X size={18} />
              </button>
            </div>
            <PromotionForm
              key={`${formMode}-${editingPromotion?.id || 'new'}`}
              initialValues={editingPromotion || undefined}
              products={productsData?.items ?? []}
              categories={categoriesData?.items ?? []}
              brands={brandsData?.items ?? []}
              onSubmit={handleSubmit}
              onCancel={closeForm}
              isSubmitting={isSubmitting}
              submitLabel={
                formMode === 'edit' ? t('promotions.saveChanges') : t('promotions.createPromotion')
              }
              errorMessage={formError}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
