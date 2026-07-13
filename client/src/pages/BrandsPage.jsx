import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import Button from '../atoms/Button';
import Input from '../atoms/Input';
import BrandForm from '../organisms/BrandForm';
import BrandsTable from '../organisms/BrandsTable';
import { useAuth } from '../hooks/useAuth';
import { getErrorMessage } from '../lib/errors';
import { cn } from '../lib/utils';
import {
  useCreateBrandMutation,
  useDeactivateBrandMutation,
  useListBrandsQuery,
  useRemoveBrandLogoMutation,
  useUpdateBrandMutation,
  useUploadBrandLogoMutation,
} from '../store/brandsApi';

const activeFilters = ['', 'true', 'false'];

export default function BrandsPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('brands.manage');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [page, setPage] = useState(1);
  const [formMode, setFormMode] = useState(null);
  const [editingBrand, setEditingBrand] = useState(null);
  const [formError, setFormError] = useState('');
  const queryParams = useMemo(
    () => ({
      page,
      limit: 20,
      search,
      ...(activeFilter === 'true' ? { isActive: true } : {}),
      ...(activeFilter === 'false' ? { isActive: false } : {}),
    }),
    [page, search, activeFilter]
  );
  const { data, isLoading, isFetching, error } = useListBrandsQuery(queryParams);
  const [createBrand, { isLoading: isCreating }] = useCreateBrandMutation();
  const [updateBrand, { isLoading: isUpdating }] = useUpdateBrandMutation();
  const [deactivateBrand, { isLoading: isDeactivating }] = useDeactivateBrandMutation();
  const [uploadLogo, { isLoading: isUploading }] = useUploadBrandLogoMutation();
  const [removeLogo] = useRemoveBrandLogoMutation();
  const isSubmitting = isCreating || isUpdating;
  const brands = data?.items ?? [];
  const meta = data?.meta;

  function handleSearchSubmit(event) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function openCreateForm() {
    setFormError('');
    setEditingBrand(null);
    setFormMode('create');
  }

  function openEditForm(brand) {
    setFormError('');
    setEditingBrand(brand);
    setFormMode('edit');
  }

  function closeForm() {
    setFormError('');
    setEditingBrand(null);
    setFormMode(null);
  }

  async function handleSubmit(values) {
    setFormError('');
    try {
      if (formMode === 'create') {
        await createBrand(values).unwrap();
        toast.success(t('brands.createSuccess'));
      } else if (editingBrand) {
        await updateBrand({ brandId: editingBrand.id, body: values }).unwrap();
        toast.success(t('brands.updateSuccess'));
      }
      closeForm();
    } catch (submitError) {
      setFormError(getErrorMessage(submitError, t('brands.errors.saveFailed')));
    }
  }

  async function handleDeactivate(brand) {
    if (!window.confirm(t('brands.deactivateConfirm', { name: brand.name }))) {
      return;
    }
    try {
      await deactivateBrand(brand.id).unwrap();
      toast.success(t('brands.deactivateSuccess'));
      if (editingBrand?.id === brand.id) {
        closeForm();
      }
    } catch (deactivateError) {
      toast.error(getErrorMessage(deactivateError, t('brands.errors.deactivateFailed')));
    }
  }

  async function handleUploadLogo(brand, file) {
    try {
      await uploadLogo({ brandId: brand.id, file }).unwrap();
      toast.success(t('brands.logo.uploadSuccess'));
    } catch (uploadError) {
      toast.error(getErrorMessage(uploadError, t('brands.errors.logoUploadFailed')));
    }
  }

  async function handleRemoveLogo(brand) {
    if (!window.confirm(t('brands.logo.removeConfirm'))) {
      return;
    }
    try {
      await removeLogo(brand.id).unwrap();
      toast.success(t('brands.logo.removeSuccess'));
    } catch (removeError) {
      toast.error(getErrorMessage(removeError, t('brands.errors.logoRemoveFailed')));
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to="/products"
            className="mb-2 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-foreground"
          >
            <ArrowLeft size={14} />
            {t('brands.backToProducts')}
          </Link>
          <h1 className="text-[20px] font-semibold">{t('brands.title')}</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{t('brands.subtitle')}</p>
        </div>
        {canManage ? (
          <Button size="sm" onClick={openCreateForm} disabled={formMode === 'create'}>
            <Plus size={15} />
            {t('brands.addBrand')}
          </Button>
        ) : null}
      </div>
      {!canManage ? (
        <div className="mb-4 rounded-lg border border-border bg-[#fafafa] px-3 py-2 text-[13px] text-muted">
          {t('brands.readOnly')}
        </div>
      ) : null}
      {formMode ? (
        <div className="mb-4">
          <h2 className="mb-3 text-[15px] font-medium">
            {formMode === 'create' ? t('brands.createTitle') : t('brands.editTitle')}
          </h2>
          <BrandForm
            initialValues={
              editingBrand
                ? { name: editingBrand.name, isActive: editingBrand.isActive }
                : undefined
            }
            onSubmit={handleSubmit}
            onCancel={closeForm}
            isSubmitting={isSubmitting}
            submitLabel={formMode === 'create' ? t('brands.form.create') : t('brands.form.save')}
            errorMessage={formError}
          />
        </div>
      ) : null}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="relative min-w-[260px] flex-1 max-w-md">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t('brands.searchPlaceholder')}
            className="pl-9"
          />
        </form>
        <div className="flex flex-wrap gap-1 rounded-lg bg-[#f4f4f8] p-1">
          {activeFilters.map((filterValue) => (
            <button
              key={filterValue || 'all'}
              type="button"
              onClick={() => {
                setActiveFilter(filterValue);
                setPage(1);
              }}
              className={cn(
                'rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors',
                activeFilter === filterValue
                  ? 'bg-white text-foreground shadow-sm'
                  : 'text-muted hover:text-foreground'
              )}
            >
              {filterValue === 'true'
                ? t('brands.status.active')
                : filterValue === 'false'
                  ? t('brands.status.inactive')
                  : t('brands.filters.all')}
            </button>
          ))}
        </div>
      </div>
      {error ? (
        <div className="mb-4 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[13px] text-danger">
          {getErrorMessage(error, t('brands.errors.loadFailed'))}
        </div>
      ) : null}
      <BrandsTable
        brands={brands}
        isLoading={isLoading || isFetching || isDeactivating}
        canManage={canManage}
        onEdit={openEditForm}
        onDeactivate={handleDeactivate}
        onUploadLogo={handleUploadLogo}
        onRemoveLogo={handleRemoveLogo}
        isUploading={isUploading}
      />
      {meta && meta.totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-[12px] text-muted">
            {t('brands.pagination.summary', {
              from: (meta.page - 1) * meta.limit + 1,
              to: Math.min(meta.page * meta.limit, meta.total),
              total: meta.total,
            })}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page <= 1}
              onClick={() => setPage((current) => current - 1)}
            >
              {t('brands.pagination.previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page >= meta.totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              {t('brands.pagination.next')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
