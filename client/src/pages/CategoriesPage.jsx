import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import Button from '../atoms/Button';
import Input from '../atoms/Input';
import CategoryForm from '../organisms/CategoryForm';
import CategoryTree from '../organisms/CategoryTree';
import { useAuth } from '../hooks/useAuth';
import { flattenCategoryOptions } from '../lib/categories';
import { getErrorMessage } from '../lib/errors';
import { cn } from '../lib/utils';
import {
  useCreateCategoryMutation,
  useDeactivateCategoryMutation,
  useGetCategoryTreeQuery,
  useListCategoriesQuery,
  useUpdateCategoryMutation,
} from '../store/categoriesApi';

const activeFilters = ['', 'true', 'false'];

export default function CategoriesPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('categories.manage');
  const [viewMode, setViewMode] = useState('tree');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [page, setPage] = useState(1);
  const [formMode, setFormMode] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formError, setFormError] = useState('');
  const listParams = useMemo(
    () => ({
      page,
      limit: 20,
      search,
      ...(activeFilter === 'true' ? { isActive: true } : {}),
      ...(activeFilter === 'false' ? { isActive: false } : {}),
    }),
    [page, search, activeFilter]
  );
  const treeParams = useMemo(
    () => ({
      ...(activeFilter === 'true' ? { isActive: true } : {}),
      ...(activeFilter === 'false' ? { isActive: false } : {}),
    }),
    [activeFilter]
  );
  const {
    data: treeData,
    isLoading: isTreeLoading,
    isFetching: isTreeFetching,
    error: treeError,
  } = useGetCategoryTreeQuery(treeParams);
  const {
    data: listData,
    isLoading: isListLoading,
    isFetching: isListFetching,
    error: listError,
  } = useListCategoriesQuery(listParams, { skip: viewMode !== 'table' });
  const [createCategory, { isLoading: isCreating }] = useCreateCategoryMutation();
  const [updateCategory, { isLoading: isUpdating }] = useUpdateCategoryMutation();
  const [deactivateCategory, { isLoading: isDeactivating }] = useDeactivateCategoryMutation();
  const parentOptions = useMemo(
    () => flattenCategoryOptions(treeData ?? [], 0, editingCategory?.id ?? null),
    [treeData, editingCategory]
  );
  const isSubmitting = isCreating || isUpdating;
  const loadError = viewMode === 'tree' ? treeError : listError;

  function handleSearchSubmit(event) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function openCreateForm() {
    setFormError('');
    setEditingCategory(null);
    setFormMode('create');
  }

  function openEditForm(category) {
    setFormError('');
    setEditingCategory(category);
    setFormMode('edit');
  }

  function closeForm() {
    setFormError('');
    setEditingCategory(null);
    setFormMode(null);
  }

  async function handleSubmit(values) {
    setFormError('');
    try {
      if (formMode === 'create') {
        await createCategory(values).unwrap();
        toast.success(t('categories.createSuccess'));
      } else if (editingCategory) {
        await updateCategory({ categoryId: editingCategory.id, body: values }).unwrap();
        toast.success(t('categories.updateSuccess'));
      }
      closeForm();
    } catch (submitError) {
      setFormError(getErrorMessage(submitError, t('categories.errors.saveFailed')));
    }
  }

  async function handleDeactivate(category) {
    if (!window.confirm(t('categories.deactivateConfirm', { name: category.name }))) {
      return;
    }
    try {
      await deactivateCategory(category.id).unwrap();
      toast.success(t('categories.deactivateSuccess'));
      if (editingCategory?.id === category.id) {
        closeForm();
      }
    } catch (deactivateError) {
      toast.error(getErrorMessage(deactivateError, t('categories.errors.deactivateFailed')));
    }
  }

  const categories = listData?.items ?? [];
  const meta = listData?.meta;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to="/products"
            className="mb-2 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-foreground"
          >
            <ArrowLeft size={14} />
            {t('categories.backToProducts')}
          </Link>
          <h1 className="text-[20px] font-semibold">{t('categories.title')}</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{t('categories.subtitle')}</p>
        </div>
        {canManage ? (
          <Button size="sm" onClick={openCreateForm} disabled={formMode === 'create'}>
            <Plus size={15} />
            {t('categories.addCategory')}
          </Button>
        ) : null}
      </div>
      {!canManage ? (
        <div className="mb-4 rounded-lg border border-border bg-[#fafafa] px-3 py-2 text-[13px] text-muted">
          {t('categories.readOnly')}
        </div>
      ) : null}
      {formMode ? (
        <div className="mb-4">
          <h2 className="mb-3 text-[15px] font-medium">
            {formMode === 'create' ? t('categories.createTitle') : t('categories.editTitle')}
          </h2>
          <CategoryForm
            initialValues={
              editingCategory
                ? {
                    name: editingCategory.name,
                    description: editingCategory.description || '',
                    parentCategoryId: editingCategory.parentCategoryId || '',
                    isActive: editingCategory.isActive,
                  }
                : undefined
            }
            parentOptions={parentOptions}
            onSubmit={handleSubmit}
            onCancel={closeForm}
            isSubmitting={isSubmitting}
            submitLabel={
              formMode === 'create' ? t('categories.form.create') : t('categories.form.save')
            }
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
            placeholder={t('categories.searchPlaceholder')}
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
                ? t('categories.status.active')
                : filterValue === 'false'
                  ? t('categories.status.inactive')
                  : t('categories.filters.all')}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-lg bg-[#f4f4f8] p-1">
          <button
            type="button"
            onClick={() => setViewMode('tree')}
            className={cn(
              'rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors',
              viewMode === 'tree'
                ? 'bg-white text-foreground shadow-sm'
                : 'text-muted hover:text-foreground'
            )}
          >
            {t('categories.viewTree')}
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={cn(
              'rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors',
              viewMode === 'table'
                ? 'bg-white text-foreground shadow-sm'
                : 'text-muted hover:text-foreground'
            )}
          >
            {t('categories.viewTable')}
          </button>
        </div>
      </div>
      {loadError ? (
        <div className="mb-4 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[13px] text-danger">
          {getErrorMessage(loadError, t('categories.errors.loadFailed'))}
        </div>
      ) : null}
      {viewMode === 'tree' ? (
        <CategoryTree
          categories={treeData ?? []}
          isLoading={isTreeLoading || isTreeFetching || isDeactivating}
          canManage={canManage}
          onEdit={openEditForm}
          onDeactivate={handleDeactivate}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
          {isListLoading || isListFetching ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-primary" />
            </div>
          ) : !categories.length ? (
            <div className="py-16 text-center text-[13px] text-muted">{t('categories.emptyTitle')}</div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-[#fafafa] text-[12px] font-medium uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">{t('categories.table.name')}</th>
                  <th className="px-4 py-3">{t('categories.table.parent')}</th>
                  <th className="px-4 py-3">{t('categories.table.products')}</th>
                  <th className="px-4 py-3">{t('categories.table.status')}</th>
                  {canManage ? <th className="px-4 py-3">{t('categories.table.actions')}</th> : null}
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr
                    key={category.id}
                    className="border-b border-border last:border-b-0 hover:bg-[#fafafa]"
                  >
                    <td className="px-4 py-3">
                      <div className="text-[13px] font-medium">{category.name}</div>
                      {category.description ? (
                        <div className="text-[12px] text-muted">{category.description}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-muted">
                      {category.parent?.name || t('categories.noParent')}
                    </td>
                    <td className="px-4 py-3 text-[13px] tabular-nums">{category.productCount}</td>
                    <td className="px-4 py-3 text-[13px]">
                      {category.isActive
                        ? t('categories.status.active')
                        : t('categories.status.inactive')}
                    </td>
                    {canManage ? (
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openEditForm(category)}
                          >
                            {t('categories.edit')}
                          </Button>
                          {category.isActive ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isDeactivating}
                              onClick={() => handleDeactivate(category)}
                            >
                              {t('categories.deactivate')}
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {viewMode === 'table' && meta && meta.totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-[12px] text-muted">
            {t('categories.pagination.summary', {
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
              {t('categories.pagination.previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page >= meta.totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              {t('categories.pagination.next')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
